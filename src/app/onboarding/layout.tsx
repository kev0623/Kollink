import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, getIsAdmin } from "@/lib/auth/current-user";
import { homeFor } from "@/lib/auth/post-login";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-8 md:py-12">
      <Suspense fallback={<p className="text-muted">載入中…</p>}>
        <Gate>{children}</Gate>
      </Suspense>
    </main>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login?next=/onboarding");
  if (me.profile) redirect(homeFor(me.profile.role));
  // 管理員帳號（計畫 9）沒有 profile，不填資料
  if (await getIsAdmin()) redirect("/admin");
  return <>{children}</>;
}
