// 創作者的收款帳戶。規則與 SQL 的 set_my_payout_account（20261128000200_admin_money.sql）相同，改一邊要改另一邊：
// 銀行代碼 3 碼、分行代碼 4 碼（選填）、帳號 7–16 碼數字（空白與「-」會去掉）、戶名 1–40 字。
import { hasBadChar } from "@/lib/validation/brief";
import { cleanText } from "@/lib/validation/onboarding";

export const BANK_CODE_RE = /^[0-9]{3}$/;
export const BRANCH_CODE_RE = /^[0-9]{4}$/;
export const ACCOUNT_NUMBER_RE = /^[0-9]{7,16}$/;
export const ACCOUNT_NAME_MAX = 40;

export type PayoutAccountInput = { bankCode: string; branchCode: string; accountNumber: string; accountName: string };

/** 去掉空白（含全形空白）與「-」。 */
export function normalizeDigits(v: string): string {
  return v.replace(/[\s　-]/g, "");
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.slice(0, 200) : "";
}

export function parsePayoutAccountForm(fd: FormData): PayoutAccountInput {
  return {
    bankCode: normalizeDigits(str(fd, "bankCode")),
    branchCode: normalizeDigits(str(fd, "branchCode")),
    accountNumber: normalizeDigits(str(fd, "accountNumber")),
    accountName: cleanText(str(fd, "accountName")),
  };
}

export function validatePayoutAccount(i: PayoutAccountInput): Record<string, string> | null {
  const e: Record<string, string> = {};
  if (!BANK_CODE_RE.test(i.bankCode)) e.bankCode = "請填 3 碼銀行代碼（例如 812）";
  if (i.branchCode !== "" && !BRANCH_CODE_RE.test(i.branchCode)) e.branchCode = "分行代碼是 4 碼數字，不知道可以留空";
  if (!ACCOUNT_NUMBER_RE.test(i.accountNumber)) e.accountNumber = "請填 7–16 碼數字的帳號";
  if (i.accountName === "") e.accountName = "請填寫戶名";
  else if (hasBadChar(i.accountName)) e.accountName = "戶名含有不允許的特殊字元";
  else if ([...i.accountName].length > ACCOUNT_NAME_MAX) e.accountName = `戶名最多 ${ACCOUNT_NAME_MAX} 字`;
  return Object.keys(e).length > 0 ? e : null;
}

/** 列表與本人畫面只顯示末四碼。 */
export function maskAccount(last4: string): string {
  return `•••• ${last4}`;
}

/** 撥款畫面的完整帳號：每 4 碼空一格，方便對照轉帳。 */
export function formatAccountNumber(v: string): string {
  return v.replace(/(\d{4})(?=\d)/g, "$1 ");
}
