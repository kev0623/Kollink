import Link from "next/link";
import { AccountLink } from "@/components/shell/AccountLink";
import { SkipLink } from "@/components/ui/SkipLink";
import { SITE_NAME } from "@/lib/site";

/** 公開的創作者列表外框：頂列＋內容，不套登入後的側邊導覽。 */
export default function CreatorsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <SkipLink />
      <header className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 md:px-16">
        <Link href="/" className="flex h-11 items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />{SITE_NAME}
        </Link>
        <AccountLink />
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1280px] px-5 pb-20 outline-none md:px-16">{children}</main>
    </div>
  );
}
