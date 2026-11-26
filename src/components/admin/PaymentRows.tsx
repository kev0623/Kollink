import Link from "next/link";
import { formatDateTimeTw } from "@/lib/briefs/dates";
import { caseCode, COLLAB_STATUS_LABEL } from "@/lib/collabs/view";
import { formatTwd } from "@/lib/format";
import { PAYMENT_STATUS_LABEL, paymentSourceLabel, type AdminPayment } from "@/lib/admin/view";
import { RefundAction } from "./RefundAction";
import { emptyClassName } from "./styles";

/** 付款單列表（合作案詳情與「款項」頁共用）。withCollab：顯示合作案連結（款項頁）。 */
export function PaymentRows({ items, withCollab, empty, participant = false }: { items: AdminPayment[]; withCollab: boolean; empty: string; participant?: boolean }) {
  if (items.length === 0) return <p className={emptyClassName}>{empty}</p>;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {items.map((p) => (
        <li key={p.id} className="space-y-2 p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 break-all font-mono text-sm font-semibold text-ink">{p.merchantTradeNo}</span>
            <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-ink">{PAYMENT_STATUS_LABEL[p.status] ?? "未知"}</span>
            {p.env === "stage" && p.status === "paid" && (
              <span className="rounded-full border border-danger px-2.5 py-0.5 text-xs font-semibold text-danger">測試付款（未實際收款）</span>
            )}
            {p.refundRequired && (
              <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-on-ink">需退款</span>
            )}
            {p.refundedAt && <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">已退款</span>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {withCollab && (
              <>
                <dt className="text-muted">合作案</dt>
                <dd className="min-w-0 break-words">
                  <Link href={`/admin/collabs/${p.collabId}`} className="text-primary underline">
                    {caseCode(p.collabId)} {p.collabTitle}
                  </Link>
                  <span className="text-muted">（{COLLAB_STATUS_LABEL[p.collabStatus] ?? ""}・{p.brandName} × @{p.creatorHandle}）</span>
                </dd>
              </>
            )}
            <dt className="text-muted">金額／方式</dt><dd>{formatTwd(p.amount)}・{paymentSourceLabel(p)}</dd>
            <dt className="text-muted">建立</dt><dd>{p.createdAt ? formatDateTimeTw(p.createdAt) : "—"}</dd>
            {p.paidAt && (<><dt className="text-muted">付款</dt><dd>{formatDateTimeTw(p.paidAt)}</dd></>)}
            {p.providerTradeNo && (<><dt className="text-muted">綠界交易編號</dt><dd className="min-w-0 break-all font-mono">{p.providerTradeNo}</dd></>)}
            {p.adminNote && (<><dt className="text-muted">人工說明</dt><dd className="min-w-0 whitespace-pre-wrap break-words">{p.adminNote}</dd></>)}
            {p.refundNote && (<><dt className="text-muted">退款說明</dt><dd className="min-w-0 whitespace-pre-wrap break-words">{p.refundNote}</dd></>)}
          </dl>
          {p.refundRequired && !participant && <RefundAction paymentId={p.id} />}
        </li>
      ))}
    </ul>
  );
}
