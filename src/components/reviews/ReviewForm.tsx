"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { ErrorText } from "@/components/ui/ErrorText";
import { btn, textarea } from "@/components/ui/styles";
import { submitReviewAction } from "@/lib/reviews/actions";
import { RATING_LABEL, REVIEW_COMMENT_MAX, validateReviewComment } from "@/lib/reviews/view";
import { textLength } from "@/lib/validation/brief";

/** 寫評價：1–5 星（必選）＋文字（選填）。送出後不能修改，所以按鈕文字與說明都講清楚。 */
export function ReviewForm({ collabId, counterpart }: { collabId: string; counterpart: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = useId();
  const count = textLength(comment);
  const over = count > REVIEW_COMMENT_MAX;

  function submit() {
    setError(null);
    if (rating === 0) return setError("請選擇星數");
    const invalid = validateReviewComment(comment.trim());
    if (invalid) return setError(invalid);
    startTransition(async () => {
      try {
        const res = await submitReviewAction(collabId, rating, comment);
        if (!res.ok && !res.stale) setError(res.error);
        else router.refresh();
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
      <fieldset disabled={pending} className="min-w-0">
        <legend className="text-sm font-bold text-ink">這次和{counterpart}合作的整體感受</legend>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-btn has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus">
                <input
                  type="radio" name={`${id}-rating`} value={n} checked={rating === n}
                  onChange={() => { setRating(n); setError(null); }} className="peer sr-only"
                />
                <Star
                  size={28} strokeWidth={1.5} aria-hidden="true"
                  className={n <= rating ? "fill-current text-primary" : "text-muted"}
                />
                <span className="sr-only">{n} 顆星，{RATING_LABEL[n]}</span>
              </label>
            ))}
          </div>
          <p aria-live="polite" className="text-sm font-semibold text-ink">{rating > 0 ? RATING_LABEL[rating] : ""}</p>
        </div>
      </fieldset>
      <label htmlFor={`${id}-comment`} className="mt-3 block text-sm font-bold text-ink">想說的話（選填）</label>
      <textarea
        id={`${id}-comment`} rows={4} value={comment} disabled={pending}
        onChange={(e) => setComment(e.target.value)}
        placeholder="例如：溝通是否順利、是否準時、成果是否符合期待"
        aria-invalid={over ? true : undefined} className={`${textarea} mt-1.5`}
      />
      <p aria-live="polite" className={`mt-1 text-right text-xs tabular-nums ${over ? "font-bold text-danger" : "text-muted"}`}>
        {count}/{REVIEW_COMMENT_MAX}
      </p>
      <div className="mt-1"><ErrorText message={error} /></div>
      <button type="submit" disabled={pending || over} className={`${btn.primary} mt-3 w-full sm:w-auto`}>
        {pending ? "送出中…" : "送出評價"}
      </button>
    </form>
  );
}
