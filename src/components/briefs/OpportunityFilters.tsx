import Link from "next/link";
import { OPPORTUNITY_FILTERS, opportunityHref, sameOpportunityQuery, type OpportunityQuery } from "@/lib/briefs/query";

/** 「機會／我的報名」分頁，以及機會的篩選標籤（一次只選一個）。全部是連結，狀態只在網址。 */
export function OpportunityFilters({ query }: { query: OpportunityQuery }) {
  const applied = query.tab === "applied";
  const tab = "h-10 rounded-btn px-4 text-sm font-semibold leading-10";
  return (
    <div className="space-y-3">
      <nav aria-label="機會分頁" className="flex gap-2">
        <Link href="/creator" aria-current={!applied ? "page" : undefined}
          className={`${tab} ${!applied ? "bg-ink text-on-ink" : "border border-line bg-surface text-ink"}`}>
          機會
        </Link>
        <Link href="/creator?tab=applied" aria-current={applied ? "page" : undefined}
          className={`${tab} ${applied ? "bg-ink text-on-ink" : "border border-line bg-surface text-ink"}`}>
          我的報名
        </Link>
      </nav>
      {!applied && (
        // relative：捲動容器裡有 sr-only 文字時，避免它撐出整頁的水平捲軸
        <nav aria-label="篩選機會" className="relative overflow-x-auto pb-1">
          <ul className="flex w-max gap-2">
            {OPPORTUNITY_FILTERS.map((f) => {
              const active = sameOpportunityQuery(f.query, query);
              return (
                <li key={f.label}>
                  <Link
                    href={opportunityHref(f.query)} aria-current={active ? "page" : undefined}
                    className={`inline-block h-9 whitespace-nowrap rounded-full border px-4 text-sm font-medium leading-9 ${active ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-ink"}`}
                  >
                    {f.label}
                  </Link>
                </li>
              );
            })}
            {query.tab === "category" && !OPPORTUNITY_FILTERS.some((f) => sameOpportunityQuery(f.query, query)) && (
              <li>
                <span aria-current="page" className="inline-block h-9 whitespace-nowrap rounded-full border border-ink bg-ink px-4 text-sm font-medium leading-9 text-on-ink">
                  {query.category}
                </span>
              </li>
            )}
          </ul>
        </nav>
      )}
    </div>
  );
}
