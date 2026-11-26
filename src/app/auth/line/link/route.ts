import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { postLoginPath } from "@/lib/auth/after-login";
import { isRole } from "@/lib/auth/post-login";
import { safeNextPath } from "@/lib/auth/safe-next";
import { LINE_LINK_COOKIE, lineOrigin, readLineConfig, secureCookie } from "@/lib/auth/line/config";
import { unseal } from "@/lib/auth/line/sealed-cookie";
import { checkBindUser, parsePendingLink } from "@/lib/auth/line/pending";
import { clearLineCookie, logLine } from "@/lib/auth/line/http";
import type { LineLinkError } from "@/lib/auth/line/messages";

const NO_STORE = { "Cache-Control": "private, no-store" };

function json(body: { error: LineLinkError } | { redirect: string }, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { ...headers, ...NO_STORE } });
}

/**
 * POST /auth/line/link：只負責「綁定」。驗證碼的寄送與驗證都在瀏覽器（Supabase 的頻率限制算在使用者自己的 IP）。
 * 使用者用驗證碼登入後呼叫：目前的 session 必須就是加密 cookie 裡那個 Email 的帳號，才寫入 line_identities。
 * 防 CSRF：Origin 必須是網站本身（沒有 Origin 也拒絕）；cookie 是 SameSite=Lax，跨站 POST 不會帶。
 */
export async function POST(request: NextRequest) {
  const config = readLineConfig();
  if (!config) return json({ error: "expired" }, 404);
  const origin = lineOrigin(process.env.SITE_URL, request.nextUrl);
  if (!origin || request.headers.get("origin") !== origin) return json({ error: "failed" }, 403);
  const secure = secureCookie(origin);

  const link = parsePendingLink(
    unseal<Record<string, unknown>>(request.cookies.get(LINE_LINK_COOKIE)?.value, "link", config.channelSecret, Math.floor(Date.now() / 1000)),
  );
  if (!link) return json({ error: "expired" });

  const responseHeaders: Record<string, string> = {};
  const supabase = await createClient({ responseHeaders });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "failed" }, 401);

  if (!checkBindUser(user, link).ok) {
    // 目前登入的不是 LINE Email 的帳號：不綁定、登出、清掉 cookie（要重新用 LINE 登入）
    logLine("link", "user_mismatch");
    await supabase.auth.signOut({ scope: "local" });
    return clearLineCookie(json({ error: "mismatch" }, 409, responseHeaders), LINE_LINK_COOKIE, secure);
  }

  const { data: result, error: linkErr } = await createAdminClient().rpc("line_link_identity", { p_user_id: user.id, p_line_sub: link.sub });
  if (linkErr || result === "conflict") {
    // 同時寫入的競爭或暫時錯誤：保留 cookie，可以再按一次
    logLine("link", linkErr ? "rpc_error" : "conflict");
    return json({ error: "failed" }, 200, responseHeaders);
  }
  // linked／already：完成。sub_taken／user_has_other：不覆蓋既有綁定，但 Email 驗證碼已證明是本人，照常登入。
  logLine("link", String(result));
  const path = await postLoginPath(supabase, isRole(link.role) ? link.role : null, safeNextPath(link.next));
  return clearLineCookie(json({ redirect: path }, 200, responseHeaders), LINE_LINK_COOKIE, secure);
}
