"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, Lightbulb, PartyPopper } from "lucide-react";
import { Field } from "@/components/forms/Field";
import { ErrorText } from "@/components/ui/ErrorText";
import { btn, cardPad, input } from "@/components/ui/styles";
import { CategoryPicker } from "@/components/forms/CategoryPicker";
import { COLLAB_TYPES, REGIONS } from "@/lib/options";
import { validateCreatorInput } from "@/lib/validation/onboarding";
import { validateRates } from "@/lib/validation/creator-profile";
import type { FormState } from "@/lib/auth/account-errors";
import { OnboardingProgress } from "@/components/auth/OnboardingProgress";
import { checkHandleAction, createCreatorAccountAction } from "./actions";

/** 一步一題：領取網址 → 確認 → 名字 → IG → 地區與領域 → 報價（至少一種）。送出後到 /creator/welcome。 */
const STEPS = ["handle", "claimed", "name", "ig", "about", "rates"] as const;
type Step = (typeof STEPS)[number];
const LAST: Step = "rates";

/** 伺服器回報錯誤的欄位屬於哪一步（回到那一步讓人修正）。 */
const STEP_OF_FIELD: Record<string, Step> = {
  handle: "handle", displayName: "name", igUsername: "ig", followerCount: "ig", region: "about", categories: "about",
};

const TITLES: Record<Step, string> = {
  handle: "領取你的專屬網址",
  claimed: "",
  name: "要怎麼稱呼你？",
  ig: "你的 IG 帳號",
  about: "你在哪裡、拍什麼內容？",
  rates: "設定你的報價",
};

export function CreatorOnboardingForm({ next }: { next: string | null }) {
  const [step, setStep] = useState<Step>("handle");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ig, setIg] = useState("");
  const [followers, setFollowers] = useState("");
  const [region, setRegion] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [offered, setOffered] = useState<string[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [local, setLocal] = useState<Record<string, string>>({});
  const [checking, startCheck] = useTransition();

  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const res = await createCreatorAccountAction(prev, fd);
    const first = Object.keys(res.fieldErrors ?? {}).map((k) => STEP_OF_FIELD[k]).find(Boolean);
    if (first) setStep(first);
    setLocal({});
    return res;
  }, {});

  // 換步驟後把焦點移到這一步的標題，鍵盤與報讀軟體才知道內容換了
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [step]);

  const fe = { ...(state.fieldErrors ?? {}), ...local };
  const input_ = { displayName, handle, igUsername: ig, followerCount: followers, region, categories };

  function go(to: Step) {
    setLocal({});
    setStep(to);
  }
  function back() {
    const i = STEPS.indexOf(step);
    // 「確認網址」只在領取成功後出現一次，往回走時跳過
    const prev = STEPS[i - 1] === "claimed" ? "handle" : STEPS[i - 1];
    if (prev) go(prev);
  }
  /** 只看這一步的欄位有沒有錯。 */
  function errorsFor(fields: string[]): Record<string, string> {
    const all = validateCreatorInput(input_) ?? {};
    return Object.fromEntries(fields.filter((f) => all[f]).map((f) => [f, all[f]]));
  }
  function advance(fields: string[], to: Step) {
    const errs = errorsFor(fields);
    if (Object.keys(errs).length > 0) { setLocal(errs); return; }
    go(to);
  }
  function claim() {
    const errs = errorsFor(["handle"]);
    if (errs.handle) { setLocal(errs); return; }
    startCheck(async () => {
      const res = await checkHandleAction(handle);
      if ("error" in res) setLocal({ handle: res.error });
      else go("claimed");
    });
  }
  function ratesProblem(): Record<string, string> | null {
    const filled = offered.map((t) => ({ collabType: t, price: (prices[t] ?? "").replace(/[,，\s]/g, "") }));
    const errs: Record<string, string> = { ...validateRates(filled.filter((r) => r.price !== "")) };
    for (const r of filled) if (r.price === "") errs[`price:${r.collabType}`] = "請填價格";
    if (offered.length === 0) errs.rates = "至少選一種合作形式並填價格";
    return Object.keys(errs).length > 0 ? errs : null;
  }
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (step === LAST) {
      const errs = ratesProblem();
      if (errs) { e.preventDefault(); setLocal(errs); }
      return; // 沒有錯就交給 action 送出
    }
    e.preventDefault();
    if (step === "handle") claim();
    else if (step === "claimed") go("name");
    else if (step === "name") advance(["displayName"], "ig");
    else if (step === "ig") advance(["igUsername", "followerCount"], "about");
    else if (step === "about") advance(["region", "categories"], "rates");
  }
  function toggleType(t: string) {
    setLocal({});
    setOffered((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : COLLAB_TYPES.filter((x) => x === t || cur.includes(x))));
  }

  const busy = pending || checking;
  return (
    <>
      <OnboardingProgress current={step === LAST ? 1 : 0} />
      <form noValidate action={action} onSubmit={onSubmit} className={`space-y-5 ${cardPad}`}>
        {/* 每一步只顯示自己的欄位；其餘的值放在隱藏欄位，最後一步一起送出 */}
        {next && <input type="hidden" name="next" value={next} />}
        <input type="hidden" name="handle" value={handle} />
        <input type="hidden" name="displayName" value={displayName} />
        <input type="hidden" name="igUsername" value={ig} />
        <input type="hidden" name="followerCount" value={followers} />
        <input type="hidden" name="region" value={region} />
        {step !== "about" && categories.map((c) => <input key={c} type="hidden" name="categories" value={c} />)}
        {offered.map((t) => <input key={t} type="hidden" name={`price:${t}`} value={prices[t] ?? ""} />)}

        {step !== "handle" && (
          <button type="button" onClick={back} disabled={busy} className={`${btn.icon} -ml-2 bg-subtle`}>
            <ChevronLeft size={20} strokeWidth={1.5} aria-hidden="true" /><span className="sr-only">上一步</span>
          </button>
        )}

        {step === "claimed" ? (
          <div className="space-y-4">
            <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-card bg-subtle text-ink"><PartyPopper size={26} strokeWidth={1.5} /></span>
            <h2 ref={headingRef} tabIndex={-1} className="break-all text-lg text-ink outline-none"><b>/c/{handle}</b> 可以使用</h2>
            <p className="flex items-start gap-2 rounded-input bg-subtle p-3 text-sm text-muted">
              <Lightbulb size={16} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>完成註冊後，這個網址就是你的公開頁，可以放在 IG 自我介紹或直接傳給品牌。</span>
            </p>
          </div>
        ) : (
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-ink outline-none">{TITLES[step]}</h2>
        )}

        {step === "handle" && (
          <>
            <p className="text-sm text-muted">這是你的公開頁網址，品牌會從這裡看到你的作品和報價。審核通過後就不能修改。</p>
            <Field label="公開頁網址" mark="required" error={fe.handle} hint="小寫英文、數字、底線和點，3–30 字">
              {(c) => (
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted" aria-hidden="true">/c/</span>
                  <input
                    {...c} value={handle} autoComplete="off" autoCapitalize="none" spellCheck={false} className={input}
                    onChange={(e) => { setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 30)); setLocal({}); }}
                  />
                </div>
              )}
            </Field>
          </>
        )}

        {step === "name" && (
          <Field label="顯示名稱" mark="required" error={fe.displayName} hint="會顯示在你的公開頁和品牌的搜尋結果">
            {(c) => <input {...c} value={displayName} maxLength={40} autoComplete="name" className={input} onChange={(e) => { setDisplayName(e.target.value); setLocal({}); }} />}
          </Field>
        )}

        {step === "ig" && (
          <>
            <p className="text-sm text-muted">審核時我們會打開這個帳號確認是你本人。粉絲數請照實填，登入的品牌才看得到。</p>
            <Field label="IG 帳號" mark="required" error={fe.igUsername}>
              {(c) => (
                <input
                  {...c} value={ig} placeholder="@your.ig" autoComplete="off" autoCapitalize="none" spellCheck={false} className={input}
                  onChange={(e) => { setIg(e.target.value); setLocal({}); }}
                />
              )}
            </Field>
            <Field label="IG 粉絲數" mark="required" error={fe.followerCount}>
              {(c) => <input {...c} value={followers} inputMode="numeric" placeholder="例如 1700" className={input} onChange={(e) => { setFollowers(e.target.value); setLocal({}); }} />}
            </Field>
          </>
        )}

        {step === "about" && (
          <>
            <Field label="地區" mark="required" error={fe.region}>
              {(c) => (
                <select {...c} value={region} className={input} onChange={(e) => { setRegion(e.target.value); setLocal({}); }}>
                  <option value="" disabled>請選擇</option>
                  {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              )}
            </Field>
            <CategoryPicker name="categories" initial={categories} error={fe.categories} onChange={(s) => { setCategories(s); setLocal({}); }} />
          </>
        )}

        {step === "rates" && (
          <fieldset className="space-y-3">
            <legend className="text-sm text-muted">勾選你願意接的合作形式並填價格，至少一種。報價會公開顯示在你的頁面，之後隨時可以改。</legend>
            {COLLAB_TYPES.map((t) => {
              const on = offered.includes(t);
              return (
                <div key={t} className={`rounded-input border p-3 transition-colors duration-150 ${on ? "border-ink bg-subtle" : "border-line-strong"}`}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 font-bold text-ink">
                    <input type="checkbox" checked={on} onChange={() => toggleType(t)} className="h-5 w-5 shrink-0 accent-primary" />
                    {t}
                  </label>
                  {on && (
                    <div className="mt-2 pl-8">
                      <Field label="價格（NT$）" mark="required" error={fe[`price:${t}`]} hint={t === "產品互惠" ? "只收產品、不收費用可以填 0" : undefined}>
                        {(c) => (
                          <input
                            {...c} value={prices[t] ?? ""} inputMode="numeric" placeholder="例如 4500" className={input}
                            onChange={(e) => { setPrices((p) => ({ ...p, [t]: e.target.value })); setLocal({}); }}
                          />
                        )}
                      </Field>
                    </div>
                  )}
                </div>
              );
            })}
            <ErrorText message={fe.rates} />
          </fieldset>
        )}

        <ErrorText message={state.formError} />
        <button disabled={busy} className={`${btn.primary} w-full`}>
          {step === "handle" ? (checking ? "確認中…" : "領取") : step === LAST ? (pending ? "送出中…" : "送出審核") : "下一步"}
        </button>
      </form>
    </>
  );
}
