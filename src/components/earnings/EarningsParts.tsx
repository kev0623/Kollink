import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { card, chip, rows } from "@/components/ui/styles";
import { CollabStatusBadge } from "@/components/collabs/CollabStatusBadge";
import { Counterpart } from "@/components/collabs/Counterpart";
import { formatDateTw } from "@/lib/briefs/dates";
import { formatTwd } from "@/lib/format";
import type { CollabListItem, CollabSide } from "@/lib/collabs/view";

export type SummaryFigure = { label: string; amount: number; caption: string };

/** 金額摘要：serif 等寬數字；手機直排、桌面橫排。 */
export function SummaryCard({ figures, label }: { figures: SummaryFigure[]; label: string }) {
  return (
    <section aria-label={label} className={`${card} grid divide-y divide-line md:divide-x md:divide-y-0 ${figures.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      {figures.map((f) => (
        <div key={f.label} className="min-w-0 p-5 md:p-6">
          <p className="text-sm font-bold text-muted">{f.label}</p>
          <p className="mt-1 break-words font-serif text-[28px] font-bold leading-tight tabular-nums text-ink">{formatTwd(f.amount)}</p>
          <p className="mt-1 text-sm text-muted">{f.caption}</p>
        </div>
      ))}
    </section>
  );
}

export function TruncatedNote() {
  return (
    <Notice tone="info" className="mt-4">
      合作案很多，上面的金額只統計最近更新的部分，可能比實際少。
    </Notice>
  );
}

/** 篩選標籤（連結，寫進 ?view=；第一個是預設，不帶參數）。 */
export function ViewChips<V extends string>({ basePath, views, current, label }: {
  basePath: string; views: { value: V; label: string }[]; current: V; label: string;
}) {
  return (
    <nav aria-label={label} className="scroll-fade-x mt-6 flex gap-2 overflow-x-auto">
      {views.map((v, i) => (
        <Link
          key={v.value} href={i === 0 ? basePath : `${basePath}?view=${v.value}`}
          aria-current={v.value === current ? "page" : undefined} className={chip(v.value === current)}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  );
}

/** 一列一筆合作案（列表用 rows，不用卡片）：對方、標題、金額、狀態、更新日期。 */
export function MoneyRows({ side, items, empty }: { side: CollabSide; items: CollabListItem[]; empty: React.ReactNode }) {
  if (items.length === 0) return <div className="mt-4">{empty}</div>;
  return (
    <ul className={`${rows} mt-4`}>
      {items.map((c) => (
        <li key={c.id}>
          <Link
            href={`/${side}/collabs/${c.id}`}
            className="flex min-h-11 items-start gap-3 px-4 py-3 hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus md:px-5 md:py-4"
          >
            <Counterpart side={side} name={c.counterpartName} imagePath={c.counterpartImagePath} />
            <div className="min-w-0 flex-1">
              <p className="min-w-0 break-words font-bold text-ink">{c.title}</p>
              <p className="mt-0.5 min-w-0 break-words text-sm text-muted">{c.counterpartName}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-bold tabular-nums text-ink">{formatTwd(c.amount)}</span>
                <CollabStatusBadge status={c.status} />
                {c.updatedAt && <span className="text-xs text-muted">更新於 {formatDateTw(c.updatedAt)}</span>}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function FilterEmpty() {
  return <EmptyState text="這個分類目前沒有合作案。" />;
}

/** 與頁面版面一致的骨架：摘要卡＋標籤＋列。 */
export function MoneySkeleton({ figures }: { figures: 2 | 3 }) {
  return (
    <div aria-busy="true">
      <p className="sr-only">載入中…</p>
      <div className={`${card} grid divide-y divide-line md:divide-x md:divide-y-0 ${figures === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {Array.from({ length: figures }, (_, i) => (
          <div key={i} className="space-y-2 p-5 md:p-6">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-48 max-w-full" />
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-2">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-11 w-24 rounded-btn" />)}
      </div>
      <div className={`${rows} mt-4`}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-4 md:px-5">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
