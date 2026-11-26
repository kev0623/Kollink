import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { AccountLink } from "@/components/shell/AccountLink";

/** 公開頁外框：不套登入後的側邊導覽，只有簡單的頂列。 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-ink">{SITE_NAME}</Link>
        <AccountLink />
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12">{children}</main>
    </div>
  );
}
