"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Field } from "@/components/forms/Field";
import { SavedMark, UnsavedBadge } from "@/components/forms/UnsavedBadge";
import { useUnsavedChanges } from "@/components/forms/useUnsavedChanges";
import { Notice } from "@/components/ui/Notice";
import { ErrorText } from "@/components/ui/ErrorText";
import { btn, cardPad, input } from "@/components/ui/styles";
import type { FormState } from "@/lib/auth/account-errors";
import type { Rate } from "@/lib/creators/view";
import { updateRatesAction } from "./actions";

/**
 * collabTypes：上方「想接的合作」目前勾選的（含尚未儲存）。
 * savedCollabTypes：資料庫裡已儲存的；資料庫依已儲存的合作形式檢查報價，所以只有這些能填。
 */
export function RatesForm({ collabTypes, savedCollabTypes, initial }: {
  collabTypes: string[]; savedCollabTypes: string[]; initial: Rate[];
}) {
  const initialPrices = Object.fromEntries(initial.map((r) => [r.collabType, String(r.priceTwd)]));
  const [prices, setPrices] = useState<Record<string, string>>(initialPrices);
  const [saved, setSaved] = useState(() => JSON.stringify(initialPrices));
  const [showSaved, setShowSaved] = useState(false);
  const pricesRef = useRef(prices);
  useEffect(() => { pricesRef.current = prices; }, [prices]);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const submitted = JSON.stringify(pricesRef.current);
    const res = await updateRatesAction(prev, fd);
    if (res.ok) setSaved(submitted);
    setShowSaved(res.ok === true);
    return res;
  }, {});
  const fe = state.fieldErrors ?? {};
  const dirty = JSON.stringify(prices) !== saved;
  useUnsavedChanges(dirty);
  const error = fe.rates ?? state.formError;
  const hasUnsavedTypes = collabTypes.some((t) => !savedCollabTypes.includes(t));
  return (
    <form action={action} noValidate className={`${cardPad} max-w-2xl space-y-5`}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-ink">報價</h3>
          <UnsavedBadge show={dirty} />
        </div>
        <p className="mt-1 text-sm text-muted">只有登入的品牌看得到。留空代表不提供這個合作形式的報價。</p>
      </div>
      {collabTypes.length === 0 ? (
        <p className="text-sm text-muted">先在上方勾選想接的合作形式。</p>
      ) : (
        <>
          {hasUnsavedTypes && (
            <Notice tone="info">報價要先儲存合作形式才能填：請先按上方的「儲存基本資料」，新勾選的形式才會開放填寫。</Notice>
          )}
          {collabTypes.map((t) => {
            const can = savedCollabTypes.includes(t);
            return (
              <Field key={t} label={`${t}（NT$）`} error={fe[`price:${t}`]} hint={can ? undefined : "按上方「儲存基本資料」後就能填這個報價"}>
                {(c) => (
                  <input
                    {...c} name={`price:${t}`} inputMode="numeric" placeholder="例如 4500" disabled={!can}
                    value={can ? (prices[t] ?? "") : ""}
                    onChange={(e) => { setPrices((p) => ({ ...p, [t]: e.target.value })); setShowSaved(false); }}
                    className={input}
                  />
                )}
              </Field>
            );
          })}
          <ErrorText message={error} />
          <div className="flex flex-wrap items-center gap-4">
            <button disabled={pending} className={btn.primary}>{pending ? "儲存中…" : "儲存報價"}</button>
            <SavedMark show={showSaved && !dirty && state.ok === true} />
          </div>
        </>
      )}
    </form>
  );
}
