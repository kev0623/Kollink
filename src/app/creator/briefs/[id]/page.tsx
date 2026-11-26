import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplyPanel } from "@/components/briefs/ApplyPanel";
import { BriefDetailView } from "@/components/briefs/BriefDetailView";
import { requireRole } from "@/lib/auth/current-user";
import { loadOpportunity } from "@/lib/briefs/creator";
import { todayTw } from "@/lib/briefs/dates";
import { isUuid } from "@/lib/briefs/query";
import { detailDataOf, displayStatusOf } from "@/lib/briefs/view";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "招募詳情" };

export default function OpportunityPage({ params }: Props) {
  return (
    <div>
      <Link href="/creator" className="text-sm text-muted">← 機會</Link>
      <div className="mt-2">
        <Suspense fallback={<p className="text-muted">載入中…</p>}>
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
  const today = todayTw();
  const ended = displayStatusOf(o.status, o.deadline, today) !== "open";
  return (
    <BriefDetailView
      brief={detailDataOf(o)} today={today} match={o.match}
      aside={
        <ApplyPanel
          briefId={o.id} approved={me.creator?.status === "approved"} ended={ended} isMatch={o.isMatch}
          application={o.application}
        />
      }
    />
  );
}
