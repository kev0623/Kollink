import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ApplicantList } from "@/components/briefs/ApplicantList";
import { BriefDetailView } from "@/components/briefs/BriefDetailView";
import { BriefOwnerActions } from "@/components/briefs/BriefOwnerActions";
import { DetailSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { BriefStatusBadge } from "@/components/briefs/StatusBadges";
import { requireRole } from "@/lib/auth/current-user";
import { loadApplicantsPage, loadOwnBrief } from "@/lib/briefs/brand";
import { todayTw } from "@/lib/briefs/dates";
import { APPLICANTS_ANCHOR, isUuid } from "@/lib/briefs/query";
import {
  activeApplicantCount, deadlineText, displayStatusOf, NO_APPLICANTS, parseApplicantFilter, rewardLabel, UNTITLED_DRAFT,
} from "@/lib/briefs/view";
import { pageHref, pageOverflow, parsePage } from "@/lib/paging";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = { title: "招募詳情" };

export default function BrandBriefPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
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
  const sp = await searchParams;
  const filter = parseApplicantFilter(sp.applicants);
  const page = parsePage(sp.page);
  // 草稿不會有報名者
  const { items: applicants, counts } = brief.status === "draft"
    ? { items: [], counts: NO_APPLICANTS }
    : await loadApplicantsPage(id, filter, page);
  // 網址的頁數超過最後一頁（剛處理完這一頁最後一位、舊連結）：改到最後一頁
  const last = pageOverflow(page, counts[filter]);
  if (last !== null) {
    redirect(pageHref(`/brand/briefs/${id}`, { applicants: filter === "all" ? undefined : filter }, last, `#${APPLICANTS_ANCHOR}`));
  }
  const counted = activeApplicantCount(counts);

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          tight
          title={brief.title || UNTITLED_DRAFT}
          back={{ href: "/brand/briefs", label: "我的招募" }}
          description={
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <BriefStatusBadge status={display} />
              <span className="font-semibold text-accent">{rewardLabel(brief)}</span>
              <span>{brief.deadline ? `截止 ${deadlineText(brief.status, brief.deadline, today)}` : "未設定截止日"}</span>
              {brief.status !== "draft" && <span>報名 {counted} 人</span>}
            </p>
          }
        />
        <BriefOwnerActions briefId={brief.id} display={display} />
      </div>

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

      {/* scroll-mt：換頁後捲到這裡時，標題上方留一點空間 */}
      <section id={APPLICANTS_ANCHOR} aria-labelledby="applicants-title" className="scroll-mt-6">
        <h2 id="applicants-title" className="text-lg font-bold text-ink">報名者</h2>
        <div className="mt-3">
          {brief.status === "draft" ? (
            <EmptyState text="這則招募還是草稿。發佈後，創作者的報名會出現在這裡。" />
          ) : counts.all === 0 ? (
            display === "open"
              ? <EmptyState text="還沒有人報名。不想等的話，可以到創作者廣場主動邀請適合的創作者。" action={{ href: "/brand", label: "去創作者廣場" }} />
              : <EmptyState text="這則招募結束時沒有人報名。可以再刊登一則，或到創作者廣場主動邀請。" action={{ href: "/brand/briefs/new", label: "刊登招募" }} secondary={{ href: "/brand", label: "去創作者廣場" }} />
          ) : (
            <ApplicantList
              briefId={brief.id}
              brief={{ budgetMin: brief.budgetMin, budgetMax: brief.budgetMax, collabTypes: brief.collabTypes, description: brief.description }}
              applicants={applicants} filter={filter} counts={counts} page={page}
            />
          )}
        </div>
      </section>
    </div>
  );
}
