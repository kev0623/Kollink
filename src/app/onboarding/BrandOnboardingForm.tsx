"use client";
import { useActionState, useState } from "react";
import { Field, inputClass } from "@/components/forms/Field";
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
    <form action={action} className="space-y-4 rounded-card border border-line bg-surface p-6 shadow-sm">
      <Field label="品牌名稱" error={fe.brandName}>
        {(c) => <input key={k} {...c} name="brandName" required maxLength={60} defaultValue={str(v.brandName)} className={inputClass} />}
      </Field>
      <Field label="產業" error={fe.industry}>
        {(c) => (
          <select key={k} {...c} name="industry" required defaultValue={str(v.industry)} className={inputClass}>
            <option value="" disabled>請選擇</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        )}
      </Field>
      <LogoField userId={userId} initialPath={null} error={fe.logoPath} onBusyChange={setLogoBusy} />
      {state.formError && <p role="alert" className="text-sm text-primary">{state.formError}</p>}
      <button disabled={pending || logoBusy} className="w-full rounded-btn bg-primary px-4 py-2 font-bold text-white disabled:opacity-60">
        {logoBusy ? "Logo 上傳中…" : "完成註冊"}
      </button>
    </form>
  );
}

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}
