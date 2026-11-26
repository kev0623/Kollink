import Link from "next/link";
import { COLLAB_STATUS_LABEL, COLLAB_TABS, listBadge, type CollabListItem, type CollabSide, type CollabTab } from "@/lib/collabs/view";
import { EmptyState } from "@/components/ui/EmptyState";
import { chip, rows } from "@/components/ui/styles";
import { formatDateTw } from "@/lib/briefs/dates";
import { formatTwd } from "@/lib/format";
import { CollabStatusBadge, TurnBadge } from "./CollabStatusBadge";
import { Counterpart } from "./Counterpart";

const EMPTY: Record<CollabSide, { text: string; action: { href: string; label: string } }> = {
  brand: { text: "還沒有合作案。到創作者廣場邀請第一位創作者。", action: { href: "/brand", label: "去創作者廣場" } },
  creator: { text: "還沒有合作。看看最新的機會。", action: { href: "/creator", label: "看機會" } },
};

/** 分頁標籤（連結，寫進 ?tab=）。 */
export function CollabTabs({ side, tab }: { side: CollabSide; tab: CollabTab }) {
  return (
    <nav aria-label="合作案狀態" className="scroll-fade-x flex gap-2 overflow-x-auto">
      {COLLAB_TABS.map((t) => {
        const active = t.value === tab;
        const href = t.value === "active" ? `/${side}/collabs` : `/${side}/collabs?tab=${t.value}`;
        return (
          <Link
            key={t.value} href={href} aria-current={active ? "page" : undefined}
            className={chip(active)}
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
      <div className="mt-6">
        {tab === "active"
          ? <EmptyState text={EMPTY[side].text} action={EMPTY[side].action} />
          : <EmptyState text="這裡還沒有合作案。" />}
      </div>
    );
  }
  return (
    <ul className={`${rows} mt-4`}>
      {items.map((c) => {
        const rawBadge = tab === "active" ? listBadge(c.status, side) : null;
        // 「撥款處理中」已經是狀態標記，不再重複顯示成輪到誰的標記
        const badge = rawBadge && rawBadge.label !== COLLAB_STATUS_LABEL[c.status] ? rawBadge : null;
        return (
          <li key={c.id}>
            <Link
              href={`/${side}/collabs/${c.id}`}
              className={`flex min-h-11 items-start gap-3 px-4 py-3 hover:bg-subtle md:px-5 md:py-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus`}
            >
              <Counterpart side={side} name={c.counterpartName} imagePath={c.counterpartImagePath} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words font-bold text-ink">{c.title}</p>
                  {badge && <TurnBadge badge={badge} />}
                </div>
                <p className="mt-0.5 min-w-0 break-words text-sm text-muted">{c.counterpartName}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-bold tabular-nums text-ink">{formatTwd(c.amount)}</span>
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
