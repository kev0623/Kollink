"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/forms/Field";
import { ErrorText } from "@/components/ui/ErrorText";
import { Notice } from "@/components/ui/Notice";
import { SupportLink } from "@/components/ui/SupportLink";
import { btn, input, textarea } from "@/components/ui/styles";
import { textLength } from "@/lib/validation/brief";
import { formatTwd } from "@/lib/format";
import { PAYMENT_MAX_TWD } from "@/lib/payments/limits";
import {
  DELIVERABLES_MAX, exceedsOnlineLimit, needsCreatorConsent, parseAmount, TITLE_MAX, validateOffer,
} from "@/lib/validation/collab";

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

/**
 * 合作條件表單（直接邀請與錄取共用）。欄位全部受控：伺服器回錯誤時不會被 React 重設。
 * 金額超過線上付款上限時，要勾選「我了解這筆要線下付款」才能送出（伺服器的 validateOffer 也會擋）。
 */
export function OfferForm({ action, hidden, withTitle, defaults, submitLabel, onCancel, proposedPrice = null }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<OfferState, FormData>(action, {});
  const [title, setTitle] = useState(defaults.title ?? "");
  const [amount, setAmount] = useState(defaults.amount);
  const [deliverables, setDeliverables] = useState(defaults.deliverables);
  const [offlineAck, setOfflineAck] = useState(false);
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
        const errs = validateOffer({ title: title.trim(), deliverables: deliverables.trim(), amount, offlineAck }, withTitle);
        setClientErrors(errs);
        if (errs) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {withTitle && (
        <Field label="案名" error={fe.title} hint={`${TITLE_MAX} 字以內`}>
          {(c) => <input {...c} name="title" value={title} onChange={(e) => setTitle(e.target.value)} className={input} />}
        </Field>
      )}
      <Field label="交付內容" error={fe.deliverables} hint="例如：IG 貼文 1 篇 + 限時動態 2 則">
        {(c) => (
          <textarea {...c} name="deliverables" rows={4} value={deliverables} onChange={(e) => setDeliverables(e.target.value)} className={textarea} />
        )}
      </Field>
      <p aria-live="polite" className={`-mt-2 text-right text-xs tabular-nums ${count > DELIVERABLES_MAX ? "font-bold text-danger" : "text-muted"}`}>
        {count}/{DELIVERABLES_MAX}
      </p>
      <Field
        label="金額（NT$）" error={fe.amount}
        hint={amountPreview ? `NT$${amountPreview.toLocaleString("en-US")}` : `1 到 10,000,000 的整數（線上付款上限 ${formatTwd(PAYMENT_MAX_TWD)}）`}
      >
        {(c) => <input {...c} name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={input} />}
      </Field>
      {exceedsOnlineLimit(amountPreview) && (
        <Notice tone="warning" title={`超過線上付款上限 ${formatTwd(PAYMENT_MAX_TWD)}`}>
          <p>建立後無法線上付款，需要由平台協助線下匯款。</p>
          <SupportLink subject="線下付款" />
          <label className="mt-1 flex min-h-11 items-center gap-2 font-bold">
            <input
              type="checkbox" name="offlineAck" value="1" checked={offlineAck} onChange={(e) => setOfflineAck(e.target.checked)}
              aria-invalid={fe.offlineAck ? true : undefined} aria-describedby={fe.offlineAck ? "offline-ack-error" : undefined}
            />
            我了解這筆要線下付款
          </label>
          {fe.offlineAck && <p id="offline-ack-error" className="text-sm text-danger">{fe.offlineAck}</p>}
        </Notice>
      )}
      {proposedPrice !== null && (
        <div aria-live="polite" className="space-y-2 text-sm">
          <p className="text-muted">創作者的報價：<span className="font-bold text-ink">{formatTwd(proposedPrice)}</span></p>
          {needsCreatorConsent(amountPreview, proposedPrice) && (
            <Notice tone="warning">低於創作者的報價，需要對方確認後才能付款。</Notice>
          )}
        </div>
      )}
      {state.stale
        ? <p role="status" className="text-sm text-muted">狀態已更新，已為你重新整理</p>
        : <ErrorText message={state.formError} subject="合作條件" />}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button disabled={pending} className={`${btn.primary} w-full sm:w-auto`}>
          {pending ? "送出中…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={`${btn.secondary} w-full sm:w-auto`}>
          取消
        </button>
      </div>
    </form>
  );
}
