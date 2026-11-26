import Link from "next/link";
import { COLLAB_TABS, listBadge, type CollabListItem, type CollabSide, type CollabTab } from "@/lib/collabs/view";
import { formatDateTw } from "@/lib/briefs/dates";
import { formatTwd } from "@/lib/format";
import { CollabStatusBadge, TurnBadge } from "./CollabStatusBadge";
import { Counterpart } from "./Counterpart";

const EMPTY: Record<CollabSide, string> = {
  brand: "還沒有合作案。到創作者廣場邀請，或從招募錄取創作者。",
  creator: "還沒有合作案。到機會頁報名招募吧。",
};

/** 分頁標籤（連結，寫進 ?tab=）。 */
export function CollabTabs({ side, tab }: { side: CollabSide; tab: CollabTab }) {
  return (
    <nav aria-label="合作案狀態" className="flex gap-2">
      {COLLAB_TABS.map((t) => {
        const active = t.value === tab;
        const href = t.value === "active" ? `/${side}/collabs` : `/${side}/collabs?tab=${t.value}`;
        return (
          <Link
            key={t.value} href={href} aria-current={active ? "page" : undefined}
            className={`h-9 rounded-full border px-4 text-sm font-semibold leading-9 ${active ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** 合作案列表（已由資料庫排序：輪到你的在前，其次依更新時間）。 */
export function CollabList({ side, tab, items }: { side: CollabSide; tab: CollabTab; items: CollabListItem[] }) {
  if (items.length === 0) {
    return (
      <p className="mt-6 rounded-card border border-line bg-surface p-8 text-center text-sm text-muted">
        {tab === "active" ? EMPTY[side] : "這裡還沒有合作案"}
      </p>
    );
  }
  return (
    <ul className="mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {items.map((c) => {
        const badge = tab === "active" ? listBadge(c.status, side) : null;
        return (
          <li key={c.id}>
            <Link
              href={`/${side}/collabs/${c.id}`}
              className="flex items-start gap-3 p-4 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink md:p-5"
            >
              <Counterpart side={side} name={c.counterpartName} imagePath={c.counterpartImagePath} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words font-semibold text-ink">{c.title}</p>
                  {badge && <TurnBadge badge={badge} />}
                </div>
                <p className="mt-0.5 min-w-0 break-words text-sm text-muted">{c.counterpartName}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-semibold text-accent">{formatTwd(c.amount)}</span>
                  <CollabStatusBadge status={c.status} />
                  {c.updatedAt && <span className="text-xs text-muted">更新於 {formatDateTw(c.updatedAt)}</span>}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
