import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { BriefForm } from "@/components/briefs/BriefForm";
import { requireRole } from "@/lib/auth/current-user";
import { todayTw } from "@/lib/briefs/dates";
import { parseBriefStep } from "@/lib/briefs/query";
import { EMPTY_BRIEF_INPUT } from "@/lib/validation/brief";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = { title: "刊登招募" };

export default function NewBriefPage({ searchParams }: Props) {
  return (
    <div className="max-w-3xl">
      <Link href="/brand/briefs" className="text-sm text-muted">← 我的招募</Link>
      <h1 className="mt-2 text-[32px] font-bold text-ink">刊登招募</h1>
      <div className="mt-6">
        <Suspense fallback={<p className="text-muted">載入中…</p>}>
          <NewBrief searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function NewBrief({ searchParams }: Props) {
  const me = await requireRole("brand");
  const step = parseBriefStep((await searchParams).step);
  return (
    <BriefForm
      briefId={null} isOpen={false} initial={EMPTY_BRIEF_INPUT} initialStep={step} saved={false}
      userId={me.id} brandName={me.brand?.brandName ?? ""} brandLogoPath={me.brand?.logoPath ?? null} today={todayTw()}
    />
  );
}
