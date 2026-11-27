import Link from "next/link";
import { AccountLink } from "@/components/shell/AccountLink";
import { SITE_NAME } from "@/lib/site";

export function TopBar() {
  return (
    <header className="absolute inset-x-0 top-0 z-10">
      <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-5 md:px-16">
        <Link href="/" className="flex h-11 items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />{SITE_NAME}
        </Link>
        <nav aria-label="主要" className="flex items-center gap-1 md:gap-3">
          <Link href="/creators" className="inline-flex h-11 items-center rounded-btn px-3 text-sm font-bold text-ink hover:bg-subtle">找創作者</Link>
          <Link href="/#how" className="hidden h-11 items-center rounded-btn px-3 text-sm font-bold text-ink hover:bg-subtle md:inline-flex">怎麼運作</Link>
          <Link href="/#faq" className="hidden h-11 items-center rounded-btn px-3 text-sm font-bold text-ink hover:bg-subtle md:inline-flex">常見問題</Link>
          <AccountLink />
        </nav>
      </div>
    </header>
  );
}
