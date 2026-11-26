import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/current-user";
import { AdminSideFooter } from "@/components/admin/AdminSideFooter";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { ADMIN_NAV } from "@/components/shell/nav";
import { SideNav } from "@/components/shell/SideNav";
import { SignOutButton } from "@/components/shell/SignOutButton";

// 與品牌、創作者區相同的殼：桌面左側 SideNav、手機底部導覽列（5 項）。
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="hidden shrink-0 md:block">
        <Suspense fallback={<div aria-hidden className="h-screen w-24" />}><SideNav items={ADMIN_NAV} footer={<AdminSideFooter />} /></Suspense>
      </aside>
      <main className="min-w-0 flex-1 bg-panel px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 md:my-3 md:mr-3 md:rounded-card md:py-8 md:pl-8 md:pr-7 md:pb-8">
        <Suspense fallback={<p className="text-muted">載入中…</p>}>
          <Gate>{children}</Gate>
        </Suspense>
      </main>
      <Suspense fallback={null}><BottomTabBar items={ADMIN_NAV} /></Suspense>
    </div>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <div className="mb-6 flex items-center justify-between md:hidden">
        <p className="font-semibold">管理後台</p>
        <SignOutButton />
      </div>
      {children}
    </>
  );
}
