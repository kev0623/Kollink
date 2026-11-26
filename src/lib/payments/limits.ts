// 線上付款的固定數字。改動時 SQL（20261127000100_payment_orders.sql 的 create_payment_order）要一起改。

/** 單筆線上付款上限（新台幣）。實際限額以綠界合約為準，上線前確認。超過時品牌要聯絡平台（人工處理）。 */
export const PAYMENT_MAX_TWD = 200_000;

/** ATM 虛擬帳號的繳費天數（綠界 ExpireDate：1–60，預設 3；到期日當天 23:59 截止）。 */
export const ATM_EXPIRE_DAYS = 3;

/** 信用卡付款後，綠界通知可能晚幾分鐘到：建單後這段時間內顯示「確認中」提示。 */
export const RECENT_ORDER_MS = 30 * 60_000;

/** 金額超過線上付款上限：不顯示信用卡／ATM 付款，改請品牌聯絡平台線下付款。 */
export function requiresOfflinePayment(amount: number): boolean {
  return amount > PAYMENT_MAX_TWD;
}
