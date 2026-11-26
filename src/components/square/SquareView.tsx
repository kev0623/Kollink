"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { input } from "@/components/ui/styles";
import { formatNumber } from "@/lib/format";
import {
  SORT_LABELS, SQUARE_SORTS, activeFilterCount, clearFilters, serializeSquareQuery, squareHref,
  type SquareQuery, type SquareSort,
} from "@/lib/creators/square-query";
import type { SquarePage } from "@/lib/creators/square-view";
import type { ViewMode } from "@/lib/creators/view-mode";
import { FilterDrawer } from "./FilterDrawer";
import { FilterPanel } from "./FilterPanel";
import { SquareResults } from "./SquareResults";
import { useViewMode } from "./useViewMode";

type Props = { query: SquareQuery; initial: SquarePage; popularTags: string[] };

/**
 * 廣場外框。篩選與排序只存在網址：改變時 router.push 讓伺服器重新渲染（上一頁逐步退回篩選）（見計畫 4「設計決定」1）。
 * 篩選 UI 用 useOptimistic 立刻反映；結果在轉換期間保留舊的並降低透明度。
 */
export function SquareView({ query, initial, popularTags }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(query);
  const [view, setView] = useViewMode();
  const queryKey = serializeSquareQuery(query);

  function navigate(next: SquareQuery) {
    startTransition(() => {
      setShown(next);
      router.push(squareHref(next), { scroll: false });
    });
  }

  const panel = (idPrefix: string) => (
    <FilterPanel idPrefix={idPrefix} query={shown} popularTags={popularTags} onChange={navigate} />
  );

  return (
    <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
      <aside aria-label="篩選" className="hidden lg:block">{panel("side")}</aside>
      <section aria-label="搜尋結果" className="min-w-0">
        <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center gap-3 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
          <FilterDrawer count={activeFilterCount(shown)} total={initial.total}>{panel("drawer")}</FilterDrawer>
          <p className="text-sm text-muted" aria-live="polite">共 {formatNumber(initial.total)} 位創作者</p>
          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="square-sort" className="sr-only">排序</label>
            <select
              id="square-sort"
              value={shown.sort}
              onChange={(e) => navigate({ ...shown, sort: e.target.value as SquareSort })}
              className={input}
            >
              {SQUARE_SORTS.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
            </select>
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>
        <div aria-busy={pending} className={`transition-opacity ${pending ? "opacity-60" : ""}`}>
          <SquareResults
            key={`${router.bfcacheId}|${queryKey}`}
            initial={initial}
            query={query}
            queryKey={queryKey}
            view={view}
            onSort={(sort) => navigate({ ...shown, sort })}
            onClear={() => navigate(clearFilters(shown))}
          />
        </div>
      </section>
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const btn = (on: boolean) =>
    `flex h-11 w-11 items-center justify-center rounded-btn ${on ? "bg-ink text-on-ink" : "text-ink hover:bg-subtle"}`;
  return (
    <div role="group" aria-label="顯示方式" className="flex gap-0.5 rounded-btn border border-line bg-surface p-0.5">
      <button type="button" aria-pressed={view === "card"} onClick={() => onChange("card")} className={btn(view === "card")}>
        <LayoutGrid size={16} strokeWidth={1.5} aria-hidden="true" /><span className="sr-only">卡片</span>
      </button>
      <button type="button" aria-pressed={view === "list"} onClick={() => onChange("list")} className={btn(view === "list")}>
        <List size={16} strokeWidth={1.5} aria-hidden="true" /><span className="sr-only">列表</span>
      </button>
    </div>
  );
}
