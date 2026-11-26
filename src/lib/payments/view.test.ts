import { describe, expect, it } from "vitest";
import { atmDeadlineLabel, formatVAccount, summarizePayments, summaryForSide, type PaymentRow } from "./view";

const NOW = Date.parse("2026-11-27T04:00:00Z"); // 台灣 11/27 12:00
const row = (o: Partial<PaymentRow>): PaymentRow => ({
  status: "pending", payment_method: "credit", provider_env: null, amount_twd: 4500,
  atm_bank_code: null, atm_v_account: null, atm_expire_date: null, refund_required: false,
  created_at: "2026-11-27T03:50:00Z", ...o,
});

describe("summarizePayments", () => {
  it("沒有付款單", () => {
    expect(summarizePayments([], NOW)).toEqual({ testPaid: false, atm: null, recentCreditPending: false, refundPending: false });
  });
  it("最新一張是還沒到期的 ATM：顯示轉帳資訊（到期日當天仍有效）", () => {
    const atm = row({ payment_method: "atm", atm_bank_code: "812", atm_v_account: "9103522850", atm_expire_date: "2026-11-27" });
    expect(summarizePayments([atm], NOW).atm).toEqual({ bankCode: "812", vAccount: "9103522850", expireDate: "2026-11-27", amount: 4500 });
  });
  it("ATM 已過期、還沒取號、或最新一張不是 ATM：不顯示", () => {
    const expired = row({ payment_method: "atm", atm_bank_code: "812", atm_v_account: "9103522850", atm_expire_date: "2026-11-26" });
    const noInfo = row({ payment_method: "atm" });
    const valid = row({ payment_method: "atm", atm_bank_code: "812", atm_v_account: "9103522850", atm_expire_date: "2026-11-30" });
    expect(summarizePayments([expired], NOW).atm).toBeNull();
    expect(summarizePayments([noInfo], NOW).atm).toBeNull();
    expect(summarizePayments([row({}), valid], NOW).atm).toBeNull();
  });
  it("30 分鐘內的信用卡待付款單：確認中", () => {
    expect(summarizePayments([row({})], NOW).recentCreditPending).toBe(true);
    expect(summarizePayments([row({ created_at: "2026-11-27T03:20:00Z" })], NOW).recentCreditPending).toBe(false);
  });
  it("測試付款與需退款", () => {
    const s = summarizePayments([row({ status: "paid", provider_env: "stage", refund_required: true })], NOW);
    expect(s.testPaid).toBe(true);
    expect(s.refundPending).toBe(true);
    expect(summarizePayments([row({ status: "paid", provider_env: "prod" })], NOW).testPaid).toBe(false);
  });
});

describe("格式", () => {
  it("虛擬帳號每 4 碼空一格", () => {
    expect(formatVAccount("9103522850123456")).toBe("9103 5228 5012 3456");
    expect(formatVAccount("9103522850")).toBe("9103 5228 50");
  });
  it("到期日", () => expect(atmDeadlineLabel("2026-11-30")).toBe("2026/11/30 23:59 前"));
});

describe("summaryForSide", () => {
  const withAtm = { testPaid: true, recentCreditPending: false, refundPending: true,
    atm: { bankCode: "812", vAccount: "9103522850123456", expireDate: "2026-11-30", amount: 4500 } };
  it("創作者端拿不到 ATM 資料，其他欄位保留", () => {
    const s = summaryForSide(withAtm, "creator");
    expect(s.atm).toBeNull();
    expect(JSON.stringify(s)).not.toContain("9103522850123456");
    expect(s.testPaid).toBe(true);
    expect(s.refundPending).toBe(true);
  });
  it("品牌端保留 ATM", () => {
    expect(summaryForSide(withAtm, "brand").atm).toEqual(withAtm.atm);
  });
});
