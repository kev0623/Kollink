import Link from "next/link";
import { AccountLink } from "@/components/shell/AccountLink";
import { SiteNav } from "@/components/site/SiteNav";
import { SITE_NAME } from "@/lib/site";

/**
 * 公開頁的頂列：浮在頁面上的膠囊（globals.css 的 .nav-float／.nav-pill）。
 * 佔的高度是 12px 間距加膠囊（手機 56px、桌面 64px）；首頁主視覺用負的 margin 墊到它底下。
 */
export function TopBar() {
  return (
    <header className="nav-float z-30">
      <div className="nav-pill relative mx-auto flex h-14 max-w-[1200px] items-center pl-5 pr-2 md:h-16 md:pl-7 md:pr-3">
        <Link href="/" className="flex h-11 shrink-0 items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />{SITE_NAME}
        </Link>
        <SiteNav account={<AccountLink />} />
      </div>
    </header>
  );
}
