import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ApplicantList } from "@/components/briefs/ApplicantList";
import { BriefDetailView } from "@/components/briefs/BriefDetailView";
import { BriefOwnerActions } from "@/components/briefs/BriefOwnerActions";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { BriefStatusBadge } from "@/components/briefs/StatusBadges";
import { requireRole } from "@/lib/auth/current-user";
import { loadApplicants, loadOwnBrief } from "@/lib/briefs/brand";
import { todayTw } from "@/lib/briefs/dates";
import { isUuid } from "@/lib/briefs/query";
import { deadlineText, displayStatusOf, parseApplicantFilter, rewardLabel, UNTITLED_DRAFT } from "@/lib/briefs/view";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = { title: "招募詳情" };

export default function BrandBriefPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-muted">載入中…</p>}>
      <BriefDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function BriefDetail({ params, searchParams }: Props) {
  const me = await requireRole("brand");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // 只有招募主看得到：別人的或不存在都是 404
  const brief = await loadOwnBrief(me.id, id);
  if (!brief) notFound();
  const today = todayTw();
  const display = displayStatusOf(brief.status, brief.deadline, today);
  const applicants = brief.status === "draft" ? [] : await loadApplicants(id);
  const counted = applicants.filter((a) => a.status === "applied" || a.status === "accepted").length;

  return (
    <div className="space-y-6">
      <header>
        <PageHeader
          title={brief.title || UNTITLED_DRAFT}
          back={{ href: "/brand/briefs", label: "我的招募" }}
          description={
            <div className="space-y-2">
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <BriefStatusBadge status={display} />
                <span className="font-semibold text-accent">{rewardLabel(brief)}</span>
                <span>{brief.deadline ? `截止 ${deadlineText(brief.status, brief.deadline, today)}` : "未設定截止日"}</span>
                {brief.status !== "draft" && <span>報名 {counted} 人</span>}
              </p>
            </div>
          }
        />
        <div className="-mt-2"><BriefOwnerActions briefId={brief.id} display={display} /></div>
      </header>

      <details className="rounded-card border border-line bg-surface">
        <summary className="cursor-pointer p-4 text-sm font-semibold text-ink">查看招募內容（創作者看到的樣子）</summary>
        <div className="p-2 pt-0 md:p-4 md:pt-0">
          <BriefDetailView
            brief={{ ...brief, brandName: me.brand?.brandName ?? "", brandLogoPath: me.brand?.logoPath ?? null, applicantCount: counted }}
            today={today}
            headingLevel={2}
          />
        </div>
      </details>

      <section aria-labelledby="applicants-title">
        <h2 id="applicants-title" className="text-lg font-bold text-ink">報名者</h2>
        <div className="mt-3">
          {brief.status === "draft" ? (
            <EmptyState text="發佈後，創作者的報名會出現在這裡" />
          ) : applicants.length === 0 ? (
            <EmptyState text="還沒有人報名" />
          ) : (
            <ApplicantList
              briefId={brief.id}
              brief={{ budgetMin: brief.budgetMin, budgetMax: brief.budgetMax, collabTypes: brief.collabTypes, description: brief.description }}
              applicants={applicants}
              initialFilter={parseApplicantFilter((await searchParams).applicants)}
            />
          )}
        </div>
      </section>
    </div>
  );
}
