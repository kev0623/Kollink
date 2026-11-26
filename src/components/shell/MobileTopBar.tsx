import Link from "next/link";
import { UserRound } from "lucide-react";
import { btn } from "@/components/ui/styles";

/** 手機版頂列（md 以上隱藏）。accountHref 為 null 時右側放 children（管理員：主題＋登出）。 */
export function MobileTopBar({ title, accountHref, children }: { title: string; accountHref: string | null; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 md:hidden">
      <p className="min-w-0 truncate font-bold text-ink">{title}</p>
      {accountHref ? (
        <Link href={accountHref} className={btn.icon}>
          <UserRound size={22} strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">帳號與設定</span>
        </Link>
      ) : (
        <div className="flex shrink-0 items-center gap-1">{children}</div>
      )}
    </div>
  );
}
