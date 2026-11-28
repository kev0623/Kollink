import Link from "next/link";
import { AccountLink } from "@/components/shell/AccountLink";
import { SiteNav } from "@/components/site/SiteNav";
import { SITE_NAME } from "@/lib/site";

/**
 * 公開頁的頂列：黏在上緣的毛玻璃（globals.css 的 .topbar-glass）。
 * overlay：首頁用，一開始是透明的、疊在主視覺上，捲動後才變成毛玻璃（主視覺用 -mt-20 墊到頂列底下）。
 */
export function TopBar({ overlay }: { overlay?: boolean }) {
  return (
    <header data-overlay={overlay ? "" : undefined} className="topbar-glass z-30">
      <div className="relative mx-auto flex h-16 max-w-[1280px] md:h-20 items-center px-5 md:px-16">
        <Link href="/" className="flex h-11 shrink-0 items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />{SITE_NAME}
        </Link>
        <SiteNav account={<AccountLink />} />
      </div>
    </header>
  );
}
