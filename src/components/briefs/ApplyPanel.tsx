"use client";

import { useActionState, useState } from "react";
import { applyToBriefAction, withdrawApplicationAction, type ApplyFormState } from "@/app/creator/actions";
import { Field, inputClass } from "@/components/forms/Field";
import { MESSAGE_MAX, textLength } from "@/lib/validation/brief";
import { proposedPriceLabel, type ApplicationStatus } from "@/lib/briefs/view";
import { ConfirmAction } from "./ConfirmAction";
import { ApplicationStatusBadge } from "./StatusBadges";

type Props = {
  briefId: string;
  approved: boolean;
  /** 已關閉或已截止 */
  ended: boolean;
  isMatch: boolean;
  application: { id: string; status: ApplicationStatus; message: string | null; proposedPrice: number | null } | null;
};

// 手機：固定在底部（底部導覽列上方）；桌面：右欄、捲動時固定在上方
const shell = "sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[5] max-h-[70vh] overflow-y-auto rounded-card border border-line bg-surface p-4 md:bottom-auto md:top-6 md:max-h-none md:p-5";
const primary = "h-11 w-full rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60";

export function ApplyPanel({ briefId, approved, ended, isMatch, application }: Props) {
  if (application) {
    return (
      <aside aria-label="報名" className={shell}>
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-ink">你已報名</p>
          <ApplicationStatusBadge status={application.status} viewer="creator" />
        </div>
        <p className="mt-2 text-sm text-muted">報價：{proposedPriceLabel(application.proposedPrice)}</p>
        {application.message && <p className="mt-1 whitespace-pre-line break-words text-sm text-ink">{application.message}</p>}
        {application.status === "applied" && (
          <div className="mt-3">
            <ConfirmAction
              label="撤回報名" danger confirmLabel="確定撤回"
              message="撤回後不能再報名這則招募，確定要撤回嗎？"
              onConfirm={() => withdrawApplicationAction(application.id, briefId)}
            />
          </div>
        )}
      </aside>
    );
  }
  if (ended) {
    return (
      <aside aria-label="報名" className={shell}>
        <button type="button" disabled className={primary}>已結束</button>
      </aside>
    );
  }
  if (!approved) {
    return (
      <aside aria-label="報名" className={shell}>
        <button type="button" disabled aria-describedby="apply-note" className={primary}>報名</button>
        <p id="apply-note" className="mt-2 text-center text-sm text-muted">審核通過後即可報名</p>
      </aside>
    );
  }
  return <ApplyForm briefId={briefId} isMatch={isMatch} />;
}

function ApplyForm({ briefId, isMatch }: { briefId: string; isMatch: boolean }) {
  const [stage, setStage] = useState<"idle" | "warn" | "form">("idle");
  const [state, action, pending] = useActionState<ApplyFormState, FormData>(applyToBriefAction, {});
  const fe = state.fieldErrors ?? {};
  // 受控：React 在 action 結束後會重設表單，驗證失敗時不能把使用者打的字清掉
  const [message, setMessage] = useState("");
  const [price, setPrice] = useState("");
  const count = textLength(message);
  const tooLong = count > MESSAGE_MAX;

  if (stage === "idle") {
    return (
      <aside aria-label="報名" className={shell}>
        <button type="button" onClick={() => setStage(isMatch ? "form" : "warn")} className={primary}>報名</button>
      </aside>
    );
  }
  if (stage === "warn") {
    return (
      <aside aria-label="報名" className={shell}>
        <p role="status" className="text-sm font-semibold text-ink">你的條件不完全符合，仍要報名嗎？</p>
        <p className="mt-1 text-xs text-muted">條件是給品牌的參考，不是硬性限制。</p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setStage("form")} className="h-10 flex-1 rounded-btn bg-ink text-sm font-semibold text-on-ink">仍要報名</button>
          <button type="button" onClick={() => setStage("idle")} className="h-10 flex-1 rounded-btn border border-line text-sm font-semibold text-ink">取消</button>
        </div>
      </aside>
    );
  }
  return (
    <aside aria-label="報名" className={shell}>
      <form action={action} noValidate className="space-y-3">
        <input type="hidden" name="briefId" value={briefId} />
        <Field label="給品牌的話（選填）" error={fe.message} hint="500 字以內">
          {(c) => (
            <textarea {...c} name="message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-input border border-line bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ink" />
          )}
        </Field>
        <p aria-live="polite" className={`-mt-2 text-right text-xs ${tooLong ? "font-semibold text-danger" : "text-muted"}`}>
          {count}/{MESSAGE_MAX}{tooLong ? "，超過上限" : ""}
        </p>
        <Field label="提出不同的報價（NT$，選填）" error={fe.proposedPrice} hint="留空代表依招募預算">
          {(c) => <input {...c} name="proposedPrice" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="例如 8000" className={inputClass} />}
        </Field>
        {state.formError && <p role="alert" className="text-sm text-danger">{state.formError}</p>}
        <div className="flex gap-2">
          <button disabled={pending || tooLong} className={primary}>{pending ? "送出中…" : "送出報名"}</button>
          <button type="button" onClick={() => setStage("idle")} disabled={pending}
            className="h-11 shrink-0 rounded-btn border border-line px-4 font-semibold text-ink">取消</button>
        </div>
      </form>
    </aside>
  );
}
