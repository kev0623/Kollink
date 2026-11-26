import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/current-user";
import { loadAdminPayments, loadPayoutAccount, loadPayoutRecord } from "@/lib/admin/load";
import { accountChangedRecently, adminCollabActions, lostPaymentCandidates, payoutBlocker } from "@/lib/admin/view";
import { formatDateTimeTw } from "@/lib/briefs/dates";
import { isUuid } from "@/lib/briefs/query";
import { loadCollabDetail } from "@/lib/collabs/load";
import { nowMs } from "@/lib/collabs/view";
import { formatTwd } from "@/lib/format";
import { maskAccount } from "@/lib/payout-account";
import { summarizePayments } from "@/lib/payments/view";
import { AdminCollabPanel, type PayoutPanel } from "@/components/admin/AdminCollabPanel";
import { PaymentRows } from "@/components/admin/PaymentRows";
import { CollabHeader } from "@/components/collabs/CollabHeader";
import { EventList } from "@/components/collabs/EventList";
import { Stepper } from "@/components/collabs/Stepper";
import { SubmissionList } from "@/components/collabs/SubmissionList";

type Props = { params: Promise<{ id: string }> };

export default function AdminCollabPage({ params }: Props) {
  return (
    <div>
      <Link href="/admin/collabs" className="text-sm text-muted">← 合作案</Link>
      <div className="mt-2">
        <Suspense fallback={<p className="text-muted">載入中…</p>}>
          <Section params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Section({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await loadCollabDetail(id);
  if (!data) notFound();
  const c = data.collab;
  const now = nowMs();
  // 管理員也是這個合作案的參與者：只能用參與者身分（資料庫也會擋），這裡不顯示管理員動作
  const participant = c.side !== "admin";
  const [{ items: payments }, record] = await Promise.all([
    loadAdminPayments("all", 1, id),
    c.status === "completed" ? loadPayoutRecord(id) : Promise.resolve(null),
  ]);
  const summary = summarizePayments(data.payments, now);
  const actions = adminCollabActions(c.status);
  let payout: PayoutPanel | null = null;
  if (!participant && actions.payout) {
    // 與 admin_mark_payout 的檢查相同：需退款的款項不算測試付款
    const testPaid = payments.some((p) => p.status === "paid" && p.env === "stage" && !p.refundRequired);
    const refundPending = payments.some((p) => p.refundRequired);
    // 完整帳號的讀取會寫 audit：只有撥款真的能進行時才讀
    const account = testPaid || refundPending ? null : await loadPayoutAccount(id);
    payout = {
      blocker: payoutBlocker({ testPaid, refundPending, hasAccount: account !== null }),
      account,
      changedRecently: accountChangedRecently(account?.updatedAt ?? null, now),
    };
  }
  const lost = lostPaymentCandidates(payments).map((p) => ({ merchantTradeNo: p.merchantTradeNo, amount: p.amount }));
  return (
    <div className="space-y-6">
      <CollabHeader c={c} testPayment={summary.testPaid} />
      <p className="text-sm text-muted">
        <Link href={`/c/${c.creatorHandle}`} className="text-accent underline">@{c.creatorHandle}</Link>
        <span>・{c.brandName}</span>
      </p>
      <Stepper status={c.status} />
      {participant ? (
        <p className="rounded-card border border-line bg-surface p-4 text-sm text-ink">
          你是這個合作案的參與者，不能用管理員身分處理。請另一位管理員處理。
        </p>
      ) : (
        <AdminCollabPanel
          collabId={c.id} amount={c.amount} actions={actions} lost={lost} payout={payout}
          paid={payments.some((p) => p.status === "paid" && !p.refundRequired && !p.refundedAt)}
        />
      )}
      {record && (
        <section className="rounded-card border border-line bg-surface p-4 text-sm md:p-6">
          <h2 className="font-semibold text-ink">撥款紀錄</h2>
          <p className="mt-1">
            {formatDateTimeTw(record.createdAt)}・{formatTwd(record.amount)}・{record.bankCode} {maskAccount(record.accountLast4)}・{record.accountName}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-muted">{record.transferNote}</p>
        </section>
      )}
      <section aria-labelledby="payments-title" className="space-y-2">
        <h2 id="payments-title" className="text-lg font-bold text-ink">付款單</h2>
        <PaymentRows items={payments} withCollab={false} empty="還沒有付款單" participant={participant} />
      </section>
      <SubmissionList submissions={data.submissions} />
      <EventList events={data.events} chatHref={null} fromApplication={c.briefId !== null} />
    </div>
  );
}
