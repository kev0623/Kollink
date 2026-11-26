import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/current-user";
import { loadAdminPayments, loadAnomalies, loadPayouts } from "@/lib/admin/load";
import { adminHref, MONEY_TABS, parseMoneyTab, parsePage, type SearchParams } from "@/lib/admin/query";
import { AnomalyList } from "@/components/admin/AnomalyList";
import { FilterChips } from "@/components/admin/FilterChips";
import { Pagination } from "@/components/admin/Pagination";
import { PaymentRows } from "@/components/admin/PaymentRows";
import { PayoutList } from "@/components/admin/PayoutList";

type Props = { searchParams: Promise<SearchParams> };

export const metadata: Metadata = { title: "款項" };

export default function AdminPaymentsPage({ searchParams }: Props) {
  return (
    <div>
      <h1 className="text-[32px] font-bold text-ink">款項</h1>
      <p className="mt-1 text-sm text-muted">撥款與人工標記已付款在合作案詳情操作；退款與付款異常在這裡記錄。</p>
      <Suspense fallback={<div aria-busy="true" className="mt-6 h-48 rounded-card border border-line bg-surface" />}>
        <Section searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Section({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const view = parseMoneyTab(sp.view);
  const page = parsePage(sp.page);
  // ?state=resolved 只對付款異常有意義；其他值都是「未處理」
  const resolved = view === "anomalies" && sp.state === "resolved";
  const href = (p: { view?: string; page?: number; state?: string | null }) =>
    adminHref("/admin/payments", {
      view: p.view ?? view, state: p.state === undefined ? (resolved ? "resolved" : null) : p.state, page: p.page ?? 1,
    }, { view: "payouts" });
  return (
    <div className="mt-6 space-y-4">
      <FilterChips label="款項分類" options={MONEY_TABS} current={view} hrefFor={(v) => href({ view: v, state: null })} />
      {view === "payouts" && <Payouts page={page} hrefFor={(p) => href({ page: p })} />}
      {view === "refunds" && <Payments kind="refund" page={page} hrefFor={(p) => href({ page: p })} />}
      {view === "payments" && <Payments kind="all" page={page} hrefFor={(p) => href({ page: p })} />}
      {view === "anomalies" && (
        <>
          <FilterChips
            label="處理狀態" current={resolved ? "resolved" : "open"}
            options={[{ value: "open", label: "未處理" }, { value: "resolved", label: "已處理" }]}
            hrefFor={(v) => href({ state: v === "resolved" ? "resolved" : null })}
          />
          <Anomalies open={!resolved} page={page} hrefFor={(p) => href({ page: p })} />
        </>
      )}
    </div>
  );
}

type Paged = { page: number; hrefFor: (page: number) => string };

async function Payouts({ page, hrefFor }: Paged) {
  const { items, total } = await loadPayouts(page);
  return (<><PayoutList items={items} /><Pagination page={page} total={total} hrefFor={hrefFor} /></>);
}

async function Payments({ kind, page, hrefFor }: Paged & { kind: "refund" | "all" }) {
  const { items, total } = await loadAdminPayments(kind, page);
  return (
    <>
      <PaymentRows items={items} withCollab empty={kind === "refund" ? "沒有需退款的款項" : "還沒有付款單"} />
      <Pagination page={page} total={total} hrefFor={hrefFor} />
    </>
  );
}

async function Anomalies({ open, page, hrefFor }: Paged & { open: boolean }) {
  const { items, total } = await loadAnomalies(open, page);
  return (<><AnomalyList items={items} open={open} /><Pagination page={page} total={total} hrefFor={hrefFor} /></>);
}
