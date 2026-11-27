import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { notFound } from "next/navigation";
import { ApplyPanel } from "@/components/briefs/ApplyPanel";
import { BriefDetailView } from "@/components/briefs/BriefDetailView";
import { requireRole } from "@/lib/auth/current-user";
import { loadOpportunity } from "@/lib/briefs/creator";
import { loadReviewStats } from "@/lib/reviews/load";
import { todayTw } from "@/lib/briefs/dates";
import { isUuid } from "@/lib/briefs/query";
import { detailDataOf, displayStatusOf } from "@/lib/briefs/view";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "招募詳情" };

export default function OpportunityPage({ params }: Props) {
  return (
    <div>
      <Link href="/creator" className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-btn px-2 text-sm text-muted hover:text-ink">
        <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />機會
      </Link>
      <div className="mt-2">
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <Opportunity params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Opportunity({ params }: Props) {
  const me = await requireRole("creator");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // 草稿、別人看不到的招募（已截止且沒報名過）一律 404
  const o = await loadOpportunity(id);
  if (!o) notFound();
  const brandStats = o.brandId ? await loadReviewStats(o.brandId) : undefined;
  const today = todayTw();
  const ended = displayStatusOf(o.status, o.deadline, today) !== "open";
  return (
    <BriefDetailView
      brief={detailDataOf(o)} today={today} match={o.match} brandStats={brandStats}
      aside={
        <ApplyPanel
          briefId={o.id} approved={me.creator?.status === "approved"} ended={ended} isMatch={o.isMatch}
          application={o.application}
        />
      }
    />
  );
}
