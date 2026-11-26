import Link from "next/link";
import { formatDateTw } from "@/lib/briefs/dates";
import { caseCode } from "@/lib/collabs/view";
import { formatTwd } from "@/lib/format";
import type { AdminCollab } from "@/lib/admin/view";
import { CollabStatusBadge } from "@/components/collabs/CollabStatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { row, rows } from "@/components/ui/styles";

export function AdminCollabList({ items }: { items: AdminCollab[] }) {
  if (items.length === 0) return <EmptyState text="沒有符合的合作案" />;
  return (
    <ul className={rows}>
      {items.map((c) => (
        <li key={c.id}>
          <Link
            href={`/admin/collabs/${c.id}`}
            className={`${row} space-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted">{caseCode(c.id)}</span>
              <p className="min-w-0 break-words font-semibold text-ink">{c.title}</p>
              <CollabStatusBadge status={c.status} />
              {c.testPaid && <span className="rounded-full border border-danger bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">測試付款</span>}
              {c.refundPending && <span className="rounded-full border border-danger bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">需退款</span>}
            </div>
            <p className="min-w-0 break-words text-sm text-muted">{c.brandName} × {c.creatorHandle ? `@${c.creatorHandle}` : ""}{c.creatorName ? `（${c.creatorName}）` : ""}</p>
            <p className="text-sm">
              <span className="font-serif font-bold tabular-nums text-ink">{formatTwd(c.amount)}</span>
              {c.updatedAt && <span className="ml-3 text-xs text-muted">更新於 {formatDateTw(c.updatedAt)}</span>}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
