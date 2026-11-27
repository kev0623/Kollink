"use client";

import { setReviewHiddenAction } from "@/app/admin/actions";
import { Stars } from "@/components/reviews/Stars";
import { formatDateTimeTw } from "@/lib/briefs/dates";
import { adminReviewState, type AdminReview } from "@/lib/reviews/view";
import { NoteAction } from "./NoteAction";

/** 管理員：一個合作案的評價（含還沒公開與已隱藏的），可以隱藏或恢復。participant＝管理員是這個合作案的參與者，不顯示動作。 */
export function AdminReviews({ reviews, nowMs, participant }: { reviews: AdminReview[]; nowMs: number; participant: boolean }) {
  return (
    <section aria-labelledby="admin-reviews-title" className="space-y-2">
      <h2 id="admin-reviews-title" className="text-lg font-bold text-ink">評價</h2>
      {reviews.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-6 text-center text-sm text-muted">還沒有人評價</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {reviews.map((r) => (
            <li key={r.id} className="space-y-2 p-4 text-sm md:p-5">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <b className="text-ink">{r.side === "brand" ? "品牌寫給創作者" : "創作者寫給品牌"}</b>
                <Stars rating={r.rating} />
                <span className="text-xs text-muted">{formatDateTimeTw(r.createdAt)}・{adminReviewState(r, nowMs)}</span>
              </p>
              {r.comment
                ? <p className="whitespace-pre-line break-words text-ink">{r.comment}</p>
                : <p className="text-muted">（沒有文字）</p>}
              {!participant && (r.hiddenAt ? (
                <NoteAction
                  label="恢復顯示" fieldLabel="恢復的原因（只有管理員看得到）" noteName="原因" confirmLabel="恢復顯示"
                  onSubmit={(memo) => setReviewHiddenAction(r.id, false, memo)}
                />
              ) : (
                <NoteAction
                  label="隱藏這則評價" fieldLabel="隱藏的原因（只有管理員看得到）" noteName="原因" confirmLabel="確定隱藏" danger
                  message="隱藏後不會公開，也不列入平均。作者會看到「已被平台隱藏」。"
                  onSubmit={(memo) => setReviewHiddenAction(r.id, true, memo)}
                />
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
