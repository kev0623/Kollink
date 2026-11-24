"use client";
import { useActionState, useState } from "react";
import { Field, inputClass } from "@/components/forms/Field";
import { LogoField } from "@/components/forms/LogoField";
import { INDUSTRIES } from "@/lib/options";
import type { FormState } from "@/lib/auth/account-errors";
import { updateBrandAction } from "./actions";

type Props = { userId: string; brandName: string; industry: string | null; logoPath: string | null };

export function BrandSettingsForm({ userId, brandName, industry, logoPath }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateBrandAction, {});
  const [logoBusy, setLogoBusy] = useState(false);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const val = (key: string, fallback: string) => (typeof v[key] === "string" ? (v[key] as string) : fallback);
  // React 送出後會重設表單；失敗時用 values 還原。key 讓預設值重新套用：
  // 儲存成功後 props 變了（<select> 掛載後不會套用新的 defaultValue），所以 props 也放進 key 讓欄位重新掛載
  const k = JSON.stringify(state.values ?? [brandName, industry]);
  return (
    <form action={action} className="max-w-xl space-y-4 rounded-card border border-line bg-surface p-5 md:p-8">
      <Field label="品牌名稱" error={fe.brandName}>
        {(c) => <input key={k} {...c} name="brandName" required maxLength={60} defaultValue={val("brandName", brandName)} className={inputClass} />}
      </Field>
      <Field label="產業" error={fe.industry}>
        {(c) => (
          <select key={k} {...c} name="industry" required defaultValue={val("industry", industry ?? "")} className={inputClass}>
            <option value="" disabled>請選擇</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        )}
      </Field>
      {/* initialPath 是資料庫目前的 Logo；key 讓儲存成功（路徑變了）後以新路徑重新開始，已儲存的檔案不會被當成「本次上傳」而刪掉 */}
      <LogoField key={logoPath ?? ""} userId={userId} initialPath={logoPath} error={fe.logoPath} onBusyChange={setLogoBusy} disabled={pending} />
      {state.formError && <p role="alert" className="text-sm text-danger">{state.formError}</p>}
      {state.ok && <p role="status" className="text-sm text-success">已儲存</p>}
      <button disabled={pending || logoBusy} className="h-11 w-full md:w-auto rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60">
        {logoBusy ? "Logo 上傳中…" : "儲存"}
      </button>
    </form>
  );
}
