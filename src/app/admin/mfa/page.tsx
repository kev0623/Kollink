import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MfaForm } from "@/components/admin/MfaForm";
import { getCurrentUser, getIsAdmin, getIsAdminAccount } from "@/lib/auth/current-user";
import { homeFor } from "@/lib/auth/post-login";
import { adminNextPath } from "@/lib/auth/admin-next";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { SITE_NAME } from "@/lib/site";

type SP = Promise<Record<string, string | string[] | undefined>>;

// 管理員第二步驟（TOTP）。刻意放在 (console) 群組之外：後台 layout 會呼叫 requireAdmin()，
// 還沒通過第二步驟的管理員會被導到這裡，不能再被同一個守門擋回去。
export const metadata: Metadata = { title: "管理員驗證" };

export default function AdminMfaPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto max-w-md px-4 py-8 md:py-16">
      <div className="rounded-card border border-line bg-surface p-5 md:p-8">
        <h1 className="text-[32px] font-bold text-ink">{SITE_NAME} 管理後台</h1>
        <Suspense fallback={<p className="mt-6 text-muted">載入中…</p>}>
          <Content searchParams={searchParams} />
        </Suspense>
        <div className="mt-6 text-center"><SignOutButton /></div>
      </div>
    </main>
  );
}

async function Content({ searchParams }: { searchParams: SP }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login?next=/admin");
  if (!(await getIsAdminAccount())) redirect(me.profile ? homeFor(me.profile.role) : "/onboarding");

  const sp = await searchParams;
  const next = adminNextPath(typeof sp.next === "string" ? sp.next : null) ?? "/admin";
  if (await getIsAdmin()) redirect(next);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const factor = data.totp[0] ?? null; // totp 只含已驗證的因子
  return <MfaForm mode={factor ? "verify" : "enroll"} factorId={factor?.id ?? null} next={next} />;
}
