import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { BrandSettingsForm } from "./BrandSettingsForm";

export default function BrandSettingsPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">設定</h1>
      <Suspense fallback={null}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const me = await requireRole("brand");
  if (!me.brand) return null;
  return <BrandSettingsForm userId={me.id} brandName={me.brand.brandName} industry={me.brand.industry} logoPath={me.brand.logoPath} />;
}
