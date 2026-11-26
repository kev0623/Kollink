import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { row, rows } from "@/components/ui/styles";
import { formatDateTw } from "@/lib/briefs/dates";
import { displayStatusOf, rewardLabel, type MyApplication } from "@/lib/briefs/view";
import { ApplicationStatusBadge } from "./StatusBadges";

/** 我的報名：報名過的招募與狀態（待回覆、已錄取、未錄取、已撤回）。 */
export function MyApplicationList({ items, today }: { items: MyApplication[]; today: string }) {
  if (items.length === 0) return <EmptyState text="還沒有報名。看看最新的機會。" action={{ href: "/creator", label: "看機會" }} />;
  return (
    <ul className={rows}>
      {items.map((a) => {
        const ended = displayStatusOf(a.brief.status, a.brief.deadline, today) !== "open";
        return (
          <li key={a.id}>
            <Link href={`/creator/briefs/${a.brief.id}`} className={row}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted">{a.brief.brandName}</p>
                  <p className="break-words font-semibold text-ink">{a.brief.title}</p>
                </div>
                <ApplicationStatusBadge status={a.status} viewer="creator" />
              </div>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <span className="font-semibold text-accent">{rewardLabel(a.brief)}</span>
                <span>報名於 {formatDateTw(a.createdAt)}</span>
                {ended && <span>招募已結束</span>}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
