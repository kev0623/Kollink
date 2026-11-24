import Link from "next/link";
import { formatDateTw } from "@/lib/briefs/dates";
import { displayStatusOf, rewardLabel, type MyApplication } from "@/lib/briefs/view";
import { ApplicationStatusBadge } from "./StatusBadges";

/** 我的報名：報名過的招募與狀態（待回覆、已錄取、未錄取、已撤回）。 */
export function MyApplicationList({ items, today }: { items: MyApplication[]; today: string }) {
  if (items.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface p-8 text-center">
        <p className="font-semibold text-ink">還沒有報名任何招募</p>
        <Link href="/creator" className="mt-4 inline-flex h-10 items-center rounded-btn border border-line px-4 text-sm font-semibold text-ink hover:bg-primary-soft">
          看看適合我的機會
        </Link>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {items.map((a) => {
        const ended = displayStatusOf(a.brief.status, a.brief.deadline, today) !== "open";
        return (
          <li key={a.id}>
            <Link href={`/creator/briefs/${a.brief.id}`} className="block p-4 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted">{a.brief.brandName}</p>
                  <p className="break-words font-semibold text-ink">{a.brief.title}</p>
                </div>
                <ApplicationStatusBadge status={a.status} viewer="creator" />
              </div>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <span className="font-semibold text-primary">{rewardLabel(a.brief)}</span>
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
