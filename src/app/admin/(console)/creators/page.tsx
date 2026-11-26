import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/current-user";
import { loadCreators } from "@/lib/admin/load";
import { adminHref, CREATOR_FILTERS, parseCreatorFilter, parsePage, parseQuery, type SearchParams } from "@/lib/admin/query";
import { CreatorReviewList } from "@/components/admin/CreatorReviewList";
import { FilterChips } from "@/components/admin/FilterChips";
import { Pagination } from "@/components/admin/Pagination";
import { SearchForm } from "@/components/admin/SearchForm";

type Props = { searchParams: Promise<SearchParams> };

export default function AdminCreatorsPage({ searchParams }: Props) {
  return (
    <div>
      <h1 className="text-[32px] font-bold text-ink">創作者審核</h1>
      <p className="mt-1 text-sm text-muted">打開 IG，確認自我介紹裡有驗證碼、粉絲數合理，再核准。</p>
      <Suspense fallback={<div aria-busy="true" className="mt-6 h-48 rounded-card border border-line bg-surface" />}>
        <Section searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Section({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const status = parseCreatorFilter(sp.status);
  const q = parseQuery(sp.q);
  const page = parsePage(sp.page);
  const { items, total } = await loadCreators(status, q, page);
  const href = (p: { status?: string; page?: number }) =>
    adminHref("/admin/creators", { status: p.status ?? status, q, page: p.page ?? 1 }, { status: "pending" });
  return (
    <div className="mt-6 space-y-4">
      <FilterChips label="審核狀態" options={CREATOR_FILTERS} current={status} hrefFor={(v) => href({ status: v })} />
      <SearchForm action="/admin/creators" q={q} placeholder="網址代稱、IG 或名稱" hidden={status === "pending" ? {} : { status }} />
      <CreatorReviewList items={items} />
      <Pagination page={page} total={total} hrefFor={(p) => href({ page: p })} />
    </div>
  );
}
