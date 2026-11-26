import Link from "next/link";
import { formatDateTimeTw } from "@/lib/briefs/dates";
import { caseCode } from "@/lib/collabs/view";
import { formatTwd } from "@/lib/format";
import type { Anomaly } from "@/lib/admin/view";
import { AnomalyAction } from "./RefundAction";
import { EmptyState } from "@/components/ui/EmptyState";
import { rows, textLink } from "@/components/ui/styles";

export function AnomalyList({ items, open }: { items: Anomaly[]; open: boolean }) {
  if (items.length === 0) return <EmptyState text={open ? "沒有未處理的付款異常" : "沒有已處理的付款異常"} />;
  return (
    <ul className={rows}>
      {items.map((a) => (
        <li key={a.id} className="space-y-2 px-4 py-4 md:px-5">
          <p className="font-semibold text-ink">{a.kind}<span className="ml-2 text-xs font-normal text-muted">{a.source}・{formatDateTimeTw(a.createdAt)}</span></p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">綠界訂單編號</dt><dd className="min-w-0 break-all font-mono">{a.merchantTradeNo || "—"}</dd>
            <dt className="text-muted">綠界交易編號</dt><dd className="min-w-0 break-all font-mono">{a.providerTradeNo || "—"}</dd>
            <dt className="text-muted">應付／實收</dt>
            <dd>{a.expected !== null ? formatTwd(a.expected) : "—"} ／ {a.received !== null ? formatTwd(a.received) : "—"}</dd>
            {a.collabId && (
              <>
                <dt className="text-muted">合作案</dt>
                <dd><Link href={`/admin/collabs/${a.collabId}`} className={textLink}>{caseCode(a.collabId)}</Link></dd>
              </>
            )}
            {a.resolvedNote && (<><dt className="text-muted">處理說明</dt><dd className="min-w-0 whitespace-pre-wrap break-words">{a.resolvedNote}</dd></>)}
          </dl>
          {open && <AnomalyAction anomalyId={a.id} />}
        </li>
      ))}
    </ul>
  );
}
