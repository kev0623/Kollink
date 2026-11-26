import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAnonClient } from "@/lib/supabase/anon";
import { relativeRedirect } from "@/lib/auth/relative-redirect";
import { postLoginPath } from "@/lib/auth/after-login";
import { isRole } from "@/lib/auth/post-login";
import { safeNextPath } from "@/lib/auth/safe-next";
import {
  LINE_CALLBACK_PATH, LINE_COOKIE_TTL, LINE_FLOW_COOKIE, LINE_LINK_COOKIE, lineOrigin, readLineConfig, secureCookie,
} from "@/lib/auth/line/config";
import { safeEqual, seal, unseal } from "@/lib/auth/line/sealed-cookie";
import { verifyLineIdToken } from "@/lib/auth/line/id-token";
import { exchangeLineCode, resolveLineAccount } from "@/lib/auth/line/flow";
import { clearLineCookie, lineCookieOptions, logLine, toLoginError } from "@/lib/auth/line/http";
import type { LineErrorCode } from "@/lib/auth/line/messages";

type Flow = { state: string; nonce: string; cv: string; next: string | null; role: string | null };

/**
 * GET /auth/line/callback：LINE 授權後導回。state（固定時間比較、只能用一次）→ 換 token → 自己驗 ID token →
 * 依 resolveLineAccount 決定：已綁定就登入；否則寄 Email 驗證碼、通過後才綁定（/auth/line/link）。
 */
export async function GET(request: NextRequest) {
  const config = readLineConfig();
  if (!config) return toLoginError("line_unavailable");
  const origin = lineOrigin(process.env.SITE_URL, request.nextUrl);
  if (!origin) return toLoginError("line_unavailable");
  const secure = secureCookie(origin);
  // 暫存 cookie 一律只能用一次：不論結果都清掉
  const done = (res: NextResponse) => clearLineCookie(res, LINE_FLOW_COOKIE, secure);
  const fail = (code: LineErrorCode) => done(toLoginError(code));

  const now = Math.floor(Date.now() / 1000);
  const flow = unseal<Flow>(request.cookies.get(LINE_FLOW_COOKIE)?.value, "flow", config.channelSecret, now);
  const params = request.nextUrl.searchParams;
  const state = params.get("state") ?? "";
  if (!flow || typeof flow.state !== "string" || !state || !safeEqual(state, flow.state)) {
    logLine("callback", flow ? "state_mismatch" : "no_flow_cookie");
    return fail("line_state");
  }
  const next = safeNextPath(flow.next);
  const role = isRole(flow.role) ? flow.role : null;

  const lineError = params.get("error");
  if (lineError) {
    logLine("callback", lineError === "access_denied" ? "cancelled" : "authorize_error");
    return fail(lineError === "access_denied" ? "line_cancelled" : "line_failed");
  }

  const redirectUri = `${origin}${LINE_CALLBACK_PATH}`;
  const token = await exchangeLineCode({
    code: params.get("code") ?? "", redirectUri, channelId: config.channelId, channelSecret: config.channelSecret, codeVerifier: flow.cv,
  });
  if ("error" in token) {
    logLine("token", token.error);
    return fail("line_failed");
  }
  const verified = verifyLineIdToken(token.idToken, {
    channelId: config.channelId, channelSecret: config.channelSecret, nonce: flow.nonce, nowSec: now,
  });
  if (!verified.ok) {
    logLine("id_token", verified.reason);
    return fail("line_failed");
  }
  const { sub, email } = verified.claims;

  const admin = createAdminClient();
  const { data: rows, error: lookupErr } = await admin.rpc("line_login_lookup", { p_line_sub: sub, p_email: email ?? "" });
  if (lookupErr) {
    logLine("lookup", lookupErr.code ?? "error");
    return fail("line_failed");
  }
  const row = Array.isArray(rows) ? rows[0] : rows;
  const decision = resolveLineAccount({ linkedUserId: row?.linked_user_id ?? null, email, emailUserId: row?.email_user_id ?? null });

  if (decision.kind === "no_email") return fail("line_no_email");

  if (decision.kind === "signin") {
    const { data: u, error: userErr } = await admin.auth.admin.getUserById(decision.userId);
    if (userErr || !u.user?.email) {
      logLine("signin", "user_lookup");
      return fail("line_failed");
    }
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
    if (linkErr || !link.properties?.hashed_token) {
      logLine("signin", "generate_link");
      return fail("line_failed");
    }
    const responseHeaders: Record<string, string> = {};
    const supabase = await createClient({ responseHeaders });
    const { data: sess, error: otpErr } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
    if (otpErr || sess.user?.id !== decision.userId) {
      logLine("signin", "verify");
      return fail("line_failed");
    }
    const path = await postLoginPath(supabase, role, next);
    return done(relativeRedirect(path, 303, { ...responseHeaders, "Cache-Control": "private, no-store" }));
  }

  // 尚未綁定：寄 Email 驗證碼（沿用 Email 登入的信件範本）；驗證通過後由 /auth/line/link 綁定
  const kind = decision.kind === "verify_existing" ? "existing" : "new";
  const { error: otpErr } = await createAnonClient().auth.signInWithOtp({
    email: email as string,
    options: { shouldCreateUser: kind === "new" },
  });
  if (otpErr) {
    logLine("send_otp", String(otpErr.status ?? "error"));
    return fail(otpErr.status === 429 ? "line_otp_rate" : "line_failed");
  }
  const linkCookie = seal(
    "link",
    { sub, email, kind, uid: decision.kind === "verify_existing" ? decision.userId : null, next, role },
    config.channelSecret,
    now + LINE_COOKIE_TTL,
  );
  const res = done(relativeRedirect(`/login?line=${kind}`, 303, { "Cache-Control": "private, no-store" }));
  res.cookies.set(LINE_LINK_COOKIE, linkCookie, lineCookieOptions(secure));
  return res;
}
