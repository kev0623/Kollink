import Link from "next/link";
import { caseCode, escrowLabel, sourceLabel, type Collab } from "@/lib/collabs/view";
import { CollabStatusBadge } from "./CollabStatusBadge";

/** 標題區：創作者 × 案名、交付內容、金額與託管狀態、案號、來源。 */
export function CollabHeader({ c }: { c: Collab }) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 break-words text-[24px] font-bold text-ink md:text-[28px]">
          <Link href={`/c/${c.creatorHandle}`} className="underline-offset-2 hover:underline">{c.creatorName}</Link>
          <span className="text-muted"> × </span>
          {c.title}
        </h1>
        <CollabStatusBadge status={c.status} />
      </div>
      <dl className="grid gap-3 rounded-card border border-line bg-surface p-4 text-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:p-5">
        <div className="min-w-0">
          <dt className="text-xs text-muted">交付內容</dt>
          <dd className="mt-0.5 whitespace-pre-line break-words text-ink">{c.deliverables}</dd>
        </div>
        <div className="space-y-2">
          <div>
            <dt className="text-xs text-muted">金額</dt>
            <dd className="mt-0.5 font-semibold text-primary">{escrowLabel(c.status, c.amount)}</dd>
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
