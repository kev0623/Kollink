import { actionCardCopy, reviewCountdown, type Collab, type CollabSide } from "@/lib/collabs/view";
import type { SubmissionView } from "@/lib/collabs/load";
import type { PaymentAvailability } from "@/lib/payments/config";
import type { PaymentSummary } from "@/lib/payments/view";
import { CollabActions } from "./CollabActions";
import { FileTile } from "./FileTile";

type Props = {
  c: Collab;
  side: CollabSide;
  uid: string;
  latest: SubmissionView | null;
  /** 伺服器在 requireRole 之後算的 Date.now() */
  nowMs: number;
  devPaymentEnabled: boolean;
  payment: PaymentAvailability;
  summary: PaymentSummary;
  /** 事件紀錄裡是否有平台取消（admin_cancel） */
  adminCancelled: boolean;
  /** 創作者還沒有收款帳戶、而這個合作案已付款未撥款：說明文字改成請先設定收款帳戶（QA m19） */
  payoutPrompt?: boolean;
};

/** 「現在要做什麼」卡片（主色外框）：輪到自己時顯示動作；輪到對方時說明在等什麼（文字見 actionCardCopy）。 */
export function ActionCard({ c, side, uid, latest, nowMs, devPaymentEnabled, payment, summary, adminCancelled, payoutPrompt }: Props) {
  const fromApplication = c.briefId !== null;
  const copy = actionCardCopy(c.status, side, adminCancelled, fromApplication);
  const countdown = c.status === "in_review" ? reviewCountdown(c.reviewDueAt, nowMs) : null;
  return (
    <section aria-labelledby="action-title" className={`rounded-card border p-4 md:p-6 ${copy.mine ? "border-primary bg-primary-soft" : "border-line bg-surface"}`}>
      <h2 id="action-title" className="text-lg font-bold text-ink">{copy.title}</h2>
      <p className={`mt-1 text-sm ${copy.mine ? "text-ink" : "text-muted"}`}>{payoutPrompt && side === "creator" && c.status === "awaiting_payout" ? "平台撥款前需要你的收款帳戶，請先設定。" : copy.body}</p>
      {countdown && <p className="mt-2 text-sm font-semibold text-ink">{countdown}</p>}
      {c.status === "awaiting_payout" && c.publishedUrl && (
        <p className="mt-2 min-w-0 break-all text-sm">
          貼文：<a href={c.publishedUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline underline-offset-4 hover:text-accent">{c.publishedUrl}</a>
        </p>
      )}
      {side === "brand" && c.status === "in_review" && latest && latest.files.length > 0 && (
        <ul aria-label="最新一次交稿的檔案" className="mt-3 flex flex-wrap gap-2">
          {latest.files.map((f) => <li key={f.path}><FileTile f={f} /></li>)}
        </ul>
      )}
      <div className="mt-4">
        <CollabActions
          collabId={c.id} status={c.status} side={side} uid={uid} fromApplication={fromApplication}
          devPaymentEnabled={devPaymentEnabled} payment={payment} summary={summary}
        />
      </div>
    </section>
  );
}
