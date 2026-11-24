import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { SideNav } from "@/components/shell/SideNav";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { BRAND_NAV } from "@/components/shell/nav";
import { SignOutButton } from "@/components/shell/SignOutButton";

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:block">
        <SideNav items={BRAND_NAV} footer={<SignOutButton />} />
      </aside>
      <main className="flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-8">
        <Suspense fallback={<p className="text-muted">載入中…</p>}>
          <Gate>{children}</Gate>
        </Suspense>
      </main>
      {/* 手機只放可用的項目，「即將推出」的 4 項放不下 */}
      <BottomTabBar items={BRAND_NAV.filter((i) => i.href)} />
    </div>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const me = await requireRole("brand");
  return (
    <>
      <div className="mb-6 flex items-center justify-between md:hidden">
        <p className="font-bold">{me.brand?.brandName}</p>
        <SignOutButton />
      </div>
      {children}
    </>
  );
}
