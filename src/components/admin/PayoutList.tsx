import Link from "next/link";
import { formatDateTw } from "@/lib/briefs/dates";
import { caseCode } from "@/lib/collabs/view";
import { formatTwd } from "@/lib/format";
import { maskAccount } from "@/lib/payout-account";
import { payoutBlocker, type AdminPayout } from "@/lib/admin/view";
import { emptyClassName } from "./styles";

/** 待撥款列表：帳戶只顯示末四碼；完整帳號在合作案詳情的撥款區（會記錄查看）。 */
export function PayoutList({ items }: { items: AdminPayout[] }) {
  if (items.length === 0) return <p className={emptyClassName}>沒有待撥款的合作案</p>;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {items.map((p) => {
        const blocker = payoutBlocker({ testPaid: p.testPaid, refundPending: p.refundPending, hasAccount: p.bankCode !== null });
        return (
          <li key={p.id}>
            <Link
              href={`/admin/collabs/${p.id}`}
              className="block space-y-1 p-4 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink md:p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted">{caseCode(p.id)}</span>
                <p className="min-w-0 break-words font-semibold text-ink">{p.title}</p>
                <span className="font-semibold text-primary">{formatTwd(p.amount)}</span>
              </div>
              <p className="min-w-0 break-words text-sm text-muted">
                @{p.creatorHandle}（{p.creatorName}）・{p.brandName}・{p.waitingSince ? `${formatDateTw(p.waitingSince)} 起等待` : ""}
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
