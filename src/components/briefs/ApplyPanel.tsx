"use client";

import { useActionState, useState } from "react";
import { applyToBriefAction, withdrawApplicationAction, type ApplyFormState } from "@/app/creator/actions";
import { Field } from "@/components/forms/Field";
import { ErrorText } from "@/components/ui/ErrorText";
import { btn, input, textarea } from "@/components/ui/styles";
import { useKeyboardPanel } from "@/components/ui/useKeyboardInset";
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
// max-h 用 dvh：手機瀏覽器的網址列收合時不會算錯。鍵盤彈出時由 useKeyboardPanel 另外縮小並移到鍵盤上方。
const shell = "sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[5] max-h-[70dvh] overflow-y-auto overscroll-contain rounded-card border border-line bg-surface p-4 md:bottom-auto md:top-6 md:max-h-none md:p-5";
const primary = `${btn.primary} w-full`;

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
              label="撤回報名" danger icon="undo" confirmLabel="確定撤回"
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
  const panel = useKeyboardPanel();

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
          <button type="button" onClick={() => setStage("form")} className={`${btn.primary} flex-1 px-4`}>仍要報名</button>
          <button type="button" onClick={() => setStage("idle")} className={`${btn.secondary} flex-1 px-4`}>取消</button>
        </div>
      </aside>
    );
  }
  return (
    <aside aria-label="報名" className={shell} style={panel.style} onFocus={panel.onFocus}>
      <form action={action} noValidate className="space-y-3">
        <input type="hidden" name="briefId" value={briefId} />
        <Field label="給品牌的話（選填）" error={fe.message} hint="500 字以內">
          {(c) => (
            <textarea {...c} name="message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className={textarea} />
          )}
        </Field>
        <p aria-live="polite" className={`-mt-2 text-right text-xs ${tooLong ? "font-semibold text-danger" : "text-muted"}`}>
          {count}/{MESSAGE_MAX}{tooLong ? "，超過上限" : ""}
        </p>
        <Field label="提出不同的報價（NT$，選填）" error={fe.proposedPrice} hint="留空代表依招募預算">
          {(c) => <input {...c} name="proposedPrice" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="例如 8000" className={input} />}
        </Field>
        <ErrorText message={state.formError} />
        <div className="flex gap-2">
          <button disabled={pending || tooLong} className={`${btn.primary} flex-1`}>{pending ? "送出中…" : "送出報名"}</button>
          <button type="button" onClick={() => setStage("idle")} disabled={pending}
            className={`${btn.secondary} shrink-0 px-4`}>取消</button>
        </div>
      </form>
    </aside>
  );
}
