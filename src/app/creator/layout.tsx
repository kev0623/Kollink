import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { SideNav } from "@/components/shell/SideNav";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { CREATOR_NAV } from "@/components/shell/nav";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { StatusBanner } from "./StatusBanner";

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:block">
        <SideNav items={CREATOR_NAV} footer={<SignOutButton />} />
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 md:px-8 md:pb-8">
        <Suspense fallback={<p className="text-muted">載入中…</p>}>
          <Gate>{children}</Gate>
        </Suspense>
      </main>
      <BottomTabBar items={CREATOR_NAV} />
    </div>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const me = await requireRole("creator");
  return (
    <>
      <StatusBanner me={me} />
      {children}
    </>
  );
}
