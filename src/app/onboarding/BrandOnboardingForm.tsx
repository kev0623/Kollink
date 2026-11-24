"use client";
import { useActionState } from "react";
import { Field, inputClass } from "@/components/forms/Field";
import { LogoField } from "@/components/forms/LogoField";
import { INDUSTRIES } from "@/lib/options";
import type { FormState } from "@/lib/auth/account-errors";
import { createBrandAccountAction } from "./actions";

export function BrandOnboardingForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createBrandAccountAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4 rounded-card border border-line bg-surface p-6 shadow-sm">
      <Field label="品牌名稱" error={fe.brandName}>
        <input name="brandName" required maxLength={60} className={inputClass} />
      </Field>
      <Field label="產業" error={fe.industry}>
        <select name="industry" required defaultValue="" className={inputClass}>
          <option value="" disabled>請選擇</option>
          {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </Field>
      <LogoField userId={userId} initialPath={null} error={fe.logoPath} />
      {state.formError && <p role="alert" className="text-sm text-primary">{state.formError}</p>}
      <button disabled={pending} className="w-full rounded-btn bg-primary px-4 py-2 font-bold text-white disabled:opacity-60">
        完成註冊
      </button>
    </form>
  );
}
