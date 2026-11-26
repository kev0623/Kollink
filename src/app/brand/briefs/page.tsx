import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { LinkPending } from "@/components/ui/LinkPending";
import { btn, chip, row, rows as rowsClass } from "@/components/ui/styles";
import { BriefStatusBadge } from "@/components/briefs/StatusBadges";
import { requireRole } from "@/lib/auth/current-user";
import { loadMyBriefsPage } from "@/lib/briefs/brand";
import { formatDateTw, todayTw } from "@/lib/briefs/dates";
import { BRAND_BRIEF_TABS, parseBrandBriefTab } from "@/lib/briefs/query";
import { deadlineText, displayStatusOf, UNTITLED_DRAFT, type BrandBriefTab } from "@/lib/briefs/view";
import { formatNumber } from "@/lib/format";
import { pageHref, pageOverflow, parsePage } from "@/lib/paging";

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
  const sp = await searchParams;
  const tab = parseBrandBriefTab(sp.tab);
  const page = parsePage(sp.page);
  const today = todayTw();
  const { items, counts } = await loadMyBriefsPage(me.id, tab, page, today);
  const hrefFor = (t: BrandBriefTab, p = 1) => pageHref("/brand/briefs", { tab: t === "open" ? undefined : t }, p);

  if (counts.open + counts.draft + counts.ended === 0) {
    return <EmptyState text="還沒有招募。刊登第一個招募，讓創作者來報名。" action={{ href: "/brand/briefs/new", label: "刊登招募" }} />;
  }
  // 網址的頁數超過最後一頁（招募被刪除、舊連結）：改到最後一頁
  const last = pageOverflow(page, counts[tab]);
  if (last !== null) redirect(hrefFor(tab, last));

  return (
    <div>
      <nav aria-label="招募狀態" className="scroll-fade-x flex gap-2 overflow-x-auto pb-1">
        {BRAND_BRIEF_TABS.map((t) => {
          const active = t.value === tab;
          return (
            <Link key={t.value} href={hrefFor(t.value)} aria-current={active ? "page" : undefined} className={chip(active)}>
              {t.label} <span className="tabular-nums opacity-80">{formatNumber(counts[t.value])}</span><LinkPending />
            </Link>
          );
        })}
      </nav>
      {items.length === 0 ? (
        <div className="mt-4"><TabEmpty tab={tab} drafts={counts.draft} /></div>
      ) : (
        <>
          <ul className={`mt-4 ${rowsClass}`}>
            {items.map((b) => (
              <li key={b.id}>
                <Link href={`/brand/briefs/${b.id}`} className={`${row} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words font-semibold text-ink">{b.title || UNTITLED_DRAFT}</p>
                    <BriefStatusBadge status={displayStatusOf(b.status, b.deadline, today)} />
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
          <Pagination page={page} total={counts[tab]} hrefFor={(p) => hrefFor(tab, p)} label="招募分頁" unit="則" />
        </>
      )}
    </div>
  );
}

/** 這個分頁沒有招募時：說明現況，給一條出路。 */
function TabEmpty({ tab, drafts }: { tab: BrandBriefTab; drafts: number }) {
  const publish = { href: "/brand/briefs/new", label: "刊登招募" };
  if (tab === "draft") return <EmptyState text="沒有草稿。刊登招募時可以隨時存成草稿，之後再回來寫。" action={publish} />;
  if (tab === "ended") return <EmptyState text="還沒有結束的招募。截止或關閉的招募會移到這裡，報名者仍然可以處理。" />;
  return (
    <EmptyState
      text={drafts > 0 ? "目前沒有發佈中的招募。你有還沒發佈的草稿，可以接著寫完。" : "目前沒有發佈中的招募。刊登一則，讓創作者來報名。"}
      action={drafts > 0 ? { href: "/brand/briefs?tab=draft", label: "看草稿" } : publish}
      secondary={drafts > 0 ? publish : undefined}
    />
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
