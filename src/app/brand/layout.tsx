import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { SideFooter } from "@/components/shell/SideFooter";
import { SideNav } from "@/components/shell/SideNav";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { BRAND_NAV } from "@/components/shell/nav";
import { SignOutButton } from "@/components/shell/SignOutButton";

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="hidden shrink-0 md:block">
        <Suspense fallback={<div aria-hidden className="h-screen w-24" />}><SideNav items={BRAND_NAV} footer={<SideFooter />} /></Suspense>
      </aside>
      <main className="min-w-0 flex-1 bg-panel px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 md:my-3 md:mr-3 md:rounded-card md:py-8 md:pl-8 md:pr-7 md:pb-8">
        <Suspense fallback={<p className="text-muted">載入中…</p>}>
          <Gate>{children}</Gate>
        </Suspense>
      </main>
      {/* 手機只放可用的項目（計畫 7 起共 5 項）；「即將推出」的項目放不下 */}
      <Suspense fallback={null}><BottomTabBar items={BRAND_NAV.filter((i) => i.href)} /></Suspense>
    </div>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const me = await requireRole("brand");
  return (
    <>
      <div className="mb-6 flex items-center justify-between md:hidden">
        <p className="font-semibold">{me.brand?.brandName}</p>
        <SignOutButton />
      </div>
      {children}
    </>
  );
}
