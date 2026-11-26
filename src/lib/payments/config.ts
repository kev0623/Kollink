import "server-only";

// 綠界設定只從伺服器端環境變數讀（絕不加 NEXT_PUBLIC_）。少任何一個、或組合不安全時回傳 null：
// 付款按鈕停用、通知 route 回 500（綠界會重送，設定補上後就能處理）。

export type EcpayEnv = "stage" | "prod";

export type EcpayConfig = {
  env: EcpayEnv;
  merchantId: string;
  hashKey: string;
  hashIV: string;
  /** 站台網址（只有 origin，例如 https://kollink.vercel.app），用來組 ReturnURL 等回呼網址 */
  siteUrl: string;
  checkoutUrl: string;
};

/** 綠界全方位金流 AioCheckOut V5（https://developers.ecpay.com.tw/?p=2862） */
export const ECPAY_CHECKOUT_URL: Record<EcpayEnv, string> = {
  stage: "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5",
  prod: "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5",
};

/** 綠界公開的測試商店（https://developers.ecpay.com.tw/2856/）：金鑰是公開的，只能用在 stage。 */
export const ECPAY_STAGE_MERCHANT_ID = "3002607";

type Env = Record<string, string | undefined>;

export function readEcpayConfig(env: Env = process.env): EcpayConfig | null {
  const mode = env.ECPAY_ENV;
  if (mode !== "stage" && mode !== "prod") return null;
  const merchantId = env.ECPAY_MERCHANT_ID ?? "";
  const hashKey = env.ECPAY_HASH_KEY ?? "";
  const hashIV = env.ECPAY_HASH_IV ?? "";
  if (!/^[0-9]{1,10}$/.test(merchantId) || !hashKey || !hashIV) return null;
  // 正式模式不能用公開的測試商店（否則等於任何人都能偽造付款通知）
  if (mode === "prod" && merchantId === ECPAY_STAGE_MERCHANT_ID) return null;
  // 使用者決定（2026-11-26）：Vercel Production 拿到綠界正式金鑰前不開付款；stage 或測試商店一律視為未設定
  if (env.VERCEL_ENV === "production" && (mode !== "prod" || merchantId === ECPAY_STAGE_MERCHANT_ID)) return null;

  let url: URL;
  try {
    url = new URL(env.SITE_URL ?? "");
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(mode === "stage" && local && url.protocol === "http:")) return null;
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) return null;

  return { env: mode, merchantId, hashKey, hashIV, siteUrl: url.origin, checkoutUrl: ECPAY_CHECKOUT_URL[mode] };
}

export type PaymentAvailability = { enabled: boolean; env: EcpayEnv | null };

/** 給畫面用（不含金鑰）：能不能線上付款、是不是測試模式。 */
export function paymentAvailability(env: Env = process.env): PaymentAvailability {
  const c = readEcpayConfig(env);
  return c ? { enabled: true, env: c.env } : { enabled: false, env: null };
}
