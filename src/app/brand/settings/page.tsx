import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { ThemeSelect } from "@/components/theme/ThemeSelect";
import { HelpLink } from "@/components/shell/HelpLink";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { BrandSettingsForm } from "./BrandSettingsForm";

export const metadata: Metadata = { title: "品牌設定" };

export default function BrandSettingsPage() {
  return (
    <>
      <h1 className="mb-6 text-[32px] font-bold text-ink">設定</h1>
      <Suspense fallback={null}>
        <Settings />
      </Suspense>
      <section aria-labelledby="account-title" className="mt-10 max-w-xl space-y-3 border-t border-line pt-6">
        <h2 id="account-title" className="text-lg font-bold text-ink">外觀與帳號</h2>
        <ThemeSelect />
        <div className="flex flex-wrap gap-2"><HelpLink /><SignOutButton /></div>
      </section>
    </>
  );
}

async function Settings() {
  const me = await requireRole("brand");
  if (!me.brand) return null;
  return <BrandSettingsForm userId={me.id} brandName={me.brand.brandName} industry={me.brand.industry} logoPath={me.brand.logoPath} />;
}
