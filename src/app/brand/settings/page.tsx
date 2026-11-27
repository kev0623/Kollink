import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { HelpLink } from "@/components/shell/HelpLink";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { BrandSettingsForm } from "./BrandSettingsForm";

export const metadata: Metadata = { title: "設定" };

export default function BrandSettingsPage() {
  return (
    <>
      <PageHeader title="設定" />
      <Suspense fallback={<FormSkeleton fields={2} />}>
        <Settings />
      </Suspense>
      <section aria-labelledby="account-title" className="mt-10 max-w-xl space-y-3 border-t border-line pt-6">
        <h2 id="account-title" className="text-lg font-bold text-ink">帳號</h2>
        <div className="-ml-3 flex flex-wrap gap-2"><HelpLink /><SignOutButton /></div>
      </section>
    </>
  );
}

async function Settings() {
  const me = await requireRole("brand");
  if (!me.brand) return null;
  return <BrandSettingsForm userId={me.id} brandName={me.brand.brandName} industry={me.brand.industry} logoPath={me.brand.logoPath} />;
}
