import { EyeOff } from "lucide-react";
import { formatDateTw } from "@/lib/briefs/dates";
import { h2 } from "@/components/ui/styles";
import { REVIEW_WINDOW_DAYS, theirReviewHint, type CollabReviews, type ReviewBody } from "@/lib/reviews/view";
import { ReviewForm } from "./ReviewForm";
import { Stars } from "./Stars";

type Props = { collabId: string; reviews: CollabReviews; counterpart: string; nowMs: number };

/** 合作案詳情的評價區（已完成的合作案才有）：自己的評價或表單，加上對方的評價或還看不到的原因。 */
export function CollabReviewSection({ collabId, reviews: r, counterpart, nowMs }: Props) {
  const hint = theirReviewHint(r, counterpart, nowMs);
  return (
    <section aria-labelledby="reviews-title">
      <h2 id="reviews-title" className={h2}>評價</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className={`rounded-card border p-4 md:p-5 ${r.canReview ? "border-primary bg-primary-soft" : "border-line bg-surface"}`}>
          <h3 className="text-sm font-bold text-ink">你的評價</h3>
          {r.mine ? (
            <>
              <ReviewText body={r.mine} />
              {r.mine.hidden && (
                <p className="mt-3 flex items-start gap-2 text-sm text-muted">
                  <EyeOff size={16} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0" />
                  這則評價已被平台隱藏，不會公開。有疑問請聯絡平台。
                </p>
              )}
            </>
          ) : r.canReview ? (
            <div className="mt-2">
              <p className="mb-3 text-sm text-ink">
                雙方都寫完，或 {formatDateTw(r.closesAt)} 之後才會公開，寫之前看不到對方的內容。送出後不能修改。
              </p>
              <ReviewForm collabId={collabId} counterpart={counterpart} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">評價期限已過（完成後 {REVIEW_WINDOW_DAYS} 天內），這次沒有留下評價。</p>
          )}
        </div>
        <div className="rounded-card border border-line bg-surface p-4 md:p-5">
          <h3 className="text-sm font-bold text-ink">{counterpart}給你的評價</h3>
          {r.theirs ? <ReviewText body={r.theirs} /> : <p className="mt-2 text-sm text-muted">{hint}</p>}
        </div>
      </div>
    </section>
  );
}

function ReviewText({ body }: { body: ReviewBody }) {
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars rating={body.rating} size={18} />
        {body.createdAt && <span className="text-xs text-muted">{formatDateTw(body.createdAt)}</span>}
      </div>
      {body.comment && <p className="mt-2 whitespace-pre-line break-words text-sm text-ink">{body.comment}</p>}
    </div>
  );
}
