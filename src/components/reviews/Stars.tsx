import { Star } from "lucide-react";
import { RATING_LABEL } from "@/lib/reviews/view";

/** 星數（唯讀）：實心紅星＋空心星；螢幕閱讀器讀「5 顆星中的 4 顆，滿意」。 */
export function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`5 顆星中的 ${rating} 顆，${RATING_LABEL[rating] ?? ""}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n} size={size} strokeWidth={1.5} aria-hidden="true"
          className={n <= rating ? "fill-current text-primary" : "text-line-strong"}
        />
      ))}
    </span>
  );
}
