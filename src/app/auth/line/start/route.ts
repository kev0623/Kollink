import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import { isRole } from "@/lib/auth/post-login";
import { LINE_CALLBACK_PATH, LINE_COOKIE_TTL, LINE_FLOW_COOKIE, lineOrigin, readLineConfig, secureCookie } from "@/lib/auth/line/config";
import { randomToken, seal } from "@/lib/auth/line/sealed-cookie";
import { buildAuthorizeUrl } from "@/lib/auth/line/flow";
import { lineCookieOptions, logLine, toLoginError } from "@/lib/auth/line/http";

/**
 * GET /auth/line/start?next=&role=：產生 state、nonce、PKCE，加密存進 10 分鐘的 cookie，導到 LINE 授權頁。
 * 除了設定這個暫存 cookie 之外沒有任何副作用（不建帳號、不改 session）。
 */
export async function GET(request: NextRequest) {
  const config = readLineConfig();
  if (!config) return toLoginError("line_unavailable");
  const origin = lineOrigin(process.env.SITE_URL, request.nextUrl);
  if (!origin) {
    logLine("start", "no_trusted_origin");
    return toLoginError("line_unavailable");
  }

  const nextRaw = request.nextUrl.searchParams.get("next");
  const next = safeNextPath(nextRaw);
  const roleRaw = request.nextUrl.searchParams.get("role");
  const role = isRole(roleRaw) ? roleRaw : null;

  // cookie 要設在回呼網址的同一個主機上（例如本機用 127.0.0.1 開、SITE_URL 是 localhost）：先換到正確的主機再開始
  if (request.nextUrl.origin !== origin) {
    const q = new URLSearchParams();
    if (next) q.set("next", next);
    if (role) q.set("role", role);
    const s = q.toString();
    const canonical = NextResponse.redirect(`${origin}/auth/line/start${s ? `?${s}` : ""}`, 303);
    canonical.headers.set("Cache-Control", "private, no-store");
    return canonical;
  }

  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomToken();
  const now = Math.floor(Date.now() / 1000);
  const cookie = seal("flow", { state, nonce, cv: codeVerifier, next, role }, config.channelSecret, now + LINE_COOKIE_TTL);

  const res = NextResponse.redirect(
    buildAuthorizeUrl({ channelId: config.channelId, redirectUri: `${origin}${LINE_CALLBACK_PATH}`, state, nonce, codeVerifier }),
    303,
  );
  res.headers.set("Cache-Control", "private, no-store");
  res.cookies.set(LINE_FLOW_COOKIE, cookie, lineCookieOptions(secureCookie(origin)));
  return res;
}
