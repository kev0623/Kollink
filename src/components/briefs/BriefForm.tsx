"use client";

import { useActionState, useEffect, useState } from "react";
import { saveBriefAction, type BriefFormState } from "@/app/brand/briefs/actions";
import { ChipMultiSelect } from "@/components/forms/ChipMultiSelect";
import { CoverField } from "@/components/forms/CoverField";
import { Field, inputClass } from "@/components/forms/Field";
import { addDays, MAX_DEADLINE_DAYS } from "@/lib/briefs/dates";
import { previewFromInput } from "@/lib/briefs/view";
import { CATEGORIES, COLLAB_TYPES, REGIONS } from "@/lib/options";
import { firstErrorStep, validateBrief, validateBriefStep, type BriefInput, type BriefStep } from "@/lib/validation/brief";
import { BriefDetailView } from "./BriefDetailView";

const STEPS: { step: BriefStep; label: string }[] = [
  { step: 1, label: "合作內容" },
  { step: 2, label: "創作者條件" },
  { step: 3, label: "酬勞與期限" },
  { step: 4, label: "預覽並發佈" },
];

type Props = {
  /** 新增時是 null */
  briefId: string | null;
  /** 發佈中的招募不能存成草稿，只能「儲存變更」 */
  isOpen: boolean;
  initial: BriefInput;
  initialStep: BriefStep;
  /** 剛存成草稿（網址有 saved=1） */
  saved: boolean;
  userId: string;
  brandName: string;
  brandLogoPath: string | null;
  /** 台灣今天（伺服器算好傳進來，避免 hydration 不一致） */
  today: string;
};

/**
 * 刊登／編輯招募的四步驟表單。四步的欄位都在同一個 <form> 裡（非目前步驟用 hidden 隱藏），
 * 所以送出時 FormData 含全部欄位。步驟記在網址 ?step=（replaceState，不重新渲染伺服器端）。
 * 未儲存的內容只在畫面上；新招募存成草稿後由 Server Action redirect 到編輯頁，重新整理會從資料庫讀回來。
 */
export function BriefForm({ briefId, isOpen, initial, initialStep, saved, userId, brandName, brandLogoPath, today }: Props) {
  const [values, setValues] = useState<BriefInput>(initial);
  const [step, setStep] = useState<BriefStep>(initialStep);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [showSaved, setShowSaved] = useState(saved);
  const [coverBusy, setCoverBusy] = useState(false);
  const [state, formAction, pending] = useActionState<BriefFormState, FormData>(saveBriefAction, {});

  // 伺服器回傳欄位錯誤時，跳到有錯誤的第一步（在 render 中依前一次的 state 調整，不用 effect）
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    setClientErrors({});
    setShowSaved(state.saved === true);
    if (state.fieldErrors) setStep(firstErrorStep(state.fieldErrors));
  }

  // 步驟寫進網址：重新整理後停在同一步。用 replaceState，不產生歷史紀錄，也不觸發伺服器重新渲染。
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("step", String(step));
    url.searchParams.delete("saved");
    window.history.replaceState(null, "", url);
  }, [step]);

  const errors: Record<string, string> = { ...(state.fieldErrors ?? {}), ...clientErrors };
  const set = <K extends keyof BriefInput>(key: K, v: BriefInput[K]) => setValues((s) => ({ ...s, [key]: v }));

  function goTo(next: BriefStep) {
    setClientErrors({});
    setShowSaved(false);
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  function next() {
    const e = validateBriefStep(step, values, today);
    if (e) return setClientErrors(e);
    goTo((step + 1) as BriefStep);
  }

  /** 送出前在前端先檢查；有錯就不送，跳到有錯的那一步。 */
  function guard(mode: "draft" | "publish") {
    return (ev: React.MouseEvent<HTMLButtonElement>) => {
      const e = validateBrief(values, mode, today);
      if (!e) return;
      ev.preventDefault();
      setClientErrors(e);
      setStep(firstErrorStep(e));
    };
  }

  const busy = pending || coverBusy;
  const descLen = [...values.description].length;
  const regionOptions = values.region && !(REGIONS as readonly string[]).includes(values.region)
    ? [...REGIONS, values.region] : REGIONS;

  return (
    <form action={formAction} noValidate className="space-y-6">
      <input type="hidden" name="id" value={briefId ?? ""} />
      <input type="hidden" name="step" value={step} />

      <ol className="grid grid-cols-4 gap-2" aria-label="步驟">
        {STEPS.map((s) => (
          <li
            key={s.step} aria-current={s.step === step ? "step" : undefined}
            className={`rounded-btn border px-2 py-2 text-center text-xs font-semibold ${s.step === step ? "border-ink bg-ink text-on-ink" : s.step < step ? "border-line bg-surface text-ink" : "border-line text-muted"}`}
          >
            <span className="block">{s.step}</span>
            <span className="hidden sm:block">{s.label}</span>
            <span className="sr-only sm:hidden">{s.label}</span>
          </li>
        ))}
      </ol>

      {showSaved && <p role="status" className="text-sm text-success">已存成草稿</p>}

      <section hidden={step !== 1} className="space-y-4 rounded-card border border-line bg-surface p-5 md:p-8">
        <h2 className="text-lg font-bold text-ink">合作內容</h2>
        <Field label="案名" error={errors.title} hint="1–60 字">
          {(c) => <input {...c} name="title" value={values.title} onChange={(e) => set("title", e.target.value)} className={inputClass} />}
        </Field>
        <Field label="合作說明" error={errors.description} hint={`${descLen}/2000 字`}>
          {(c) => (
            <textarea
              {...c} name="description" rows={8} value={values.description}
              onChange={(e) => set("description", e.target.value)}
              className="w-full rounded-input border border-line bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ink"
            />
          )}
        </Field>
        <ChipMultiSelect
          legend="合作形式（至少 1 個）" name="collabTypes" options={COLLAB_TYPES} max={6}
          value={values.collabTypes} onChange={(v) => set("collabTypes", v)} error={errors.collabTypes}
        />
        <CoverField
          userId={userId} value={values.coverPath} onChange={(v) => set("coverPath", v)} brandName={brandName}
          brandLogoPath={brandLogoPath} error={errors.coverPath} onBusyChange={setCoverBusy} disabled={pending}
        />
      </section>

      <section hidden={step !== 2} className="space-y-4 rounded-card border border-line bg-surface p-5 md:p-8">
        <h2 className="text-lg font-bold text-ink">創作者條件</h2>
        <ChipMultiSelect
          legend="內容領域（最多 5 個）" name="categories" options={CATEGORIES} max={5} hint="不選代表不限"
          value={values.categories} onChange={(v) => set("categories", v)} error={errors.categories}
        />
        <Field label="最低粉絲數" error={errors.minFollowers} hint="0 或空白代表不限">
          {(c) => (
            <input
              {...c} name="minFollowers" inputMode="numeric" placeholder="例如 1000" value={values.minFollowers}
              onChange={(e) => set("minFollowers", e.target.value)} className={inputClass}
            />
          )}
        </Field>
        <Field label="地區" error={errors.region}>
          {(c) => (
            <select {...c} name="region" value={values.region} onChange={(e) => set("region", e.target.value)} className={inputClass}>
              <option value="">不限</option>
              {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
        </Field>
      </section>

      <section hidden={step !== 3} className="space-y-4 rounded-card border border-line bg-surface p-5 md:p-8">
        <h2 className="text-lg font-bold text-ink">酬勞與期限</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="預算下限（NT$，選填）" error={errors.budgetMin}>
            {(c) => (
              <input
                {...c} name="budgetMin" inputMode="numeric" placeholder="例如 5000" value={values.budgetMin}
                onChange={(e) => set("budgetMin", e.target.value)} className={inputClass}
              />
            )}
          </Field>
          <Field label="預算上限（NT$，選填）" error={errors.budgetMax}>
            {(c) => (
              <input
                {...c} name="budgetMax" inputMode="numeric" placeholder="例如 20000" value={values.budgetMax}
                onChange={(e) => set("budgetMax", e.target.value)} className={inputClass}
              />
            )}
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox" name="includesProduct" checked={values.includesProduct}
            onChange={(e) => set("includesProduct", e.target.checked)} className="h-4 w-4 accent-ink"
          />
          提供產品（互惠）
        </label>
        {errors.reward && <p className="text-xs text-danger">{errors.reward}</p>}
        <Field label="截止日" error={errors.deadline} hint={`今天到 ${MAX_DEADLINE_DAYS} 天內；截止日當天（台灣時間）仍可報名`}>
          {(c) => (
            <input
              {...c} type="date" name="deadline" min={today} max={addDays(today, MAX_DEADLINE_DAYS)}
              value={values.deadline} onChange={(e) => set("deadline", e.target.value)} className={inputClass}
            />
          )}
        </Field>
      </section>

      <section hidden={step !== 4} className="space-y-4">
        <h2 className="text-lg font-bold text-ink">預覽（創作者看到的樣子）</h2>
        <BriefDetailView brief={previewFromInput(values, { name: brandName, logoPath: brandLogoPath })} today={today} />
      </section>

      {state.formError && <p role="alert" className="text-sm text-danger">{state.formError}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {step > 1 && (
          <button type="button" onClick={() => goTo((step - 1) as BriefStep)} disabled={busy}
            className="h-11 rounded-btn border border-line bg-surface px-5 font-semibold text-ink">
            上一步
          </button>
        )}
        {!isOpen && (
          <button type="submit" name="intent" value="draft" formNoValidate onClick={guard("draft")} disabled={busy}
            className="h-11 rounded-btn border border-line bg-surface px-5 font-semibold text-ink disabled:opacity-60">
            存成草稿
          </button>
        )}
        <div className="ml-auto">
          {step < 4 ? (
            <button type="button" onClick={next} disabled={busy}
              className="h-11 rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60">
              下一步
            </button>
          ) : (
            <button type="submit" name="intent" value="publish" onClick={guard("publish")} disabled={busy}
              className="h-11 rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60">
              {pending ? "處理中…" : isOpen ? "儲存變更" : "發佈"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
