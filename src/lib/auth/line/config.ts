// LINE 登入的設定（做法 B：網站自己的 LINE 路由）。Channel secret 只在伺服器端；不可以加 NEXT_PUBLIC_ 前綴。

export const LINE_ISSUER = "https://access.line.me";
export const LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
export const LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
export const LINE_SCOPE = "openid profile email";
export const LINE_CALLBACK_PATH = "/auth/line/callback";
/** 兩個 LINE 暫存 cookie 的路徑：只會送到 /auth/line/*。 */
export const LINE_COOKIE_PATH = "/auth/line";
export const LINE_FLOW_COOKIE = "kl_line_flow";
export const LINE_LINK_COOKIE = "kl_line_link";
/** 登入流程與「輸入驗證碼綁定」的有效時間（秒） */
export const LINE_COOKIE_TTL = 600;

export type LineConfig = { channelId: string; channelSecret: string };
type Env = Record<string, string | undefined>;

/** 按鈕要不要顯示（build 時寫進 client bundle）。 */
export function lineButtonEnabled(env: Env = process.env): boolean {
  return env.NEXT_PUBLIC_LINE_AUTH_ENABLED === "true";
}

/** 伺服器端設定：按鈕開關、Channel ID（數字）、Channel secret 都要有，才算已設定。 */
export function readLineConfig(env: Env = process.env): LineConfig | null {
  if (!lineButtonEnabled(env)) return null;
  const channelId = (env.LINE_CHANNEL_ID ?? "").trim();
  const channelSecret = (env.LINE_CHANNEL_SECRET ?? "").trim();
  if (!/^[0-9]{6,20}$/.test(channelId)) return null;
  if (channelSecret.length < 16) return null;
  return { channelId, channelSecret };
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * 組 LINE redirect_uri 用的網站來源。一律來自伺服器設定：有 SITE_URL 就用它（https，本機可以是 http://localhost）；
 * 沒有 SITE_URL 時只接受本機（localhost／127.0.0.1）的請求來源。正式環境沒設 SITE_URL 就不提供 LINE 登入，
 * 不會拿 Host 等使用者可控的標頭組網址。
 */
export function lineOrigin(siteUrl: string | undefined, requestUrl: URL): string | null {
  if (siteUrl && siteUrl.trim()) {
    let u: URL;
    try {
      u = new URL(siteUrl.trim());
    } catch {
      return null;
    }
    if (u.pathname !== "/" || u.search || u.hash || u.username || u.password) return null;
    if (u.protocol === "https:") return u.origin;
    if (u.protocol === "http:" && isLocalHost(u.hostname)) return u.origin;
    return null;
  }
  if ((requestUrl.protocol === "http:" || requestUrl.protocol === "https:") && isLocalHost(requestUrl.hostname)) return requestUrl.origin;
  return null;
}

/** cookie 的 Secure：https 一律加；本機 http 不能加（瀏覽器會丟掉）。 */
export function secureCookie(origin: string): boolean {
  return origin.startsWith("https:");
}
