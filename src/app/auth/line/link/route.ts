import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAnonClient } from "@/lib/supabase/anon";
import { postLoginPath } from "@/lib/auth/after-login";
import { isRole } from "@/lib/auth/post-login";
import { safeNextPath } from "@/lib/auth/safe-next";
import { isValidOtpCode } from "@/lib/auth/otp-code";
import { LINE_LINK_COOKIE, lineOrigin, readLineConfig, secureCookie } from "@/lib/auth/line/config";
import { unseal } from "@/lib/auth/line/sealed-cookie";
import { LINE_SUB_RE } from "@/lib/auth/line/id-token";
import { clearLineCookie, logLine } from "@/lib/auth/line/http";
import type { LineLinkError } from "@/lib/auth/line/messages";

type Link = { sub: string; email: string; kind: "existing" | "new"; uid: string | null; next: string | null; role: string | null };

const NO_STORE = { "Cache-Control": "private, no-store" };

function json(body: { error: LineLinkError } | { ok: true } | { redirect: string }, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

/**
 * POST /auth/line/link：LINE 登入後「輸入 Email 驗證碼」那一步（/login?line=…）。
 * { action: "verify", code } → 用驗證碼登入該 Email 的帳號（沒有就由 Supabase 建立）→ 綁定 LINE → 回傳登入後要去的路徑。
 * { action: "resend" } → 重寄驗證碼。
 * 使用者輸入造成的錯誤一律回 200＋{ error }（畫面顯示訊息，瀏覽器 console 不會出現失敗的請求）。
 * 防 CSRF：只接受同源（Origin 必須是網站本身）；cookie 是 SameSite=Lax，跨站 POST 不會帶。
 */
export async function POST(request: NextRequest) {
  const config = readLineConfig();
  if (!config) return json({ error: "expired" }, 404);
  const origin = lineOrigin(process.env.SITE_URL, request.nextUrl);
  if (!origin || request.headers.get("origin") !== origin) return json({ error: "failed" }, 403);
  const secure = secureCookie(origin);

  const now = Math.floor(Date.now() / 1000);
  const link = unseal<Link>(request.cookies.get(LINE_LINK_COOKIE)?.value, "link", config.channelSecret, now);
  if (!link || typeof link.email !== "string" || typeof link.sub !== "string" || !LINE_SUB_RE.test(link.sub)) {
    return json({ error: "expired" });
  }

  const body = (await request.json().catch(() => null)) as { action?: unknown; code?: unknown } | null;
  if (body?.action === "resend") {
    const { error } = await createAnonClient().auth.signInWithOtp({ email: link.email, options: { shouldCreateUser: link.kind === "new" } });
    if (error) return json({ error: error.status === 429 ? "rate" : "failed" });
    return json({ ok: true });
  }
  if (body?.action !== "verify") return json({ error: "failed" }, 400);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!isValidOtpCode(code)) return json({ error: "format" });

  const responseHeaders: Record<string, string> = {};
  const supabase = await createClient({ responseHeaders });
  const { data, error } = await supabase.auth.verifyOtp({ email: link.email, token: code, type: "email" });
  const user = data?.user;
  if (error || !user) return json({ error: "code" });
  // 防呆：驗證通過的帳號必須是這個 Email；既有帳號的情況還要是查詢當下的那一個
  if ((user.email ?? "").toLowerCase() !== link.email.toLowerCase() || (link.kind === "existing" && link.uid && user.id !== link.uid)) {
    logLine("link", "user_mismatch");
    await supabase.auth.signOut({ scope: "local" });
    return json({ error: "failed" }, 409);
  }

  const { data: result, error: linkErr } = await createAdminClient().rpc("line_link_identity", { p_user_id: user.id, p_line_sub: link.sub });
  // 綁定失敗（例如這個帳號已綁定別的 LINE）不影響這次登入：Email 驗證碼已經證明是本人
  logLine("link", linkErr ? "rpc_error" : String(result));

  const path = await postLoginPath(supabase, isRole(link.role) ? link.role : null, safeNextPath(link.next));
  return clearLineCookie(json({ redirect: path }, 200, responseHeaders), LINE_LINK_COOKIE, secure);
}
