// 綠界通知的欄位處理（付款結果 ReturnURL、ATM 取號 PaymentInfoURL 共用）。
import { isIsoDate } from "@/lib/briefs/dates";

/**
 * 存進 payments.raw_notify／payment_anomalies.raw 的白名單。
 * 與 SQL public.payment_raw_whitelist 相同（改一邊要改另一邊）：不保存 card4no、card6no、ATMAccNo 等付款人資料。
 */
export const NOTIFY_FIELDS = [
  "MerchantID", "MerchantTradeNo", "StoreID", "RtnCode", "RtnMsg", "TradeNo", "TradeAmt",
  "PaymentDate", "PaymentType", "PaymentTypeChargeFee", "TradeDate", "SimulatePaid",
  "BankCode", "vAccount", "ExpireDate",
] as const;

export function pickNotifyFields(params: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of NOTIFY_FIELDS) if (Object.hasOwn(params, k)) out[k] = params[k].slice(0, 200);
  return out;
}

/** 付款單編號：與 payments.merchant_trade_no 的 check 相同。 */
export const MERCHANT_TRADE_NO_RE = /^[A-Za-z0-9]{1,20}$/;

/** 金額：純整數、1 起（不接受 4500.0、1e3、前後空白）。 */
export function parseTradeAmt(v: string | undefined): number | null {
  return /^[1-9]\d{0,8}$/.test(v ?? "") ? Number(v) : null;
}

export type AtmInfo = { bankCode: string; vAccount: string; expireDate: string };

/** ATM 取號結果：BankCode 3 碼、vAccount 6–16 碼數字、ExpireDate yyyy/MM/dd（可能帶時間）→ YYYY-MM-DD。 */
export function parseAtmInfo(params: Record<string, string>): AtmInfo | null {
  const bankCode = params.BankCode ?? "";
  const vAccount = params.vAccount ?? "";
  const m = /^(\d{4})\/(\d{2})\/(\d{2})(?: \d{2}:\d{2}(?::\d{2})?)?$/.exec(params.ExpireDate ?? "");
  if (!/^\d{3}$/.test(bankCode) || !/^\d{6,16}$/.test(vAccount) || !m) return null;
  const expireDate = `${m[1]}-${m[2]}-${m[3]}`;
  return isIsoDate(expireDate) ? { bankCode, vAccount, expireDate } : null;
}
