import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/current-user";
import { loadOverview } from "@/lib/admin/load";

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-[32px] font-bold text-ink">管理後台</h1>
      <p className="mt-1 text-sm text-muted">待處理的事項。數字是目前的筆數，點進去處理。</p>
      <Suspense fallback={<div aria-busy="true" className="mt-6 h-40 rounded-card border border-line bg-surface" />}>
        <Cards />
      </Suspense>
    </div>
  );
}

async function Cards() {
  await requireAdmin();
  const o = await loadOverview();
  const cards = [
    { label: "待審核創作者", n: o.pendingCreators, href: "/admin/creators" },
    { label: "待撥款", n: o.awaitingPayout, href: "/admin/payments" },
    { label: "需退款", n: o.refundRequired, href: "/admin/payments?view=refunds" },
    { label: "付款異常", n: o.openAnomalies, href: "/admin/payments?view=anomalies" },
    { label: "未檢視的違規訊息", n: o.openFlaggedMessages, href: "/admin/messages" },
    { label: "等待付款的合作案", n: o.awaitingPayment, href: "/admin/collabs?status=awaiting_payment" },
  ];
  return (
    <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
      {cards.map((c) => (
        <li key={c.label}>
          <Link
            href={c.href}
            className="block rounded-card border border-line bg-surface p-4 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink md:p-5"
          >
            <p className="text-sm text-muted">{c.label}</p>
            <p className={`mt-1 text-3xl font-bold ${c.n > 0 ? "text-ink" : "text-muted"}`}>{c.n}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
