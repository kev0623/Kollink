import { Star } from "lucide-react";
import { statsSummary, type ReviewStats } from "@/lib/reviews/view";

/** 一行評分摘要（「★ 4.8（12 則評價）・完成 15 案」）。沒有評價也沒有完成的合作時不顯示任何東西。 */
export function RatingBadge({ stats, className = "" }: { stats: ReviewStats | undefined; className?: string }) {
  if (!stats || (stats.avg === null && stats.completed === 0)) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Star size={12} strokeWidth={1.5} aria-hidden="true" className={stats.avg === null ? "" : "fill-current text-primary"} />
      {statsSummary(stats, "尚無評價")}
    </span>
  );
}
