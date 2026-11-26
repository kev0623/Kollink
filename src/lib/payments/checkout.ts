import "server-only";
// 綠界 AioCheckOut 的表單參數（伺服器組好、含 CheckMacValue；瀏覽器只負責 POST 過去）。
// 參數說明：https://developers.ecpay.com.tw/?p=2862（產生訂單）、https://developers.ecpay.com.tw/?p=2872（ATM）
import { caseCode } from "@/lib/collabs/view";
import { SITE_NAME } from "@/lib/site";
import { computeCheckMacValue } from "./ecpay";
import { ATM_EXPIRE_DAYS, PAYMENT_MAX_TWD } from "./limits";

const TRADE_NO = /^[A-Za-z0-9]{20}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PaymentMethod = "credit" | "atm";

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return v === "credit" || v === "atm";
}

export type CheckoutForm = { action: string; fields: Record<string, string> };

const TW_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

/** 綠界 MerchantTradeDate：台灣時間 yyyy/MM/dd HH:mm:ss。 */
export function ecpayTradeDate(d: Date): string {
  const p = Object.fromEntries(TW_PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

type Input = {
  config: { merchantId: string; hashKey: string; hashIV: string; siteUrl: string; checkoutUrl: string };
  merchantTradeNo: string;
  amountTwd: number;
  method: PaymentMethod;
  collabId: string;
  createdAt: Date;
};

export function buildCheckoutForm({ config, merchantTradeNo, amountTwd, method, collabId, createdAt }: Input): CheckoutForm {
  if (!Number.isSafeInteger(amountTwd) || amountTwd <= 0 || amountTwd > PAYMENT_MAX_TWD) throw new Error("invalid amount");
  if (typeof merchantTradeNo !== "string" || !TRADE_NO.test(merchantTradeNo)) throw new Error("invalid merchant trade no");
  if (typeof collabId !== "string" || !UUID.test(collabId)) throw new Error("invalid collab id");
  const site = config.siteUrl;
  const fields: Record<string, string> = {
    MerchantID: config.merchantId,
    MerchantTradeNo: merchantTradeNo,
    MerchantTradeDate: ecpayTradeDate(createdAt),
    PaymentType: "aio",
    TotalAmount: String(amountTwd),
    // 不放使用者輸入的文字（案名可能有 emoji、#），只用固定文字與案號
    TradeDesc: `${SITE_NAME} 合作案款項`,
    ItemName: `${SITE_NAME} 合作案 ${caseCode(collabId)}`,
    ReturnURL: `${site}/api/payments/ecpay/notify`,
    ChoosePayment: method === "credit" ? "Credit" : "ATM",
    EncryptType: "1",
    NeedExtraPaidInfo: "N",
    ClientBackURL: `${site}/brand/collabs/${collabId}`,
  };
  if (method === "credit") {
    // 付款完成後瀏覽器帶結果 POST 回來；route 不相信內容，只把人導回合作案詳情
    fields.OrderResultURL = `${site}/api/payments/ecpay/result?c=${collabId}`;
  } else {
    fields.ExpireDate = String(ATM_EXPIRE_DAYS);
    fields.PaymentInfoURL = `${site}/api/payments/ecpay/payment-info`;
  }
  fields.CheckMacValue = computeCheckMacValue(fields, config.hashKey, config.hashIV);
  return { action: config.checkoutUrl, fields };
}
