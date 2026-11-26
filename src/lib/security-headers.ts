// 全站安全標頭（next.config.ts 的 headers() 使用）。放在這裡是為了能單元測試產生的 CSP 字串。
// 這個檔案不能用 "@/..." 路徑別名：next.config.ts 在 Next 讀取設定時直接 import 它。

/** 綠界付款頁（AioCheckOut 是整頁 POST 表單）。 */
export const ECPAY_ORIGINS = ["https://payment.ecpay.com.tw", "https://payment-stage.ecpay.com.tw"] as const;

export type CspOptions = {
  /** NEXT_PUBLIC_SUPABASE_URL（正式環境是 https://<ref>.supabase.co，本機是 http://127.0.0.1:54321）。沒設定時不放行任何 Supabase 網域。 */
  supabaseUrl?: string;
  /** next dev：React 除錯需要 eval，HMR 需要 websocket */
  isDev?: boolean;
  /** Vercel 預覽環境：預覽工具列需要 vercel.live */
  vercelPreview?: boolean;
};

/** 從 Supabase URL 推導 http(s) 來源與對應的 ws(s) 來源；網址不合法回傳 null。 */
export function supabaseOrigins(url: string | undefined): { http: string; ws: string; secure: boolean } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const secure = u.protocol === "https:";
    return { http: u.origin, ws: `${secure ? "wss" : "ws"}://${u.host}`, secure };
  } catch {
    return null;
  }
}

/**
 * 靜態 CSP（不用 nonce）：cacheComponents／PPR 的靜態外殼不能每個請求產生新的 nonce，所以 script-src 需要 'unsafe-inline'
 * （Next 的內嵌 flight 腳本、之後的主題切換腳本）。其餘指令（frame-ancestors、form-action、base-uri、object-src、connect-src）
 * 仍然提供防護；connect-src 限制被竊取的 token 能送去哪裡。
 * 之後 UI 升級加入 three.js：不需要 eval；需要 Web Worker 時 worker-src 已允許 'self' blob:。
 */
export function buildCsp({ supabaseUrl, isDev = false, vercelPreview = false }: CspOptions = {}): string {
  const sb = supabaseOrigins(supabaseUrl);
  const vercelLive = vercelPreview ? ["https://vercel.live"] : [];
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), ...vercelLive]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    // Storage 的公開與簽名圖片；data: 給 MFA 的 QR Code 與 OG；blob: 給上傳預覽
    ["img-src", ["'self'", "data:", "blob:", ...(sb ? [sb.http] : []), ...vercelLive]],
    ["media-src", ["'self'", "blob:", ...(sb ? [sb.http] : [])]],
    ["font-src", ["'self'", ...vercelLive]],
    // Supabase REST／Auth／Storage（https）與 Realtime（wss）
    ["connect-src", ["'self'", ...(sb ? [sb.http, sb.ws] : []), ...(isDev ? ["ws://localhost:*", "ws://127.0.0.1:*"] : []), ...vercelLive]],
    ["worker-src", ["'self'", "blob:"]],
    ["frame-src", vercelPreview ? ["https://vercel.live"] : ["'none'"]],
    // Server Actions 與綠界 AioCheckOut 的 POST 表單（瀏覽器會連同表單送出後的導向一起檢查）
    ["form-action", ["'self'", ...ECPAY_ORIGINS]],
    ["frame-ancestors", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["object-src", ["'none'"]],
  ];
  const parts = directives.map(([name, values]) => `${name} ${values.join(" ")}`);
  // 本機的 Supabase 是 http://127.0.0.1：upgrade-insecure-requests 會把它升級成 https 而連不上
  if (!isDev && (!sb || sb.secure)) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

export type HeaderEntry = { key: string; value: string };

export function securityHeaders(options: CspOptions = {}): HeaderEntry[] {
  return [
    { key: "Content-Security-Policy", value: buildCsp(options) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), accelerometer=(), gyroscope=(), magnetometer=(), midi=()",
    },
  ];
}
