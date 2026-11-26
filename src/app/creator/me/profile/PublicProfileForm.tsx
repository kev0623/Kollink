"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Field } from "@/components/forms/Field";
import { AvatarField } from "@/components/forms/AvatarField";
import { SavedMark, UnsavedBadge } from "@/components/forms/UnsavedBadge";
import { useUnsavedChanges } from "@/components/forms/useUnsavedChanges";
import { ErrorText } from "@/components/ui/ErrorText";
import { btn, cardPad, input, textarea } from "@/components/ui/styles";
import { AUDIENCE_AGES, COLLAB_TYPES } from "@/lib/options";
import type { FormState } from "@/lib/auth/account-errors";
import type { OwnProfileFields } from "@/lib/creators/view";
import { updatePublicProfileAction } from "./actions";

type Values = { bio: string; styleTags: string; collabTypes: string[]; engagementRate: string; audienceAge: string; avatarPath: string };

function toValues(p: OwnProfileFields): Values {
  return {
    bio: p.bio, styleTags: p.styleTags.join("、"), collabTypes: p.collabTypes,
    engagementRate: p.engagementRate === null ? "" : String(p.engagementRate),
    audienceAge: p.audienceAge, avatarPath: p.avatarPath ?? "",
  };
}

const snapshot = (v: Values) => JSON.stringify({ ...v, collabTypes: [...v.collabTypes].sort() });

export function PublicProfileForm({ userId, displayName, initial, onCollabTypesChange }: {
  userId: string; displayName: string; initial: OwnProfileFields; onCollabTypesChange?: (types: string[]) => void;
}) {
  // 受控欄位：伺服器回錯誤時不會被重設；「尚未儲存」也由這裡算
  const [values, setValues] = useState<Values>(() => toValues(initial));
  const [saved, setSaved] = useState(() => snapshot(toValues(initial)));
  const [savedCount, setSavedCount] = useState(0);
  const [showSaved, setShowSaved] = useState(false);
  const autoSave = useRef(false);
  const [uploading, setUploading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const valuesRef = useRef(values);
  useEffect(() => { valuesRef.current = values; }, [values]);

  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const submitted = snapshot(valuesRef.current);
    const res = await updatePublicProfileAction(prev, fd);
    if (res.ok) {
      setSaved(submitted);
      setSavedCount((n) => n + 1);
    }
    setShowSaved(res.ok === true);
    return res;
  }, {});

  const dirty = snapshot(values) !== saved;
  useUnsavedChanges(dirty);

  // 頭像上傳成功後，等路徑寫進表單再送出（上傳即儲存）
  useEffect(() => {
    if (!autoSave.current) return;
    autoSave.current = false;
    formRef.current?.requestSubmit();
  }, [values.avatarPath]);

  const fe = state.fieldErrors ?? {};
  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setShowSaved(false);
  }
  function toggleType(t: string, on: boolean) {
    const next = on ? [...values.collabTypes, t] : values.collabTypes.filter((x) => x !== t);
    set("collabTypes", next);
    onCollabTypesChange?.(next);
  }

  return (
    <form ref={formRef} action={action} noValidate className={`${cardPad} max-w-2xl space-y-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-ink">基本資料</h3>
        <UnsavedBadge show={dirty} />
      </div>
      <AvatarField
        userId={userId} name={displayName} initialPath={initial.avatarPath}
        error={fe.avatarPath} onBusyChange={setUploading} disabled={pending}
        savedCount={savedCount}
        onPathChange={(p) => setValues((v) => ({ ...v, avatarPath: p ?? "" }))}
        onUploaded={() => { autoSave.current = true; }}
        onTouch={() => setShowSaved(false)}
      />
      <p className="-mt-3 text-xs text-muted">選好頭像圖片會直接儲存；移除頭像要按下方「儲存基本資料」。</p>
      <Field label="自我介紹（選填）" hint="300 字以內" error={fe.bio}>
        {(c) => <textarea {...c} name="bio" rows={4} maxLength={300} value={values.bio} onChange={(e) => set("bio", e.target.value)} className={textarea} />}
      </Field>
      <Field label="風格標籤（選填）" hint="用逗號或頓號分隔，最多 8 個，每個 12 字以內" error={fe.styleTags}>
        {(c) => (
          <input {...c} name="styleTags" placeholder="例如：日系、簡約" value={values.styleTags} onChange={(e) => set("styleTags", e.target.value)} className={input} />
        )}
      </Field>
      <fieldset>
        <legend className="text-sm font-bold text-ink">想接的合作</legend>
        <div className="mt-1 flex flex-wrap gap-x-6">
          {COLLAB_TYPES.map((t) => (
            <label key={t} className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="collabTypes" value={t} checked={values.collabTypes.includes(t)} onChange={(e) => toggleType(t, e.target.checked)} />
              {t}
            </label>
          ))}
        </div>
        {fe.collabTypes && <span className="mt-1 block text-xs text-danger">{fe.collabTypes}</span>}
      </fieldset>
      <Field label="互動率（%，選填）" hint="0–100，最多兩位小數" error={fe.engagementRate}>
        {(c) => (
          <input {...c} name="engagementRate" inputMode="decimal" placeholder="例如 3.5" value={values.engagementRate} onChange={(e) => set("engagementRate", e.target.value)} className={input} />
        )}
      </Field>
      <Field label="主要受眾年齡（選填）" error={fe.audienceAge}>
        {(c) => (
          <select {...c} name="audienceAge" value={values.audienceAge} onChange={(e) => set("audienceAge", e.target.value)} className={input}>
            <option value="">不填</option>
            {AUDIENCE_AGES.map((a) => <option key={a} value={a}>{a} 歲</option>)}
          </select>
        )}
      </Field>
      <ErrorText message={state.formError} />
      <div className="flex flex-wrap items-center gap-4">
        <button disabled={pending || uploading} className={btn.primary}>{pending ? "儲存中…" : "儲存基本資料"}</button>
        <SavedMark show={showSaved && !dirty && state.ok === true} />
      </div>
    </form>
  );
}
