import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { btn, chip, row, rows as rowsClass } from "@/components/ui/styles";
import { BriefStatusBadge } from "@/components/briefs/StatusBadges";
import { requireRole } from "@/lib/auth/current-user";
import { loadMyBriefs } from "@/lib/briefs/brand";
import { formatDateTw, todayTw } from "@/lib/briefs/dates";
import { BRAND_BRIEF_TABS, parseBrandBriefTab } from "@/lib/briefs/query";
import { brandTabOf, deadlineText, displayStatusOf, UNTITLED_DRAFT } from "@/lib/briefs/view";
import { formatNumber } from "@/lib/format";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// 頁面殼是靜態的；searchParams 與 session 都在 <Suspense> 內讀（cacheComponents）
export const metadata: Metadata = { title: "我的招募" };

export default function BrandBriefsPage({ searchParams }: Props) {
  return (
    <div>
      <PageHeader title="我的招募" action={<Link href="/brand/briefs/new" className={btn.primary}>刊登招募</Link>} />
      <div>
        <Suspense fallback={<ListSkeleton />}>
          <BriefList searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function BriefList({ searchParams }: Props) {
  // layout 的 Gate 在用戶端換頁時不會重跑，頁面自己也要檢查
  const me = await requireRole("brand");
  const tab = parseBrandBriefTab((await searchParams).tab);
  const today = todayTw();
  const all = (await loadMyBriefs(me.id)).map((b) => ({ ...b, display: displayStatusOf(b.status, b.deadline, today) }));

  if (all.length === 0) {
    return <EmptyState text="還沒有招募。刊登第一個招募，讓創作者來報名。" action={{ href: "/brand/briefs/new", label: "刊登招募" }} />;
  }

  const shown = all.filter((b) => brandTabOf(b.display) === tab);
  return (
    <div>
      <nav aria-label="招募狀態" className="scroll-fade-x flex gap-2 overflow-x-auto pb-1">
        {BRAND_BRIEF_TABS.map((t) => {
          const count = all.filter((b) => brandTabOf(b.display) === t.value).length;
          const active = t.value === tab;
          return (
            <Link
              key={t.value} href={t.value === "open" ? "/brand/briefs" : `/brand/briefs?tab=${t.value}`}
              aria-current={active ? "page" : undefined}
              className={chip(active)}
            >
              {t.label} <span className="tabular-nums opacity-80">{count}</span>
            </Link>
          );
        })}
      </nav>
      {shown.length === 0 ? (
        <div className="mt-4">
          <EmptyState text="這裡還沒有招募" action={tab === "draft" ? { href: "/brand/briefs/new", label: "刊登招募" } : undefined} />
        </div>
      ) : (
        <ul className={`mt-4 ${rowsClass}`}>
          {shown.map((b) => (
            <li key={b.id}>
              <Link href={`/brand/briefs/${b.id}`} className={`${row} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words font-semibold text-ink">{b.title || UNTITLED_DRAFT}</p>
                  <BriefStatusBadge status={b.display} />
                </div>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span>{b.deadline ? `截止 ${deadlineText(b.status, b.deadline, today)}` : "未設定截止日"}</span>
                  {b.status !== "draft" && (
                    <span>報名 {formatNumber(b.applicantCount)} 人（待處理 {formatNumber(b.pendingCount)}）</span>
                  )}
                  <span>建立於 {formatDateTw(b.createdAt)}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" className="space-y-3">
      <p className="sr-only">載入中…</p>
      {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-card border border-line bg-surface" />)}
    </div>
  );
}
