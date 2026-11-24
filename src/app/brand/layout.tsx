import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SideNav } from "@/components/shell/SideNav";
import { BRAND_NAV } from "@/components/shell/nav";
import { SignOutButton } from "@/components/shell/SignOutButton";

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:block">
        <SideNav items={BRAND_NAV} footer={<SignOutButton />} />
      </aside>
      <main className="flex-1 px-4 py-8 md:px-8">
        <Suspense fallback={<p className="text-muted">載入中…</p>}>
          <Gate>{children}</Gate>
        </Suspense>
      </main>
    </div>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login?next=/brand");
  if (!me.profile) redirect("/onboarding");
  if (me.profile.role !== "brand") redirect("/creator");
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
