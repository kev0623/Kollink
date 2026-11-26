import { describe, expect, it } from "vitest";
import { MERCHANT_TRADE_NO_RE, NOTIFY_FIELDS, parseAtmInfo, parseTradeAmt, pickNotifyFields } from "./notify-fields";

describe("pickNotifyFields", () => {
  it("只留白名單欄位", () => {
    const raw = pickNotifyFields({ TradeNo: "T1", RtnCode: "1", card4no: "2222", card6no: "431195", CheckMacValue: "X", Evil: "1" });
    expect(raw).toEqual({ TradeNo: "T1", RtnCode: "1" });
  });
  it("每個值最多 200 字", () => {
    expect(pickNotifyFields({ RtnMsg: "a".repeat(500) }).RtnMsg).toHaveLength(200);
  });
  it("白名單與 SQL payment_raw_whitelist 相同（不含 source）", () => {
    expect([...NOTIFY_FIELDS].sort()).toEqual([
      "BankCode", "ExpireDate", "MerchantID", "MerchantTradeNo", "PaymentDate", "PaymentType", "PaymentTypeChargeFee",
      "RtnCode", "RtnMsg", "SimulatePaid", "StoreID", "TradeAmt", "TradeDate", "TradeNo", "vAccount",
    ].sort());
  });
});

describe("parseTradeAmt", () => {
  it.each([["4500", 4500], ["1", 1]])("%s → %d", (v, n) => expect(parseTradeAmt(v)).toBe(n));
  it.each(["45.5", "0", "-4500", "4500.0", "1e3", " 4500", "", undefined])("%j → null", (v) => expect(parseTradeAmt(v)).toBeNull());
});

describe("MERCHANT_TRADE_NO_RE", () => {
  it("英數字 1–20", () => {
    expect(MERCHANT_TRADE_NO_RE.test("KL2611270123456789AB")).toBe(true);
    expect(MERCHANT_TRADE_NO_RE.test("KL2611270123456789ABC")).toBe(false);
    expect(MERCHANT_TRADE_NO_RE.test("KL-1")).toBe(false);
  });
});

describe("parseAtmInfo", () => {
  it("轉成 YYYY-MM-DD", () => {
    expect(parseAtmInfo({ BankCode: "812", vAccount: "9103522850", ExpireDate: "2026/11/30" }))
      .toEqual({ bankCode: "812", vAccount: "9103522850", expireDate: "2026-11-30" });
  });
  it("不存在的日期、格式不對都是 null", () => {
    expect(parseAtmInfo({ BankCode: "812", vAccount: "9103522850", ExpireDate: "2026/02/30" })).toBeNull();
    expect(parseAtmInfo({ BankCode: "8120", vAccount: "9103522850", ExpireDate: "2026/11/30" })).toBeNull();
    expect(parseAtmInfo({ BankCode: "812", vAccount: "12345", ExpireDate: "2026/11/30" })).toBeNull();
    expect(parseAtmInfo({})).toBeNull();
  });
});
