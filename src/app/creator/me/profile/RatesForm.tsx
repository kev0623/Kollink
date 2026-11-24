"use client";
import { useActionState } from "react";
import { Field, inputClass } from "@/components/forms/Field";
import type { FormState } from "@/lib/auth/account-errors";
import type { Rate } from "@/lib/creators/view";
import { updateRatesAction } from "./actions";

export function RatesForm({ collabTypes, initial }: { collabTypes: string[]; initial: Rate[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateRatesAction, {});
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const k = JSON.stringify(state.values ?? initial);
  const priceOf = (t: string) => {
    const key = `price:${t}`;
    if (typeof v[key] === "string") return v[key] as string;
    const r = initial.find((x) => x.collabType === t);
    return r ? String(r.priceTwd) : "";
  };
  const error = fe.rates ?? state.formError;
  return (
    <form action={action} className="max-w-xl space-y-4 rounded-card border border-line bg-surface p-5 md:p-8">
      <div>
        <h2 className="text-lg font-bold text-ink">報價</h2>
        <p className="mt-1 text-sm text-muted">只有登入的品牌看得到。留空代表不提供這個合作形式的報價。</p>
      </div>
      {collabTypes.length === 0 ? (
        <p className="text-sm text-muted">先在「基本資料」勾選想接的合作並儲存，才能設定報價。</p>
      ) : (
        <>
          {collabTypes.map((t) => (
            <Field key={t} label={`${t}（NT$）`} error={fe[`price:${t}`]}>
              {(c) => (
                <input key={k} {...c} name={`price:${t}`} inputMode="numeric" placeholder="例如 4500" defaultValue={priceOf(t)} className={inputClass} />
              )}
            </Field>
          ))}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {state.ok && <p role="status" className="text-sm text-success">已儲存</p>}
          <button disabled={pending} className="h-11 w-full rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 md:w-auto">
            儲存報價
          </button>
        </>
      )}
    </form>
  );
}
