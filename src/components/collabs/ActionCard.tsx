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
};

/** 「現在要做什麼」卡片（主色外框）：輪到自己時顯示動作；輪到對方時明確寫「你不用做任何事」。 */
export function ActionCard({ c, side, uid, latest, nowMs, devPaymentEnabled, payment, summary }: Props) {
  const copy = actionCardCopy(c.status, side);
  const countdown = c.status === "in_review" ? reviewCountdown(c.reviewDueAt, nowMs) : null;
  return (
    <section aria-labelledby="action-title" className={`rounded-card border-2 bg-surface p-4 md:p-5 ${copy.mine ? "border-primary" : "border-line"}`}>
      <h2 id="action-title" className="text-lg font-bold text-ink">{copy.title}</h2>
      <p className="mt-1 text-sm text-muted">{copy.body}</p>
      {countdown && <p className="mt-2 text-sm font-semibold text-ink">{countdown}</p>}
      {c.status === "awaiting_payout" && c.publishedUrl && (
        <p className="mt-2 min-w-0 break-all text-sm">
          貼文：<a href={c.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2">{c.publishedUrl}</a>
        </p>
      )}
      {side === "brand" && c.status === "in_review" && latest && latest.files.length > 0 && (
        <ul aria-label="最新一次交稿的檔案" className="mt-3 flex flex-wrap gap-2">
          {latest.files.map((f) => <li key={f.path}><FileTile f={f} /></li>)}
        </ul>
      )}
      <div className="mt-4">
        <CollabActions
          collabId={c.id} status={c.status} side={side} uid={uid}
          devPaymentEnabled={devPaymentEnabled} payment={payment} summary={summary}
        />
      </div>
    </section>
  );
}
