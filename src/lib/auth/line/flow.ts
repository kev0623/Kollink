import { createHash } from "node:crypto";
import { LINE_AUTHORIZE_URL, LINE_SCOPE, LINE_TOKEN_URL } from "./config";

/** 授權網址（PKCE S256＋state＋nonce）。 */
export function buildAuthorizeUrl(a: { channelId: string; redirectUri: string; state: string; nonce: string; codeVerifier: string }): string {
  const u = new URL(LINE_AUTHORIZE_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", a.channelId);
  u.searchParams.set("redirect_uri", a.redirectUri);
  u.searchParams.set("state", a.state);
  u.searchParams.set("scope", LINE_SCOPE);
  u.searchParams.set("nonce", a.nonce);
  u.searchParams.set("code_challenge", createHash("sha256").update(a.codeVerifier).digest("base64url"));
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

/** 用授權碼換 ID token（伺服器對伺服器）。失敗回 null，不回傳 LINE 的錯誤內容。 */
export async function exchangeLineCode(
  a: { code: string; redirectUri: string; channelId: string; channelSecret: string; codeVerifier: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ idToken: string } | { error: string }> {
  if (!a.code || a.code.length > 512) return { error: "code" };
  try {
    const res = await fetchImpl(LINE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: a.code,
        redirect_uri: a.redirectUri,
        client_id: a.channelId,
        client_secret: a.channelSecret,
        code_verifier: a.codeVerifier,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { error: `http_${res.status}` };
    const body = (await res.json()) as { id_token?: unknown };
    return typeof body.id_token === "string" && body.id_token ? { idToken: body.id_token } : { error: "no_id_token" };
  } catch {
    return { error: "network" };
  }
}

export type LineAccountDecision =
  | { kind: "signin"; userId: string }
  | { kind: "no_email" }
  | { kind: "verify_existing"; userId: string }
  | { kind: "verify_new" };

/**
 * 帳號判斷（LINE 沒有 email_verified，所以 Email 只用來找帳號，不直接登入）：
 * 1. 這個 LINE 已經綁定帳號 → 直接登入（綁定當初已經用 Email 驗證碼確認過）。
 * 2. 沒綁定、LINE 沒給 Email → 不建立帳號，請使用者允許提供 Email 或改用 Email 登入。
 * 3. 沒綁定、Email 已有帳號 → 寄驗證碼到該 Email，通過後才綁定（不能只憑 LINE 給的 Email 登入別人的帳號）。
 * 4. 沒綁定、Email 沒有帳號 → 一樣先寄驗證碼，通過後建立帳號並綁定（避免「先搶註」：別人用填了你 Email 的 LINE 先建好帳號）。
 */
export function resolveLineAccount(a: { linkedUserId: string | null; email: string | null; emailUserId: string | null }): LineAccountDecision {
  if (a.linkedUserId) return { kind: "signin", userId: a.linkedUserId };
  if (!a.email) return { kind: "no_email" };
  if (a.emailUserId) return { kind: "verify_existing", userId: a.emailUserId };
  return { kind: "verify_new" };
}
