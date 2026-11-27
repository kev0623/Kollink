import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PayoutPrompt } from "@/components/collabs/PayoutPrompt";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { MyApplicationList } from "@/components/briefs/MyApplicationList";
import { OpportunityFilters } from "@/components/briefs/OpportunityFilters";
import { OpportunityResults } from "@/components/briefs/OpportunityResults";
import { requireRole } from "@/lib/auth/current-user";
import { listOpportunities, loadMyApplicationsPage } from "@/lib/briefs/creator";
import { todayTw } from "@/lib/briefs/dates";
import { loadMyCollabs } from "@/lib/collabs/load";
import { anyNeedsPayoutPrompt } from "@/lib/creators/payout-prompt";
import { loadHasPayoutAccount } from "@/lib/creators/payout-status";
import { opportunityQueryString, parseOpportunityQuery } from "@/lib/briefs/query";
import { pageHref, pageOverflow, parsePage } from "@/lib/paging";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// 頁面殼是靜態的；searchParams 與 session 都在 <Suspense> 內讀（cacheComponents）
export const metadata: Metadata = { title: "機會" };

export default function CreatorHome({ searchParams }: Props) {
  return (
    <div>
      <PageHeader title="機會" />
      <div>
        <Suspense fallback={<OpportunitySkeleton />}>
          <Opportunities searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Opportunities({ searchParams }: Props) {
  // layout 的 Gate 在用戶端換頁時不會重跑，頁面自己也要檢查
  const me = await requireRole("creator");
  const sp = await searchParams;
  const query = parseOpportunityQuery(sp);
  const today = todayTw();
  const [active, hasAccount] = await Promise.all([loadMyCollabs("active"), loadHasPayoutAccount(me.id)]);
  const prompt = anyNeedsPayoutPrompt(active.map((c) => c.status), hasAccount) && <PayoutPrompt />;
  if (query.tab === "applied") {
    const page = parsePage(sp.page);
    const { items, total } = await loadMyApplicationsPage(me.id, page);
    const hrefFor = (p: number) => pageHref("/creator", { tab: "applied" }, p);
    // 網址的頁數超過最後一頁（舊連結）：改到最後一頁
    const last = pageOverflow(page, total);
    if (last !== null) redirect(hrefFor(last));
    return (
      <div className="space-y-4">
        {prompt}
        <OpportunityFilters query={query} />
        <MyApplicationList items={items} today={today} />
        <Pagination page={page} total={total} hrefFor={hrefFor} label="報名分頁" />
      </div>
    );
  }
  const initial = await listOpportunities(query, 0);
  return (
    <div className="space-y-4">
      {prompt}
      <OpportunityFilters query={query} />
      <OpportunityResults initial={initial} query={query} queryKey={opportunityQueryString(query)} today={today} />
    </div>
  );
}

function OpportunitySkeleton() {
  return (
    <div aria-busy="true" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <p className="sr-only">載入中…</p>
      {[0, 1, 2].map((i) => <div key={i} className="h-80 animate-pulse rounded-card border border-line bg-subtle" />)}
    </div>
  );
}
