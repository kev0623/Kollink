import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/current-user";
import { loadAdminCollabs } from "@/lib/admin/load";
import { adminHref, COLLAB_FILTERS, parseCollabFilter, parsePage, parseQuery, type SearchParams } from "@/lib/admin/query";
import { AdminCollabList } from "@/components/admin/AdminCollabList";
import { FilterChips } from "@/components/admin/FilterChips";
import { Pagination } from "@/components/admin/Pagination";
import { SearchForm } from "@/components/admin/SearchForm";

type Props = { searchParams: Promise<SearchParams> };

export const metadata: Metadata = { title: "合作案（後台）" };

export default function AdminCollabsPage({ searchParams }: Props) {
  return (
    <div>
      <h1 className="text-[32px] font-bold text-ink">合作案</h1>
      <Suspense fallback={<div aria-busy="true" className="mt-6 h-48 rounded-card border border-line bg-surface" />}>
        <Section searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Section({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const status = parseCollabFilter(sp.status);
  const q = parseQuery(sp.q);
  const page = parsePage(sp.page);
  const { items, total } = await loadAdminCollabs(status, q, page);
  const href = (p: { status?: string; page?: number }) =>
    adminHref("/admin/collabs", { status: p.status ?? status, q, page: p.page ?? 1 }, { status: "active" });
  return (
    <div className="mt-6 space-y-4">
      <FilterChips label="合作案狀態" options={COLLAB_FILTERS} current={status} hrefFor={(v) => href({ status: v })} />
      <SearchForm action="/admin/collabs" q={q} placeholder="案號（8 碼）、案名、品牌或創作者" hidden={status === "active" ? {} : { status }} />
      <AdminCollabList items={items} />
      <Pagination page={page} total={total} hrefFor={(p) => href({ page: p })} />
    </div>
  );
}
