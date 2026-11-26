import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { notFound, redirect } from "next/navigation";
import { BriefForm } from "@/components/briefs/BriefForm";
import { requireRole } from "@/lib/auth/current-user";
import { loadOwnBrief } from "@/lib/briefs/brand";
import { todayTw } from "@/lib/briefs/dates";
import { isUuid, parseBriefStep } from "@/lib/briefs/query";
import { briefToInput, displayStatusOf } from "@/lib/briefs/view";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// params 與 searchParams 都是請求時才知道的值：在 <Suspense> 內讀（dynamic-routes.md「Without generateStaticParams」）
export const metadata: Metadata = { title: "編輯招募" };

export default function EditBriefPage({ params, searchParams }: Props) {
  return (
    <div className="max-w-3xl">
      <PageHeader title="編輯招募" back={{ href: "/brand/briefs", label: "我的招募" }} />
      <Suspense fallback={<FormSkeleton fields={3} steps />}>
        <EditBrief params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EditBrief({ params, searchParams }: Props) {
  const me = await requireRole("brand");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const brief = await loadOwnBrief(me.id, id);
  if (!brief) notFound();
  const today = todayTw();
  const display = displayStatusOf(brief.status, brief.deadline, today);
  // 已關閉或已截止不能編輯：回到詳情頁
  if (display === "closed" || display === "expired") redirect(`/brand/briefs/${id}`);
  const sp = await searchParams;
  return (
    <BriefForm
      briefId={brief.id} isOpen={brief.status === "open"} initial={briefToInput(brief)}
      initialStep={parseBriefStep(sp.step)} saved={sp.saved === "1"} userId={me.id}
      brandName={me.brand?.brandName ?? ""} brandLogoPath={me.brand?.logoPath ?? null} today={today}
    />
  );
}
