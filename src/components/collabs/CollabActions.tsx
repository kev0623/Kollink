"use client";

import { useState } from "react";
import { brandCollabAction } from "@/app/brand/collabs/actions";
import { creatorCollabAction } from "@/app/creator/collabs/actions";
import { ConfirmAction } from "@/components/briefs/ConfirmAction";
import type { CollabSide, CollabStatus } from "@/lib/collabs/view";
import { PublishForm } from "./PublishForm";
import { RevisionForm } from "./RevisionForm";
import { SubmitPanel } from "./SubmitPanel";
import { useCollabAction } from "./useCollabAction";

type Props = { collabId: string; status: CollabStatus; side: CollabSide; uid: string; devPaymentEnabled: boolean };

const primary = "h-11 w-full rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 sm:w-auto";

/** 「現在要做什麼」卡片裡的按鈕（依狀態與視角）。 */
export function CollabActions({ collabId, status, side, uid, devPaymentEnabled }: Props) {
  if (side === "creator" && status === "invited") return <InviteReply collabId={collabId} />;
  if (side === "brand" && (status === "invited" || status === "awaiting_payment")) {
    return <BrandPayment collabId={collabId} status={status} devPaymentEnabled={devPaymentEnabled} />;
  }
  if (side === "creator" && status === "awaiting_payment" && devPaymentEnabled) return <DevMarkPaid collabId={collabId} />;
  if (side === "creator" && status === "awaiting_submission") return <SubmitPanel collabId={collabId} uid={uid} />;
  if (side === "brand" && status === "in_review") return <Review collabId={collabId} />;
  if (side === "creator" && status === "awaiting_publish") return <PublishForm collabId={collabId} />;
  return null;
}

function Feedback({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted">{notice}</p>}
    </>
  );
}

function InviteReply({ collabId }: { collabId: string }) {
  const { pending, error, notice, run } = useCollabAction();
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={pending} onClick={() => run(() => creatorCollabAction(collabId, "accept"))} className={primary}>
          {pending ? "處理中…" : "接受邀約"}
        </button>
        <ConfirmAction
          label="婉拒" danger confirmLabel="確定婉拒" message="婉拒後品牌需要重新發出邀約，確定要婉拒嗎？"
          onConfirm={() => creatorCollabAction(collabId, "decline")}
        />
      </div>
      <Feedback error={error} notice={notice} />
    </div>
  );
}

function BrandPayment({ collabId, status, devPaymentEnabled }: { collabId: string; status: "invited" | "awaiting_payment"; devPaymentEnabled: boolean }) {
  const [explain, setExplain] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        {status === "awaiting_payment" && (
          <button type="button" onClick={() => setExplain((v) => !v)} aria-expanded={explain} className={primary}>
            確認並付款
          </button>
        )}
        <ConfirmAction
          label={status === "invited" ? "撤回邀約" : "取消合作"} danger confirmLabel="確定取消"
          message="取消後這個合作案就結束了，不能復原。確定要取消嗎？"
          onConfirm={() => brandCollabAction(collabId, "cancel")}
        />
      </div>
      {explain && (
        <p role="status" className="rounded-btn border border-line bg-primary-soft p-3 text-sm text-ink">
          付款功能即將開放。目前由平台人工確認款項，確認後會自動進入交稿階段。
        </p>
      )}
      {status === "awaiting_payment" && devPaymentEnabled && <DevMarkPaid collabId={collabId} />}
    </div>
  );
}

/** 本機測試用：一般的 POST 表單，不需要 JS。只有伺服器判斷 isDevLoginEnabled() 為真時才會渲染。 */
function DevMarkPaid({ collabId }: { collabId: string }) {
  return (
    <form method="post" action="/api/dev/mark-paid">
      <input type="hidden" name="collabId" value={collabId} />
      <button className="h-10 rounded-btn border border-dashed border-line px-4 text-sm font-semibold text-muted">
        標記已付款（本機）
      </button>
    </form>
  );
}

function Review({ collabId }: { collabId: string }) {
  const { pending, error, notice, run } = useCollabAction();
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <button type="button" disabled={pending} onClick={() => run(() => brandCollabAction(collabId, "approve"))} className={primary}>
          {pending ? "處理中…" : "審核通過"}
        </button>
        <RevisionForm collabId={collabId} />
      </div>
      <Feedback error={error} notice={notice} />
    </div>
  );
}
