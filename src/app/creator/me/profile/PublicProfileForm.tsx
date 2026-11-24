"use client";
import { useActionState, useState } from "react";
import { Field, inputClass } from "@/components/forms/Field";
import { AvatarField } from "@/components/forms/AvatarField";
import { AUDIENCE_AGES, COLLAB_TYPES } from "@/lib/options";
import type { FormState } from "@/lib/auth/account-errors";
import type { OwnProfileFields } from "@/lib/creators/view";
import { updatePublicProfileAction } from "./actions";

const textareaClass = "w-full rounded-input border border-line bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ink";

export function PublicProfileForm({ userId, displayName, initial }: {
  userId: string; displayName: string; initial: OwnProfileFields;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePublicProfileAction, {});
  const [uploading, setUploading] = useState(false);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const val = (key: string, fallback: string) => (typeof v[key] === "string" ? (v[key] as string) : fallback);
  const checked = Array.isArray(v.collabTypes) ? v.collabTypes : initial.collabTypes;
  // React 送出後會重設表單；失敗時用 values 還原。儲存成功後 props 變了，所以 props 也放進 key 讓欄位重新掛載
  const k = JSON.stringify(state.values ?? initial);
  const avatarInitial = typeof v.avatarPath === "string" ? (v.avatarPath || null) : initial.avatarPath;
  return (
    <form action={action} className="max-w-xl space-y-4 rounded-card border border-line bg-surface p-5 md:p-8">
      <h2 className="text-lg font-bold text-ink">基本資料</h2>
      <AvatarField
        key={`avatar-${k}`} userId={userId} name={displayName} initialPath={avatarInitial}
        error={fe.avatarPath} onBusyChange={setUploading} disabled={pending}
      />
      <Field label="自我介紹（選填）" hint="300 字以內" error={fe.bio}>
        {(c) => <textarea key={k} {...c} name="bio" rows={4} maxLength={300} defaultValue={val("bio", initial.bio)} className={textareaClass} />}
      </Field>
      <Field label="風格標籤（選填）" hint="用逗號或頓號分隔，最多 8 個，每個 12 字以內" error={fe.styleTags}>
        {(c) => (
          <input key={k} {...c} name="styleTags" placeholder="例如：日系、簡約" defaultValue={val("styleTags", initial.styleTags.join("、"))} className={inputClass} />
        )}
      </Field>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">想接的合作</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {COLLAB_TYPES.map((t) => (
            <label key={`${k}-${t}`} className="flex min-h-9 items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="collabTypes" value={t} defaultChecked={checked.includes(t)} className="h-4 w-4 accent-ink" />
              {t}
            </label>
          ))}
        </div>
        {fe.collabTypes && <span className="mt-1 block text-xs text-danger">{fe.collabTypes}</span>}
      </fieldset>
      <Field label="互動率（%，選填）" hint="0–100，最多兩位小數" error={fe.engagementRate}>
        {(c) => (
          <input
            key={k} {...c} name="engagementRate" inputMode="decimal" placeholder="例如 3.5"
            defaultValue={val("engagementRate", initial.engagementRate === null ? "" : String(initial.engagementRate))}
            className={inputClass}
          />
        )}
      </Field>
      <Field label="主要受眾年齡（選填）" error={fe.audienceAge}>
        {(c) => (
          <select key={k} {...c} name="audienceAge" defaultValue={val("audienceAge", initial.audienceAge)} className={inputClass}>
            <option value="">不填</option>
            {AUDIENCE_AGES.map((a) => <option key={a} value={a}>{a} 歲</option>)}
          </select>
        )}
      </Field>
      {state.formError && <p role="alert" className="text-sm text-danger">{state.formError}</p>}
      {state.ok && <p role="status" className="text-sm text-success">已儲存</p>}
      <button disabled={pending || uploading} className="h-11 w-full rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 md:w-auto">
        儲存基本資料
      </button>
    </form>
  );
}
