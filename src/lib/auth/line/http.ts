import "server-only";
import { NextResponse } from "next/server";
import { relativeRedirect } from "@/lib/auth/relative-redirect";
import { LINE_COOKIE_PATH, LINE_COOKIE_TTL } from "./config";
import type { LineErrorCode } from "./messages";

/** LINE 暫存 cookie 的屬性：HttpOnly、SameSite=Lax（LINE 導回來是頂層 GET，Lax 會帶）、只送到 /auth/line。 */
export function lineCookieOptions(secure: boolean, maxAge = LINE_COOKIE_TTL) {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: LINE_COOKIE_PATH, maxAge };
}

export function clearLineCookie(res: NextResponse, name: string, secure: boolean): NextResponse {
  res.cookies.set(name, "", lineCookieOptions(secure, 0));
  return res;
}

/** 回登入頁並顯示白名單內的錯誤代碼。no-store：帶 Set-Cookie 的導向不能被快取。 */
export function toLoginError(code: LineErrorCode): NextResponse {
  return relativeRedirect(`/login?error=${code}`, 303, { "Cache-Control": "private, no-store" });
}

/** 只記錄階段與原因代碼，不記錄 Email、LINE ID、授權碼或 token。 */
export function logLine(stage: string, reason: string): void {
  console.error(`[line-login] ${stage}: ${reason}`);
}
