import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/current-user";
import { AdminSideFooter } from "@/components/admin/AdminSideFooter";
import { ThemeSelect } from "@/components/theme/ThemeSelect";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { SideNav } from "@/components/shell/SideNav";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { MobileTopBar } from "@/components/shell/MobileTopBar";
import { ADMIN_NAV } from "@/components/shell/nav";
import { SkipLink } from "@/components/ui/SkipLink";
import { ListSkeleton } from "@/components/ui/Skeleton";

// 與品牌、創作者區相同的殼：桌面左側 SideNav、手機底部導覽列（5 項）。
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <SkipLink />
      <aside className="hidden shrink-0 border-r border-line bg-panel md:block">
        <Suspense fallback={<div aria-hidden className="h-screen w-[88px] bg-panel" />}><SideNav items={ADMIN_NAV} footer={<AdminSideFooter />} /></Suspense>
      </aside>
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 outline-none md:px-10 md:pb-12 md:pt-10">
        <div className="mx-auto max-w-[1120px]">
          <Suspense fallback={<ListSkeleton />}>
            <Gate>{children}</Gate>
          </Suspense>
        </div>
      </main>
      <Suspense fallback={null}><BottomTabBar items={ADMIN_NAV} /></Suspense>
    </div>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <MobileTopBar home="/admin" accountHref={null}>
        <ThemeSelect bar />
        <SignOutButton />
      </MobileTopBar>
      {children}
    </>
  );
}
