"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadMoreOpportunitiesAction, type LoadMoreOpportunitiesResult } from "@/app/creator/actions";
import { EmptyState } from "@/components/ui/EmptyState";
import { btn } from "@/components/ui/styles";
import { ErrorText } from "@/components/ui/ErrorText";
import type { OpportunityQuery } from "@/lib/briefs/query";
import { appendUniqueById, type Opportunity, type OpportunityPage } from "@/lib/briefs/view";
import { OpportunityCard } from "./OpportunityCard";

type Props = { initial: OpportunityPage; query: OpportunityQuery; queryKey: string; today: string };

/**
 * 以 key={`${bfcacheId}|${queryKey}`} 重設結果區：換篩選或從別頁重新進來時從第一批開始，
 * 上一頁（back/forward）則保留已載入的結果（與廣場相同，見計畫 4「設計決定」2）。
 */
export function OpportunityResults(props: Props) {
  const router = useRouter();
  return <Results key={`${router.bfcacheId}|${props.queryKey}`} {...props} />;
}

async function fetchMore(queryKey: string, offset: number): Promise<LoadMoreOpportunitiesResult> {
  try {
    return (await loadMoreOpportunitiesAction(queryKey, offset)) ?? { ok: false, error: "請重新登入" };
  } catch {
    return { ok: false, error: "載入失敗，請稍後再試" };
  }
}

function Results({ initial, query, queryKey, today }: Props) {
  const [extra, setExtra] = useState<Opportunity[]>([]);
  const [fetched, setFetched] = useState(0);
  const [moreAfterLoad, setMoreAfterLoad] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const items = appendUniqueById(initial.items, extra);
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
        setExtra((prev) => appendUniqueById(prev, res.items));
        setFetched((n) => n + res.items.length);
        setMoreAfterLoad(res.hasMore);
      });
    });
  }

  if (items.length === 0) {
    if (query.tab === "match") {
      return <EmptyState text="目前沒有完全符合你條件的招募。看看全部招募吧。" action={{ href: "/creator?tab=all", label: "看全部招募" }} />;
    }
    if (query.tab === "all") {
      return (
        <EmptyState
          text="目前沒有開放中的招募。品牌也會從創作者廣場主動邀請，把個人檔案補完整，更容易被找到。"
          action={{ href: "/creator/me/profile", label: "編輯個人檔案" }}
        />
      );
    }
    return <EmptyState text="這個分類目前沒有招募。" action={{ href: "/creator?tab=all", label: "看全部招募" }} />;
  }

  return (
    <div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((o) => <li key={o.id}><OpportunityCard o={o} today={today} /></li>)}
      </ul>
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
