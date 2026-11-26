"use client";
import { useActionState, useState } from "react";
import { Field, inputClass } from "@/components/forms/Field";
import { ErrorText } from "@/components/ui/ErrorText";
import { btn, cardPad } from "@/components/ui/styles";
import { LogoField } from "@/components/forms/LogoField";
import { INDUSTRIES } from "@/lib/options";
import type { FormState } from "@/lib/auth/account-errors";
import { createBrandAccountAction } from "./actions";

export function BrandOnboardingForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createBrandAccountAction, {});
  const [logoBusy, setLogoBusy] = useState(false);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  // React 送出後會重設表單；用 key 讓預設值（上次填的內容）重新套用
  const k = JSON.stringify(state.values ?? null);
  return (
    <form noValidate action={action} className={`space-y-4 ${cardPad}`}>
      <Field label="品牌名稱" error={fe.brandName}>
        {(c) => <input key={k} {...c} name="brandName" maxLength={60} defaultValue={str(v.brandName)} className={inputClass} />}
      </Field>
      <Field label="產業" error={fe.industry}>
        {(c) => (
          <select key={k} {...c} name="industry" defaultValue={str(v.industry)} className={inputClass}>
            <option value="" disabled>請選擇</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        )}
      </Field>
      <LogoField userId={userId} initialPath={null} error={fe.logoPath} onBusyChange={setLogoBusy} disabled={pending} />
      <ErrorText message={state.formError} />
      <button disabled={pending || logoBusy} className={`${btn.primary} w-full sm:w-auto`}>
        {logoBusy ? "Logo 上傳中…" : "完成註冊"}
      </button>
    </form>
  );
}

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}
