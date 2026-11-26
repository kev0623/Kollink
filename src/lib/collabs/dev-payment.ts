/** 本機「標記已付款」用的付款單編號：DEV + 17 位大寫十六進位（符合 payments.merchant_trade_no 的 ^[A-Za-z0-9]{1,20}$）。 */
export function devMerchantTradeNo(uuid: string = crypto.randomUUID()): string {
  return `DEV${uuid.replaceAll("-", "").slice(0, 17).toUpperCase()}`;
}
