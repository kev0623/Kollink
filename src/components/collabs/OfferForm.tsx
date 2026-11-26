"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, inputClass } from "@/components/forms/Field";
import { textLength } from "@/lib/validation/brief";
import { formatTwd } from "@/lib/format";
import { DELIVERABLES_MAX, needsCreatorConsent, parseAmount, TITLE_MAX, validateOffer } from "@/lib/validation/collab";

export type OfferState = { fieldErrors?: Record<string, string>; formError?: string; stale?: boolean };

type Props = {
  action: (prev: OfferState, fd: FormData) => Promise<OfferState>;
  /** 隱藏欄位（creatorId，或 applicationId + briefId） */
  hidden: Record<string, string>;
  /** 直接邀請要填案名；錄取時案名 = 招募名稱 */
  withTitle: boolean;
  defaults: { title?: string; amount: string; deliverables: string };
  submitLabel: string;
  onCancel: () => void;
  /** 錄取時：創作者報名提出的報價（沒有報價是 null）。金額低於報價時要創作者確認後才能付款。 */
  proposedPrice?: number | null;
};

/** 合作條件表單（直接邀請與錄取共用）。欄位全部受控：伺服器回錯誤時不會被 React 重設。 */
export function OfferForm({ action, hidden, withTitle, defaults, submitLabel, onCancel, proposedPrice = null }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<OfferState, FormData>(action, {});
  const [title, setTitle] = useState(defaults.title ?? "");
  const [amount, setAmount] = useState(defaults.amount);
  const [deliverables, setDeliverables] = useState(defaults.deliverables);
  const [clientErrors, setClientErrors] = useState<Record<string, string> | null>(null);
  const fe = clientErrors ?? state.fieldErrors ?? {};

  useEffect(() => {
    // 已被處理過（連點或另一個分頁）：重新整理，畫面會顯示最新狀態
    if (state.stale) router.refresh();
  }, [state, router]);

  const count = textLength(deliverables);
  const amountPreview = parseAmount(amount);
  return (
    <form
      action={formAction} noValidate className="space-y-3"
      onSubmit={(e) => {
        const errs = validateOffer({ title: title.trim(), deliverables: deliverables.trim(), amount }, withTitle);
        setClientErrors(errs);
        if (errs) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {withTitle && (
        <Field label="案名" error={fe.title} hint={`${TITLE_MAX} 字以內`}>
          {(c) => <input {...c} name="title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />}
        </Field>
      )}
      <Field label="交付內容" error={fe.deliverables} hint="例如：IG 貼文 1 篇 + 限時動態 2 則">
        {(c) => (
          <textarea {...c} name="deliverables" rows={4} value={deliverables} onChange={(e) => setDeliverables(e.target.value)}
            className="w-full rounded-input border border-line bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ink" />
        )}
      </Field>
      <p aria-live="polite" className={`-mt-2 text-right text-xs ${count > DELIVERABLES_MAX ? "font-semibold text-danger" : "text-muted"}`}>
        {count}/{DELIVERABLES_MAX}
      </p>
      <Field label="金額（NT$）" error={fe.amount} hint={amountPreview ? `NT$${amountPreview.toLocaleString("en-US")}` : "1 到 10,000,000 的整數"}>
        {(c) => <input {...c} name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />}
      </Field>
      {proposedPrice !== null && (
        <div aria-live="polite" className="-mt-1 space-y-1 text-sm">
          <p className="text-muted">創作者的報價：<span className="font-semibold text-ink">{formatTwd(proposedPrice)}</span></p>
          {needsCreatorConsent(amountPreview, proposedPrice) && (
            <p className="font-semibold text-danger">低於創作者的報價，需要對方確認後才能付款</p>
          )}
        </div>
      )}
      {state.stale
        ? <p role="status" className="text-sm text-muted">狀態已更新，已為你重新整理</p>
        : state.formError && <p role="alert" className="text-sm text-danger">{state.formError}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="h-11 flex-1 rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 sm:flex-none">
          {pending ? "送出中…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={pending}
          className="h-11 shrink-0 rounded-btn border border-line px-4 font-semibold text-ink disabled:opacity-60">
          取消
        </button>
      </div>
    </form>
  );
}
