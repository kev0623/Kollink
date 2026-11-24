import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { BriefStatusBadge } from "@/components/briefs/StatusBadges";
import { requireRole } from "@/lib/auth/current-user";
import { loadMyBriefs } from "@/lib/briefs/brand";
import { deadlineLabel, formatDate, formatDateTw, todayTw } from "@/lib/briefs/dates";
import { BRAND_BRIEF_TABS, parseBrandBriefTab } from "@/lib/briefs/query";
import { brandTabOf, displayStatusOf, UNTITLED_DRAFT } from "@/lib/briefs/view";
import { formatNumber } from "@/lib/format";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// 頁面殼是靜態的；searchParams 與 session 都在 <Suspense> 內讀（cacheComponents）
export default function BrandBriefsPage({ searchParams }: Props) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[32px] font-bold text-ink">我的招募</h1>
        <Link href="/brand/briefs/new" className="inline-flex h-11 items-center gap-1 rounded-btn bg-ink px-4 font-semibold text-on-ink">
          <Plus size={18} strokeWidth={1.5} aria-hidden="true" />刊登招募
        </Link>
      </div>
      <div className="mt-6">
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
    return (
      <div className="rounded-card border border-line bg-surface p-8 text-center">
        <p className="font-semibold text-ink">還沒有招募，刊登第一則吧</p>
        <Link href="/brand/briefs/new" className="mt-4 inline-flex h-10 items-center rounded-btn bg-ink px-4 text-sm font-semibold text-on-ink">
          刊登招募
        </Link>
      </div>
    );
  }

  const rows = all.filter((b) => brandTabOf(b.display) === tab);
  return (
    <div>
      <nav aria-label="招募狀態" className="flex gap-2">
        {BRAND_BRIEF_TABS.map((t) => {
          const count = all.filter((b) => brandTabOf(b.display) === t.value).length;
          const active = t.value === tab;
          return (
            <Link
              key={t.value} href={t.value === "open" ? "/brand/briefs" : `/brand/briefs?tab=${t.value}`}
              aria-current={active ? "page" : undefined}
              className={`h-9 rounded-full border px-4 text-sm font-semibold leading-9 ${active ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-ink"}`}
            >
              {t.label} {count}
            </Link>
          );
        })}
      </nav>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-surface p-8 text-center text-sm text-muted">這裡還沒有招募</p>
      ) : (
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {rows.map((b) => (
            <li key={b.id}>
              <Link href={`/brand/briefs/${b.id}`} className="block p-4 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words font-semibold text-ink">{b.title || UNTITLED_DRAFT}</p>
                  <BriefStatusBadge status={b.display} />
                </div>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span>{b.deadline ? `截止 ${formatDate(b.deadline)}（${deadlineLabel(b.deadline, today)}）` : "未設定截止日"}</span>
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
