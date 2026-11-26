"use client";

import { useState, useTransition } from "react";
import { loadMoreCreatorsAction, type LoadMoreResult } from "@/app/brand/actions";
import { emptyStateOf, type SquareQuery, type SquareSort } from "@/lib/creators/square-query";
import { appendUnique, type SquareCreator, type SquarePage } from "@/lib/creators/square-view";
import type { ViewMode } from "@/lib/creators/view-mode";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorText } from "@/components/ui/ErrorText";
import { btn } from "@/components/ui/styles";
import { CreatorCard } from "./CreatorCard";
import { CreatorTable } from "./CreatorTable";

type Props = {
  initial: SquarePage;
  query: SquareQuery;
  /** 目前網址的查詢字串，載入更多時原樣送給伺服器重新解析 */
  queryKey: string;
  view: ViewMode;
  onSort: (sort: SquareSort) => void;
  onClear: () => void;
};

async function fetchMore(queryKey: string, offset: number): Promise<LoadMoreResult> {
  try {
    return (await loadMoreCreatorsAction(queryKey, offset)) ?? { ok: false, error: "請重新登入" };
  } catch {
    return { ok: false, error: "載入失敗，請稍後再試" };
  }
}

/**
 * 結果區。父層用 key={`${bfcacheId}|${queryKey}`} 重設：換篩選或重新進入頁面時從第一批開始。
 * 載入更多的結果存在這裡（見計畫 4「設計決定」2）。
 */
export function SquareResults({ initial, query, queryKey, view, onSort, onClear }: Props) {
  const [extra, setExtra] = useState<SquareCreator[]>([]);
  // 伺服器已回傳的筆數（含去重掉的），用來算下一次的 offset
  const [fetched, setFetched] = useState(0);
  const [moreAfterLoad, setMoreAfterLoad] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const items = appendUnique(initial.items, extra);
  const hasMore = moreAfterLoad ?? initial.hasMore;

  function loadMore() {
    setError(null);
    startLoading(async () => {
      const res = await fetchMore(queryKey, initial.items.length + fetched);
      startLoading(() => {
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setExtra((prev) => appendUnique(prev, res.items));
        setFetched((n) => n + res.items.length);
        setMoreAfterLoad(res.hasMore);
      });
    });
  }

  if (items.length === 0) {
    const noFavorites = emptyStateOf(query) === "no-favorites";
    return (
      noFavorites
        ? <EmptyState text="還沒有收藏的創作者。在卡片、列表或創作者頁按 ♡，就會出現在這裡。" action={{ label: "看全部創作者", onClick: onClear }} />
        : <EmptyState text="沒有創作者符合目前的條件。放寬粉絲數、起價或地區，或清除篩選重新找。" action={{ label: "清除篩選", onClick: onClear }} />
    );
  }

  return (
    <div>
      {view === "card" ? (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {items.map((c) => <li key={c.userId}><CreatorCard c={c} /></li>)}
        </ul>
      ) : (
        <CreatorTable items={items} sort={query.sort} onSort={onSort} />
      )}
      {error && <div className="mt-4 flex justify-center"><ErrorText message={error} /></div>}
      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button" onClick={loadMore} disabled={loading}
            className={btn.secondary}
          >
            {loading ? "載入中…" : "載入更多"}
          </button>
        </div>
      )}
    </div>
  );
}
