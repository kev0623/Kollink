import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/current-user";
import { loadFlaggedMessages } from "@/lib/admin/load";
import { adminHref, MESSAGE_FILTERS, parseMessageFilter, parsePage, type SearchParams } from "@/lib/admin/query";
import { formatDateTimeTw } from "@/lib/briefs/dates";
import { FilterChips } from "@/components/admin/FilterChips";
import { Pagination } from "@/components/admin/Pagination";
import { ReviewButton } from "@/components/admin/ReviewButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { rows } from "@/components/ui/styles";

type Props = { searchParams: Promise<SearchParams> };

export const metadata: Metadata = { title: "違規訊息" };

export default function AdminMessagesPage({ searchParams }: Props) {
  return (
    <div>
      <PageHeader
        title="違規訊息"
        description="含電話、Email、LINE 或外部連結的訊息（自動標記，可能誤判）。要處理的話到「創作者審核」停權，或到合作案平台取消。"
      />
      <Suspense fallback={<div aria-busy="true" className="h-48 rounded-card border border-line bg-surface" />}>
        <Section searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Section({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const view = parseMessageFilter(sp.view);
  const page = parsePage(sp.page);
  const { items, total } = await loadFlaggedMessages(view, page);
  const href = (p: { view?: string; page?: number }) =>
    adminHref("/admin/messages", { view: p.view ?? view, page: p.page ?? 1 }, { view: "open" });
  return (
    <div className="space-y-4">
      <FilterChips label="檢視狀態" options={MESSAGE_FILTERS} current={view} hrefFor={(v) => href({ view: v })} />
      {items.length === 0 ? (
        <EmptyState text={view === "open" ? "沒有待檢視的訊息" : "沒有訊息"} />
      ) : (
        <ul className={rows}>
          {items.map((m) => (
            <li key={m.id} className="space-y-3 px-4 py-4 md:px-5">
              <p className="text-xs text-muted">
                {m.createdAt ? formatDateTimeTw(m.createdAt) : ""}・{m.senderSide === "brand" ? "品牌" : "創作者"}傳送
              </p>
              <p className="min-w-0 break-words text-sm">
                <span className="font-semibold">{m.brandName}</span>
                <span className="text-muted"> ↔ </span>
                {m.creatorHandle ? (
                  <Link href={adminHref("/admin/creators", { status: "all", q: m.creatorHandle })} className="font-semibold text-ink underline underline-offset-4 hover:text-accent">
                    @{m.creatorHandle}
                  </Link>
                ) : <span className="font-semibold">{m.creatorName}</span>}
              </p>
              <p className="whitespace-pre-wrap break-words rounded-input bg-subtle p-3 text-sm text-ink">{m.body}</p>
              {m.reviewedAt ? (
                <p className="text-xs text-muted">已檢視：{formatDateTimeTw(m.reviewedAt)}</p>
              ) : (
                <ReviewButton messageId={m.id} />
              )}
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} total={total} hrefFor={(p) => href({ page: p })} />
    </div>
  );
}
