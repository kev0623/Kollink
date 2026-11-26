import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getIsAdminAccount } from "@/lib/auth/current-user";
import { homeFor } from "@/lib/auth/post-login";
import { SkipLink } from "@/components/ui/SkipLink";
import { Skeleton } from "@/components/ui/Skeleton";
import { SITE_NAME } from "@/lib/site";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100svh] bg-bg">
      <SkipLink />
      <header className="mx-auto flex h-16 max-w-xl items-center px-4">
        <Link href="/" className="flex h-11 items-center gap-2 font-extrabold text-ink"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />{SITE_NAME}</Link>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-xl px-4 pb-16 outline-none">
        <Suspense fallback={<Skeleton className="h-96 w-full" />}><Gate>{children}</Gate></Suspense>
      </main>
    </div>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login?next=/onboarding");
  if (me.profile) redirect(homeFor(me.profile.role));
  // 管理員帳號（計畫 9）沒有 profile，不填資料
  if (await getIsAdminAccount()) redirect("/admin");
  return <>{children}</>;
}
