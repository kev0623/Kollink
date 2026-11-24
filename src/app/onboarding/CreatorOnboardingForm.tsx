"use client";
import { useActionState, useState } from "react";
import { Field, inputClass } from "@/components/forms/Field";
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
  return (
    <form action={action} className="space-y-4 rounded-card border border-line bg-surface p-6 shadow-sm">
      <Field label="顯示名稱" error={fe.displayName}>
        <input name="displayName" required maxLength={40} className={inputClass} />
      </Field>
      <Field label="IG 帳號" error={fe.igUsername}>
        <input
          name="igUsername" required value={ig} placeholder="@your.ig" className={inputClass}
          onChange={(e) => { setIg(e.target.value); if (!handleTouched) setHandle(suggestHandle(e.target.value)); }}
        />
      </Field>
      <Field label="公開頁網址" error={fe.handle} hint="審核通過後就不能修改">
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted">/c/</span>
          <input
            name="handle" required value={handle} className={inputClass}
            onChange={(e) => { setHandleTouched(true); setHandle(e.target.value.toLowerCase()); }}
          />
        </div>
      </Field>
      <Field label="IG 粉絲數" error={fe.followerCount}>
        <input name="followerCount" required inputMode="numeric" pattern="\d{1,9}" className={inputClass} />
      </Field>
      <Field label="地區" error={fe.region}>
        <select name="region" required defaultValue="" className={inputClass}>
          <option value="" disabled>請選擇</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>
      <CategoryPicker name="categories" initial={[]} error={fe.categories} />
      {state.formError && <p role="alert" className="text-sm text-primary">{state.formError}</p>}
      <button disabled={pending} className="w-full rounded-btn bg-primary px-4 py-2 font-bold text-white disabled:opacity-60">
        送出審核
      </button>
    </form>
  );
}
