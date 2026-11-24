"use client";
import { useActionState } from "react";
import { Field, inputClass } from "@/components/forms/Field";
import { CategoryPicker } from "@/components/forms/CategoryPicker";
import { REGIONS } from "@/lib/options";
import type { FormState } from "@/lib/auth/account-errors";
import { updateCreatorAction } from "./actions";

type Props = {
  displayName: string; handle: string; igUsername: string; followerCount: number;
  region: string | null; categories: string[]; handleEditable: boolean;
};

export function CreatorSettingsForm(p: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateCreatorAction, {});
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const val = (key: string, fallback: string) => (typeof v[key] === "string" ? (v[key] as string) : fallback);
  // React 送出後會重設表單；失敗時用 values 還原。key 讓預設值重新套用：
  // 儲存成功後 props 變了（<select> 掛載後不會套用新的 defaultValue），所以 props 也放進 key 讓欄位重新掛載
  const k = JSON.stringify(state.values ?? [p.displayName, p.handle, p.igUsername, p.followerCount, p.region]);
  return (
    <form action={action} className="max-w-xl space-y-4 rounded-card border border-line bg-surface p-5 md:p-8">
      <Field label="顯示名稱" error={fe.displayName}>
        {(c) => <input key={k} {...c} name="displayName" required maxLength={40} defaultValue={val("displayName", p.displayName)} className={inputClass} />}
      </Field>
      <Field label="公開頁網址" error={fe.handle} hint={p.handleEditable ? "審核通過後就不能修改" : "審核通過後已固定"}>
        {(c) => (
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted" aria-hidden="true">/c/</span>
            <input
              key={k} {...c} name="handle" required defaultValue={val("handle", p.handle)} readOnly={!p.handleEditable}
              className={inputClass}
            />
          </div>
        )}
      </Field>
      <Field label="IG 帳號" error={fe.igUsername} hint="更換 IG 帳號後需要重新審核">
        {(c) => <input key={k} {...c} name="igUsername" required defaultValue={val("igUsername", p.igUsername)} className={inputClass} />}
      </Field>
      <Field label="IG 粉絲數" error={fe.followerCount} hint="自填，品牌可在合作前自行確認">
        {(c) => (
          <input
            key={k} {...c} name="followerCount" required inputMode="numeric" pattern="\d{1,9}"
            defaultValue={val("followerCount", String(p.followerCount))} className={inputClass}
          />
        )}
      </Field>
      <Field label="地區" error={fe.region}>
        {(c) => (
          <select key={k} {...c} name="region" required defaultValue={val("region", p.region ?? "")} className={inputClass}>
            <option value="" disabled>請選擇</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </Field>
      <CategoryPicker name="categories" initial={p.categories} error={fe.categories} />
      {state.formError && <p role="alert" className="text-sm text-danger">{state.formError}</p>}
      {state.ok && !state.notice && <p role="status" className="text-sm text-success">已儲存</p>}
      {state.notice && <p role="status" className="text-sm text-ink">{state.notice}</p>}
      <button disabled={pending} className="h-11 w-full rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 md:w-auto">儲存</button>
    </form>
  );
}
