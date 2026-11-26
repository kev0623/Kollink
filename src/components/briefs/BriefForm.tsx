"use client";

import { useActionState, useEffect, useState } from "react";
import { saveBriefAction, type BriefFormState } from "@/app/brand/briefs/actions";
import { ChipMultiSelect } from "@/components/forms/ChipMultiSelect";
import { CoverField } from "@/components/forms/CoverField";
import { Field } from "@/components/forms/Field";
import { LeaveDialog } from "@/components/forms/LeaveDialog";
import { useUnsavedChanges } from "@/components/forms/useUnsavedChanges";
import { ErrorText } from "@/components/ui/ErrorText";
import { Notice } from "@/components/ui/Notice";
import { btn, cardPad, textarea, input } from "@/components/ui/styles";
import { addDays, MAX_DEADLINE_DAYS } from "@/lib/briefs/dates";
import { previewFromInput } from "@/lib/briefs/view";
import { canJumpToStep, isBlankBrief } from "@/lib/briefs/wizard";
import { CATEGORIES, COLLAB_TYPES, REGIONS } from "@/lib/options";
import { firstErrorStep, normalizeBriefNumbers, validateBrief, validateBriefStep, type BriefInput, type BriefStep } from "@/lib/validation/brief";
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
 * 所以送出時 FormData 含全部欄位。步驟記在網址 ?step=（pushState：上一頁回到上一步，不重新渲染伺服器端）。
 * 未儲存的內容只在畫面上；新招募存成草稿後由 Server Action redirect 到編輯頁，重新整理會從資料庫讀回來。
 */
export function BriefForm({ briefId, isOpen, initial, initialStep, saved, userId, brandName, brandLogoPath, today }: Props) {
  const [values, setValues] = useState<BriefInput>(initial);
  const [baseline, setBaseline] = useState<BriefInput>(initial);
  const [step, setStep] = useState<BriefStep>(initialStep);
  const [maxStep, setMaxStep] = useState<BriefStep>(initialStep);
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
    if (state.saved) setBaseline(values);
    if (state.fieldErrors) setStep(firstErrorStep(state.fieldErrors));
  }

  // 瀏覽器上一頁／下一頁：回到網址上的步驟（QA m15：上一頁不再直接離開精靈）
  useEffect(() => {
    function onPop() {
      const s = Number(new URL(window.location.href).searchParams.get("step"));
      if (s === 1 || s === 2 || s === 3 || s === 4) goTo(s as BriefStep, false);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  });

  // 手機的步驟列可以橫捲：換步驟時把目前這一步捲進畫面
  useEffect(() => {
    document.querySelector('ol[aria-label="步驟"] [aria-current="step"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [step]);

  // 有改動還沒儲存時：關閉分頁或重新整理由瀏覽器提示；站內點連結改顯示頁面內的確認（Task 13）
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);
  const leaveGuard = useUnsavedChanges(dirty && !pending);

  const errors: Record<string, string> = { ...(state.fieldErrors ?? {}), ...clientErrors };
  const set = <K extends keyof BriefInput>(key: K, v: BriefInput[K]) => {
    setValues((s) => ({ ...s, [key]: v }));
    setClientErrors((e) => (key in e ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e));
  };

  function goTo(next: BriefStep, push = true) {
    setClientErrors({});
    setShowSaved(false);
    setStep(next);
    setMaxStep((m) => (next > m ? next : m));
    if (push) {
      const url = new URL(window.location.href);
      url.searchParams.set("step", String(next));
      url.searchParams.delete("saved");
      window.history.pushState(null, "", url);
    }
    window.scrollTo({ top: 0 });
  }

  function next() {
    const e = validateBriefStep(step, normalizeBriefNumbers(values), today);
    if (e) return setClientErrors(e);
    goTo((step + 1) as BriefStep);
  }

  /** 點步驟頁籤往後跳：中間每一步都要先通過驗證，有錯就停在有錯的那一步。往前回到到過的步驟不檢查。 */
  function jumpTo(target: BriefStep) {
    if (target > step) {
      const normalized = normalizeBriefNumbers(values);
      for (let s = step; s < target; s++) {
        const e = validateBriefStep(s as BriefStep, normalized, today);
        if (e) {
          setClientErrors(e);
          if (s !== step) { setStep(s as BriefStep); window.scrollTo({ top: 0 }); }
          return;
        }
      }
    }
    goTo(target);
  }

  /** 送出前在前端先檢查；有錯就不送，跳到有錯的那一步。 */
  function guard(mode: "draft" | "publish") {
    return (ev: React.MouseEvent<HTMLButtonElement>) => {
      const e = validateBrief(normalizeBriefNumbers(values), mode, today);
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
      <LeaveDialog guard={leaveGuard} />
      <input type="hidden" name="id" value={briefId ?? ""} />
      <input type="hidden" name="step" value={step} />

      <ol className="scroll-fade-x -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:px-0" aria-label="步驟">
        {STEPS.map((s) => {
          const current = s.step === step;
          const reachable = canJumpToStep(s.step, step, maxStep);
          return (
            <li key={s.step} className="shrink-0 md:shrink">
              <button
                type="button" disabled={!reachable && !current} aria-current={current ? "step" : undefined}
                onClick={() => reachable && jumpTo(s.step)}
                className={`flex h-11 w-full items-center gap-2 whitespace-nowrap rounded-btn border px-4 text-sm font-bold ${
                  current ? "border-ink bg-ink text-on-ink" : s.step <= maxStep ? "border-line-strong bg-surface text-ink hover:bg-subtle" : "border-line text-muted"
                }`}
              >
                <span className="tabular-nums">{s.step}</span>{s.label}
              </button>
            </li>
          );
        })}
      </ol>

      {showSaved && <Notice tone="success">已存成草稿</Notice>}

      <section hidden={step !== 1} className={`space-y-4 ${cardPad}`}>
        <h2 className="text-lg font-bold text-ink">合作內容</h2>
        <Field label="案名" error={errors.title} hint="1–60 字">
          {(c) => <input {...c} name="title" value={values.title} onChange={(e) => set("title", e.target.value)} className={input} />}
        </Field>
        <Field label="合作說明" error={errors.description} hint={`${descLen}/2000 字`}>
          {(c) => (
            <textarea
              {...c} name="description" rows={8} value={values.description}
              onChange={(e) => set("description", e.target.value)}
              className={textarea}
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
          savedMark={state.saved ? state : null}
        />
      </section>

      <section hidden={step !== 2} className={`space-y-4 ${cardPad}`}>
        <h2 className="text-lg font-bold text-ink">創作者條件</h2>
        <ChipMultiSelect
          legend="內容領域（最多 5 個）" name="categories" options={CATEGORIES} max={5} hint="不選代表不限"
          value={values.categories} onChange={(v) => set("categories", v)} error={errors.categories}
        />
        <Field label="最低粉絲數" error={errors.minFollowers} hint="0 或空白代表不限">
          {(c) => (
            <input
              {...c} name="minFollowers" inputMode="numeric" placeholder="例如 1000" value={values.minFollowers}
              onChange={(e) => set("minFollowers", e.target.value)} className={input}
            />
          )}
        </Field>
        <Field label="地區" error={errors.region}>
          {(c) => (
            <select {...c} name="region" value={values.region} onChange={(e) => set("region", e.target.value)} className={input}>
              <option value="">不限</option>
              {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
        </Field>
      </section>

      <section hidden={step !== 3} className={`space-y-4 ${cardPad}`}>
        <h2 className="text-lg font-bold text-ink">酬勞與期限</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="預算下限（NT$，選填）" error={errors.budgetMin}>
            {(c) => (
              <input
                {...c} name="budgetMin" inputMode="numeric" placeholder="例如 5000" value={values.budgetMin}
                onChange={(e) => set("budgetMin", e.target.value)} className={input}
              />
            )}
          </Field>
          <Field label="預算上限（NT$，選填）" error={errors.budgetMax}>
            {(c) => (
              <input
                {...c} name="budgetMax" inputMode="numeric" placeholder="例如 20000" value={values.budgetMax}
                onChange={(e) => set("budgetMax", e.target.value)} className={input}
              />
            )}
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox" name="includesProduct" checked={values.includesProduct}
            onChange={(e) => set("includesProduct", e.target.checked)} className="h-5 w-5 accent-primary"
          />
          提供產品（互惠）
        </label>
        {errors.reward && <p className="text-xs text-danger">{errors.reward}</p>}
        <Field label="截止日" error={errors.deadline} hint={`今天到 ${MAX_DEADLINE_DAYS} 天內；截止日當天（台灣時間）仍可報名`}>
          {(c) => (
            <input
              {...c} type="date" name="deadline" min={today} max={addDays(today, MAX_DEADLINE_DAYS)}
              value={values.deadline} onChange={(e) => set("deadline", e.target.value)} className={input}
            />
          )}
        </Field>
      </section>

      <section hidden={step !== 4} className="space-y-4">
        <h2 className="text-lg font-bold text-ink">預覽（創作者看到的樣子）</h2>
        <BriefDetailView brief={previewFromInput(normalizeBriefNumbers(values), { name: brandName, logoPath: brandLogoPath })} today={today} />
      </section>

      {state.formError && <ErrorText message={state.formError} />}

      <div className="flex flex-wrap items-center gap-2">
        {step > 1 && (
          <button type="button" onClick={() => goTo((step - 1) as BriefStep)} disabled={busy} className={btn.secondary}>
            上一步
          </button>
        )}
        {!isOpen && (
          <>
            <button type="submit" name="intent" value="draft" formNoValidate onClick={guard("draft")} disabled={busy || isBlankBrief(values)}
              className={btn.secondary}>
              存成草稿
            </button>
            {isBlankBrief(values) && <span className="text-xs text-muted">填寫案名後就能存成草稿</span>}
          </>
        )}
        <div className="ml-auto">
          {/* 兩個按鈕要有不同的 key：否則 React 會重用同一個 DOM 元素，在同一次點擊中把 type 改成 submit，按「下一步」就直接發佈。 */}
          {step < 4 ? (
            <button key="next" type="button" onClick={next} disabled={busy} className={btn.primary}>
              下一步
            </button>
          ) : (
            <button key="publish" type="submit" name="intent" value="publish" onClick={guard("publish")} disabled={busy} className={btn.primary}>
              {pending ? "處理中…" : isOpen ? "儲存變更" : "發佈"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
