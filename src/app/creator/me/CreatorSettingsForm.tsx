"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Field } from "@/components/forms/Field";
import { CategoryPicker } from "@/components/forms/CategoryPicker";
import { SavedMark, UnsavedBadge } from "@/components/forms/UnsavedBadge";
import { useUnsavedChanges } from "@/components/forms/useUnsavedChanges";
import { ErrorText } from "@/components/ui/ErrorText";
import { btn, cardPad, input } from "@/components/ui/styles";
import { REGIONS } from "@/lib/options";
import type { FormState } from "@/lib/auth/account-errors";
import { updateCreatorAction } from "./actions";

type Props = {
  displayName: string; handle: string; igUsername: string; followerCount: number;
  region: string | null; categories: string[]; handleEditable: boolean;
};

type Values = { displayName: string; handle: string; igUsername: string; followerCount: string; region: string; categories: string[] };

const snapshot = (v: Values) => JSON.stringify({ ...v, categories: [...v.categories].sort() });

export function CreatorSettingsForm(p: Props) {
  // 受控欄位：伺服器回錯誤時不會被重設；「尚未儲存」也由這裡算
  const [values, setValues] = useState<Values>(() => ({
    displayName: p.displayName, handle: p.handle, igUsername: p.igUsername,
    followerCount: String(p.followerCount), region: p.region ?? "", categories: p.categories,
  }));
  const [saved, setSaved] = useState(() => snapshot(values));
  const [showSaved, setShowSaved] = useState(false);
  const valuesRef = useRef(values);
  useEffect(() => { valuesRef.current = values; }, [values]);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const submitted = snapshot(valuesRef.current);
    const res = await updateCreatorAction(prev, fd);
    if (res.ok) setSaved(submitted);
    setShowSaved(res.ok === true);
    return res;
  }, {});
  const dirty = snapshot(values) !== saved;
  useUnsavedChanges(dirty);
  const fe = state.fieldErrors ?? {};
  const bind = (k: Exclude<keyof Values, "categories">) => ({
    value: values[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setValues((v) => ({ ...v, [k]: e.target.value }));
      setShowSaved(false);
    },
  });
  return (
    <form action={action} noValidate className={`${cardPad} max-w-2xl space-y-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-ink">帳號資料</h3>
        <UnsavedBadge show={dirty} />
      </div>
      <Field label="顯示名稱" error={fe.displayName}>
        {(c) => <input {...c} name="displayName" maxLength={40} {...bind("displayName")} className={input} />}
      </Field>
      <Field label="公開頁網址" error={fe.handle} hint={p.handleEditable ? "審核通過後就不能修改" : "審核通過後已固定"}>
        {(c) => (
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted" aria-hidden="true">/c/</span>
            <input {...c} name="handle" readOnly={!p.handleEditable} {...bind("handle")} className={input} />
          </div>
        )}
      </Field>
      <Field label="IG 帳號" error={fe.igUsername} hint="更換 IG 帳號後需要重新審核">
        {(c) => <input {...c} name="igUsername" {...bind("igUsername")} className={input} />}
      </Field>
      <Field label="IG 粉絲數" error={fe.followerCount} hint="自填，品牌可在合作前自行確認">
        {(c) => <input {...c} name="followerCount" inputMode="numeric" {...bind("followerCount")} className={input} />}
      </Field>
      <Field label="地區" error={fe.region}>
        {(c) => (
          <select {...c} name="region" {...bind("region")} className={input}>
            <option value="" disabled>請選擇</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </Field>
      <CategoryPicker
        name="categories" initial={p.categories} error={fe.categories}
        onChange={(categories) => { setValues((v) => ({ ...v, categories })); setShowSaved(false); }}
      />
      <ErrorText message={state.formError} />
      {state.notice && <p role="status" className="text-sm text-ink">{state.notice}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button disabled={pending} className={btn.primary}>{pending ? "儲存中…" : "儲存"}</button>
        <SavedMark show={showSaved && !dirty && state.ok === true && !state.notice} />
      </div>
    </form>
  );
}
