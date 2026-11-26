import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { SideFooter } from "@/components/shell/SideFooter";
import { SideNav } from "@/components/shell/SideNav";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { MobileTopBar } from "@/components/shell/MobileTopBar";
import { CREATOR_NAV } from "@/components/shell/nav";
import { StatusBanner } from "./StatusBanner";
import { SkipLink } from "@/components/ui/SkipLink";
import { ListSkeleton } from "@/components/ui/Skeleton";

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <SkipLink />
      <aside className="hidden shrink-0 md:block">
        <Suspense fallback={<div aria-hidden className="h-screen w-[88px] bg-panel" />}><SideNav items={CREATOR_NAV} footer={<SideFooter />} /></Suspense>
      </aside>
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 outline-none md:px-10 md:pb-12 md:pt-10">
        <div className="mx-auto max-w-[1120px]">
          <Suspense fallback={<ListSkeleton />}>
            <Gate>{children}</Gate>
          </Suspense>
        </div>
      </main>
      <Suspense fallback={null}><BottomTabBar items={CREATOR_NAV} /></Suspense>
    </div>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const me = await requireRole("creator");
  return (
    <>
      <MobileTopBar title={me.profile?.displayName ?? "創作者"} accountHref="/creator/me" />
      <StatusBanner me={me} />
      {children}
    </>
  );
}
