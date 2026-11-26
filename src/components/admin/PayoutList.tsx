import Link from "next/link";
import { formatDateTw } from "@/lib/briefs/dates";
import { caseCode } from "@/lib/collabs/view";
import { formatTwd } from "@/lib/format";
import { maskAccount } from "@/lib/payout-account";
import { payoutBlocker, type AdminPayout } from "@/lib/admin/view";
import { EmptyState } from "@/components/ui/EmptyState";
import { row, rows } from "@/components/ui/styles";

/** 待撥款列表：帳戶只顯示末四碼；完整帳號在合作案詳情的撥款區（會記錄查看）。 */
export function PayoutList({ items }: { items: AdminPayout[] }) {
  if (items.length === 0) return <EmptyState text="沒有待撥款的合作案" />;
  return (
    <ul className={rows}>
      {items.map((p) => {
        const blocker = payoutBlocker({ testPaid: p.testPaid, refundPending: p.refundPending, hasAccount: p.bankCode !== null });
        return (
          <li key={p.id}>
            <Link
              href={`/admin/collabs/${p.id}`}
              className={`${row} space-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted">{caseCode(p.id)}</span>
                <p className="min-w-0 break-words font-semibold text-ink">{p.title}</p>
                <span className="font-serif font-bold tabular-nums text-ink">{formatTwd(p.amount)}</span>
              </div>
              <p className="min-w-0 break-words text-sm text-muted">
                {[p.creatorHandle ? `@${p.creatorHandle}${p.creatorName ? `（${p.creatorName}）` : ""}` : p.creatorName, p.brandName, p.waitingSince ? `${formatDateTw(p.waitingSince)} 起等待` : ""].filter(Boolean).join("・")}
              </p>
              <p className="text-sm">
                {p.bankCode && p.accountLast4 ? `收款帳戶 ${p.bankCode} ${maskAccount(p.accountLast4)}` : "沒有收款帳戶"}
              </p>
              {blocker && <p className="text-sm font-semibold text-danger">{blocker}</p>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
