import Link from "next/link";
import { UserRound } from "lucide-react";
import { btn } from "@/components/ui/styles";
import { SITE_NAME } from "@/lib/site";

/**
 * 手機版頂列（md 以上隱藏）：左邊是 Kollink 標誌（紅點＋名稱，連到各區首頁），右邊是帳號按鈕。
 * accountHref 為 null 時右側放 children（管理員：主題＋登出）。accountName 只給螢幕閱讀器。
 */
export function MobileTopBar({ home, accountName, accountHref, children }: { home: string; accountName?: string; accountHref: string | null; children?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
      <Link href={home} className="flex h-11 items-center gap-2 rounded-btn text-lg font-extrabold tracking-tight text-ink">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />{SITE_NAME}
      </Link>
      {accountHref ? (
        <Link href={accountHref} className={btn.icon}>
          <UserRound size={22} strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">帳號與設定{accountName ? `（${accountName}）` : ""}</span>
        </Link>
      ) : (
        <div className="flex shrink-0 items-center gap-1">{children}</div>
      )}
    </div>
  );
}
