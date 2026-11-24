import Link from "next/link";
import { Suspense } from "react";
import { SITE_NAME } from "@/lib/site";
import { getCurrentUser } from "@/lib/auth/current-user";
import { homeFor } from "@/lib/auth/post-login";

/** 公開頁外框：不套登入後的側邊導覽，只有簡單的頂列。 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-ink">{SITE_NAME}</Link>
        <Suspense fallback={null}>
          <TopBarLink />
        </Suspense>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12">{children}</main>
    </div>
  );
}

/** 會讀 session，所以放在 <Suspense> 內。 */
async function TopBarLink() {
  const me = await getCurrentUser();
  const cls = "inline-flex h-9 items-center rounded-btn border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-primary-soft";
  if (!me) return <Link href="/login" className={cls}>登入</Link>;
  return <Link href={me.profile ? homeFor(me.profile.role) : "/onboarding"} className={cls}>回後台</Link>;
}
