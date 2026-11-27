import Link from "next/link";
import { AccountLink } from "@/components/shell/AccountLink";
import { SiteNav } from "@/components/site/SiteNav";
import { SITE_NAME } from "@/lib/site";

/** 公開頁的頂列。overlay：疊在首頁主視覺上（absolute、透明）；其他頁面是一般的頂列。 */
export function TopBar({ overlay }: { overlay?: boolean }) {
  return (
    <header className={overlay ? "absolute inset-x-0 top-0 z-20" : "relative z-20 border-b border-line bg-bg"}>
      <div className="relative mx-auto flex h-20 max-w-[1280px] items-center px-5 md:px-16">
        <Link href="/" className="flex h-11 shrink-0 items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />{SITE_NAME}
        </Link>
        <SiteNav account={<AccountLink />} />
      </div>
    </header>
  );
}
