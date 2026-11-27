import Link from "next/link";
import { caseCode, escrowLabel, sourceLabel, type Collab, type RefundState } from "@/lib/collabs/view";
import { CollabStatusBadge } from "./CollabStatusBadge";

/** 標題區：創作者 × 案名、交付內容、金額與付款狀態、案號、來源。 */
export function CollabHeader({ c, testPayment, refund = null }: { c: Collab; testPayment: boolean; refund?: RefundState }) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 break-words font-serif text-[24px] font-bold leading-tight text-ink md:text-[28px]">
          <Link href={`/c/${c.creatorHandle}`} className="inline-flex min-h-11 min-w-11 items-center underline-offset-4 hover:underline">{c.creatorName}</Link>
          <span className="text-muted"> × </span>
          {c.title}
        </h1>
        <CollabStatusBadge status={c.status} />
      </div>
      <dl className="grid gap-4 rounded-card border border-line bg-surface p-5 text-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:p-8">
        <div className="min-w-0">
          <dt className="text-xs text-muted">交付內容</dt>
          <dd className="mt-0.5 whitespace-pre-line break-words text-ink">{c.deliverables}</dd>
        </div>
        <div className="space-y-2">
          <div>
            <dt className="text-xs text-muted">金額</dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-2 font-serif text-2xl font-bold tabular-nums text-ink">
              {(() => { const [money, ...rest] = escrowLabel(c.status, c.amount, false, refund).split(" "); return <><span>{money}</span><span className="font-sans text-sm font-semibold text-muted">{rest.join(" ")}</span></>; })()}
              {testPayment && (
                <span className="rounded-full border border-danger bg-danger-soft px-2 py-0.5 font-sans text-xs font-bold text-danger">測試付款（未實際收款）</span>
              )}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <div>
              <dt className="text-xs text-muted">案號</dt>
              <dd className="font-mono text-ink">{caseCode(c.id)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted">來源</dt>
              <dd className="break-words text-ink">{sourceLabel(c)}</dd>
            </div>
          </div>
          <div>
            <dt className="text-xs text-muted">品牌</dt>
            <dd className="break-words text-ink">{c.brandName}</dd>
          </div>
        </div>
      </dl>
    </header>
  );
}
