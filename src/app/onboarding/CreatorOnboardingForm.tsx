"use client";
import { useActionState, useState } from "react";
import { Field, inputClass } from "@/components/forms/Field";
import { ErrorText } from "@/components/ui/ErrorText";
import { btn, cardPad } from "@/components/ui/styles";
import { CategoryPicker } from "@/components/forms/CategoryPicker";
import { REGIONS } from "@/lib/options";
import { suggestHandle } from "@/lib/validation/onboarding";
import type { FormState } from "@/lib/auth/account-errors";
import { createCreatorAccountAction } from "./actions";

export function CreatorOnboardingForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createCreatorAccountAction, {});
  const [ig, setIg] = useState("");
  const [handle, setHandle] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  // React 送出後會重設表單；用 key 讓預設值（上次填的內容）重新套用。ig 與 handle 是受控欄位，不受影響。
  const k = JSON.stringify(state.values ?? null);
  return (
    <form noValidate action={action} className={`space-y-4 ${cardPad}`}>
      <Field label="顯示名稱" error={fe.displayName}>
        {(c) => <input key={k} {...c} name="displayName" maxLength={40} defaultValue={str(v.displayName)} className={inputClass} />}
      </Field>
      <Field label="IG 帳號" error={fe.igUsername}>
        {(c) => (
          <input
            {...c} name="igUsername" value={ig} placeholder="@your.ig" className={inputClass}
            onChange={(e) => {
              setIg(e.target.value);
              if (!handleTouched) {
                const s = suggestHandle(e.target.value);
                setHandle(s.length >= 3 ? s : "");
              }
            }}
          />
        )}
      </Field>
      <Field label="公開頁網址" error={fe.handle} hint="審核通過後就不能修改">
        {(c) => (
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted" aria-hidden="true">/c/</span>
            <input
              {...c} name="handle" value={handle} className={inputClass}
              onChange={(e) => {
                const next = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, "");
                setHandle(next);
                setHandleTouched(next !== "");
              }}
            />
          </div>
        )}
      </Field>
      <Field label="IG 粉絲數" error={fe.followerCount}>
        {(c) => (
          <input
            key={k} {...c} name="followerCount" inputMode="numeric"
            defaultValue={str(v.followerCount)} className={inputClass}
          />
        )}
      </Field>
      <Field label="地區" error={fe.region}>
        {(c) => (
          <select key={k} {...c} name="region" defaultValue={str(v.region)} className={inputClass}>
            <option value="" disabled>請選擇</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </Field>
      <CategoryPicker name="categories" initial={[]} error={fe.categories} />
      <ErrorText message={state.formError} />
      <button disabled={pending} className={`${btn.primary} w-full sm:w-auto`}>
        送出審核
      </button>
    </form>
  );
}

function str(x: string | string[] | undefined): string {
  return typeof x === "string" ? x : "";
}
