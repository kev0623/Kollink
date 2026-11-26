import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { SideFooter } from "@/components/shell/SideFooter";
import { SideNav } from "@/components/shell/SideNav";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { MobileTopBar } from "@/components/shell/MobileTopBar";
import { BRAND_NAV } from "@/components/shell/nav";
import { SkipLink } from "@/components/ui/SkipLink";
import { ListSkeleton } from "@/components/ui/Skeleton";

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <SkipLink />
      <aside className="hidden shrink-0 border-r border-line bg-panel md:block">
        <Suspense fallback={<div aria-hidden className="h-screen w-[88px] bg-panel" />}><SideNav items={BRAND_NAV} footer={<SideFooter />} /></Suspense>
      </aside>
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 outline-none md:px-10 md:pb-12 md:pt-10">
        <div className="mx-auto max-w-[1120px]">
          <Suspense fallback={<ListSkeleton />}>
            <Gate>{children}</Gate>
          </Suspense>
        </div>
      </main>
      <Suspense fallback={null}><BottomTabBar items={BRAND_NAV} /></Suspense>
    </div>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const me = await requireRole("brand");
  return (
    <>
      <MobileTopBar home="/brand" accountName={me.brand?.brandName} accountHref="/brand/settings" />
      {children}
    </>
  );
}
