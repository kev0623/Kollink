import Link from "next/link";
import { chip } from "@/components/ui/styles";
import { LinkPending } from "@/components/ui/LinkPending";
import { OPPORTUNITY_FILTERS, opportunityHref, sameOpportunityQuery, type OpportunityQuery } from "@/lib/briefs/query";

const scroller = "scroll-fade-x -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0";

/** 「機會／我的報名」分頁，以及機會的篩選標籤（一次只選一個）。全部是連結，狀態只在網址。 */
export function OpportunityFilters({ query }: { query: OpportunityQuery }) {
  const applied = query.tab === "applied";
  return (
    <div className="space-y-3">
      <nav aria-label="機會分頁" className="flex gap-2">
        <Link href="/creator" aria-current={!applied ? "page" : undefined} className={chip(!applied)}>機會<LinkPending /></Link>
        <Link href="/creator?tab=applied" aria-current={applied ? "page" : undefined} className={chip(applied)}>我的報名<LinkPending /></Link>
      </nav>
      {!applied && (
        // relative：捲動容器裡有 sr-only 文字時，避免它撐出整頁的水平捲軸
        <nav aria-label="篩選機會" className={`relative ${scroller}`}>
          {OPPORTUNITY_FILTERS.map((f) => (
            <Link
              key={f.label} href={opportunityHref(f.query)}
              aria-current={sameOpportunityQuery(f.query, query) ? "page" : undefined}
              className={chip(sameOpportunityQuery(f.query, query))}
            >
              {f.label}<LinkPending />
            </Link>
          ))}
          {query.tab === "category" && !OPPORTUNITY_FILTERS.some((f) => sameOpportunityQuery(f.query, query)) && (
            <span aria-current="page" className={chip(true)}>{query.category}</span>
          )}
        </nav>
      )}
    </div>
  );
}
