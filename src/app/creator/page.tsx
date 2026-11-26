import type { Metadata } from "next";
import { Suspense } from "react";
import { PayoutPrompt } from "@/components/collabs/PayoutPrompt";
import { PageHeader } from "@/components/ui/PageHeader";
import { MyApplicationList } from "@/components/briefs/MyApplicationList";
import { OpportunityFilters } from "@/components/briefs/OpportunityFilters";
import { OpportunityResults } from "@/components/briefs/OpportunityResults";
import { requireRole } from "@/lib/auth/current-user";
import { listOpportunities, loadMyApplications } from "@/lib/briefs/creator";
import { todayTw } from "@/lib/briefs/dates";
import { loadMyCollabs } from "@/lib/collabs/load";
import { anyNeedsPayoutPrompt } from "@/lib/creators/payout-prompt";
import { loadHasPayoutAccount } from "@/lib/creators/payout-status";
import { opportunityQueryString, parseOpportunityQuery } from "@/lib/briefs/query";

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
  const query = parseOpportunityQuery(await searchParams);
  const today = todayTw();
  const [active, hasAccount] = await Promise.all([loadMyCollabs("active"), loadHasPayoutAccount(me.id)]);
  const prompt = anyNeedsPayoutPrompt(active.map((c) => c.status), hasAccount) && <PayoutPrompt />;
  if (query.tab === "applied") {
    const items = await loadMyApplications(me.id);
    return (
      <div className="space-y-4">
        {prompt}
        <OpportunityFilters query={query} />
        <MyApplicationList items={items} today={today} />
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
