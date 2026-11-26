import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { h1 } from "@/components/ui/styles";
import { BrandOnboardingForm } from "../BrandOnboardingForm";

export const metadata: Metadata = { title: "建立品牌資料" };

export default function BrandOnboardingPage() {
  return (
    <>
      <h1 className={`${h1} mb-6`}>填寫品牌資料</h1>
      <Suspense fallback={null}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  const me = await getCurrentUser();
  if (!me) return null; // layout 已處理導向
  return <BrandOnboardingForm userId={me.id} />;
}
