"use client";

import { useActionState, useState } from "react";
import { Field, inputClass } from "@/components/forms/Field";
import { savePayoutAccountAction, type PayoutFormState } from "./actions";

/** 收款帳戶表單：帳號一律重新輸入（畫面不會帶出完整帳號）。 */
export function PayoutAccountForm({ hasAccount }: { hasAccount: boolean }) {
  // 受控欄位：React 19 會在 form action 結束後重設表單，錯誤時要保留輸入；成功後清空（不留完整帳號）。
  const [values, setValues] = useState({ bankCode: "", branchCode: "", accountNumber: "", accountName: "" });
  const [edited, setEdited] = useState(false);
  const [state, action, pending] = useActionState<PayoutFormState, FormData>(async (prev, formData) => {
    setEdited(false);
    const res = await savePayoutAccountAction(prev, formData);
    if (res.ok) setValues({ bankCode: "", branchCode: "", accountNumber: "", accountName: "" });
    return res;
  }, {});
  const bind = (k: keyof typeof values) => ({
    value: values[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [k]: e.target.value }));
      setEdited(true);
    },
  });
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-xl space-y-4 rounded-card border border-line bg-surface p-5 md:p-8">
      <h2 className="text-lg font-bold text-ink">{hasAccount ? "更換收款帳戶" : "填寫收款帳戶"}</h2>
      <Field label="銀行代碼" error={fe.bankCode} hint="3 碼，例如台新 812、國泰世華 013、郵局 700">
        {(c) => <input {...c} name="bankCode" {...bind("bankCode")} required inputMode="numeric" maxLength={3} autoComplete="off" className={inputClass} />}
      </Field>
      <Field label="分行代碼（選填）" error={fe.branchCode} hint="4 碼；不知道可以留空">
        {(c) => <input {...c} name="branchCode" {...bind("branchCode")} inputMode="numeric" maxLength={4} autoComplete="off" className={inputClass} />}
      </Field>
      <Field label="帳號" error={fe.accountNumber} hint="只填數字（7–16 碼），空白或「-」會自動去掉">
        {(c) => <input {...c} name="accountNumber" {...bind("accountNumber")} required inputMode="numeric" maxLength={24} autoComplete="off" className={inputClass} />}
      </Field>
      <Field label="戶名" error={fe.accountName} hint="與存摺上的戶名相同">
        {(c) => <input {...c} name="accountName" {...bind("accountName")} required maxLength={40} autoComplete="off" className={inputClass} />}
      </Field>
      {state.formError && <p role="alert" className="text-sm text-danger">{state.formError}</p>}
      {state.ok && !edited && <p role="status" className="text-sm text-success">已儲存</p>}
      <button type="submit" disabled={pending} className="h-11 rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60">
        {pending ? "儲存中…" : "儲存"}
      </button>
    </form>
  );
}
