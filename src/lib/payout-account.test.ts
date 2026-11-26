import { describe, expect, it } from "vitest";
import { formatAccountNumber, maskAccount, normalizeDigits, parsePayoutAccountForm, validatePayoutAccount } from "./payout-account";

function form(o: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
  return f;
}

describe("收款帳戶", () => {
  it("去掉空白（含全形）與 -", () => {
    expect(normalizeDigits(" 1234-5678　9012 ")).toBe("123456789012");
  });
  it("解析與驗證：與 set_my_payout_account 相同的規則", () => {
    const ok = parsePayoutAccountForm(form({ bankCode: "812", branchCode: "", accountNumber: "1234-5678-9012", accountName: " 王小美 " }));
    expect(ok).toEqual({ bankCode: "812", branchCode: "", accountNumber: "123456789012", accountName: "王小美" });
    expect(validatePayoutAccount(ok)).toBeNull();
    expect(validatePayoutAccount({ bankCode: "81", branchCode: "12", accountNumber: "123456", accountName: "" })).toEqual({
      bankCode: "請填 3 碼銀行代碼（例如 812）",
      branchCode: "分行代碼是 4 碼數字，不知道可以留空",
      accountNumber: "請填 7–16 碼數字的帳號",
      accountName: "請填寫戶名",
    });
    expect(validatePayoutAccount({ ...ok, accountNumber: "1".repeat(17) })).toHaveProperty("accountNumber");
    expect(validatePayoutAccount({ ...ok, accountName: "王‮美" })).toEqual({ accountName: "戶名含有不允許的特殊字元" });
    expect(validatePayoutAccount({ ...ok, accountName: "名".repeat(41) })).toEqual({ accountName: "戶名最多 40 字" });
  });
  it("缺欄位當成空字串", () => {
    expect(parsePayoutAccountForm(form({}))).toEqual({ bankCode: "", branchCode: "", accountNumber: "", accountName: "" });
  });
  it("遮罩與分組", () => {
    expect(maskAccount("9012")).toBe("•••• 9012");
    expect(formatAccountNumber("123456789012")).toBe("1234 5678 9012");
  });
});
