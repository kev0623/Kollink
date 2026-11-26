"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/forms/Field";
import { ErrorText } from "@/components/ui/ErrorText";
import { SavedMark } from "@/components/forms/UnsavedBadge";
import { btn, cardPad, input } from "@/components/ui/styles";
import { parsePayoutAccountForm, validatePayoutAccount } from "@/lib/payout-account";
import { savePayoutAccountAction, type PayoutFormState } from "./actions";

const EMPTY = { bankCode: "", branchCode: "", accountNumber: "", accountName: "" };

/** 收款帳戶表單：帳號一律重新輸入（畫面不會帶出完整帳號）。 */
export function PayoutAccountForm({ hasAccount }: { hasAccount: boolean }) {
  // 受控欄位：React 19 會在 form action 結束後重設表單，錯誤時要保留輸入；成功後清空（不留完整帳號）。
  const [values, setValues] = useState(EMPTY);
  const [edited, setEdited] = useState(false);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [state, action, pending] = useActionState<PayoutFormState, FormData>(async (prev, formData) => {
    setEdited(false);
    // 先在本機用同一份規則檢查（繁中行內錯誤）；不通過就不送伺服器。伺服器仍會再檢查一次。
    const errs = validatePayoutAccount(parsePayoutAccountForm(formData));
    if (errs) {
      setClientErrors(errs);
      return {};
    }
    setClientErrors({});
    const res = await savePayoutAccountAction(prev, formData);
    if (res.ok) setValues(EMPTY);
    return res;
  }, {});
  const bind = (k: keyof typeof values) => ({
    value: values[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [k]: e.target.value }));
      setEdited(true);
      setClientErrors((c) => ({ ...c, [k]: "" }));
    },
  });
  const fe: Record<string, string | undefined> = { ...(state.fieldErrors ?? {}), ...clientErrors };
  for (const k of Object.keys(fe)) if (!fe[k]) fe[k] = undefined;
  return (
    <form action={action} noValidate className={`${cardPad} space-y-5`}>
      <h2 className="text-lg font-bold text-ink">{hasAccount ? "更換收款帳戶" : "填寫收款帳戶"}</h2>
      <Field label="銀行代碼" error={fe.bankCode} hint="3 碼，例如台新 812、國泰世華 013、郵局 700">
        {(c) => <input {...c} name="bankCode" {...bind("bankCode")} inputMode="numeric" maxLength={3} autoComplete="off" className={input} />}
      </Field>
      <Field label="分行代碼（選填）" error={fe.branchCode} hint="4 碼；不知道可以留空">
        {(c) => <input {...c} name="branchCode" {...bind("branchCode")} inputMode="numeric" maxLength={4} autoComplete="off" className={input} />}
      </Field>
      <Field label="帳號" error={fe.accountNumber} hint="只填數字（7–16 碼），空白或「-」會自動去掉">
        {(c) => <input {...c} name="accountNumber" {...bind("accountNumber")} inputMode="numeric" maxLength={24} autoComplete="off" className={input} />}
      </Field>
      <Field label="戶名" error={fe.accountName} hint="與存摺上的戶名相同">
        {(c) => <input {...c} name="accountName" {...bind("accountName")} maxLength={40} autoComplete="off" className={input} />}
      </Field>
      <ErrorText message={state.formError} subject="收款帳戶" />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={btn.primary}>{pending ? "儲存中…" : "儲存"}</button>
        <SavedMark show={state.ok === true && !edited} />
      </div>
    </form>
  );
}
