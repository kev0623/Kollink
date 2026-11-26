"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { parsePayoutAccountForm, validatePayoutAccount } from "@/lib/payout-account";

export type PayoutFormState = { ok?: boolean; fieldErrors?: Record<string, string>; formError?: string };

const FIELD_BY_DB: Record<string, string> = {
  "invalid bank_code": "bankCode",
  "invalid branch_code": "branchCode",
  "invalid account_number": "accountNumber",
  "invalid account_name": "accountName",
};

/** 創作者設定收款帳戶（set_my_payout_account；完整帳號不會再回傳給瀏覽器）。 */
export async function savePayoutAccountAction(_prev: PayoutFormState, fd: FormData): Promise<PayoutFormState> {
  await requireRole("creator");
  const input = parsePayoutAccountForm(fd);
  const fieldErrors = validatePayoutAccount(input);
  if (fieldErrors) return { fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_payout_account", {
    p_bank_code: input.bankCode,
    p_branch_code: input.branchCode,
    p_account_number: input.accountNumber,
    p_account_name: input.accountName,
  });
  if (error) {
    const m = error.message ?? "";
    if (Object.hasOwn(FIELD_BY_DB, m)) return { fieldErrors: { [FIELD_BY_DB[m]]: "格式不正確" } };
    return { formError: "發生錯誤，請稍後再試" };
  }
  revalidatePath("/creator/me/payout");
  return { ok: true };
}
