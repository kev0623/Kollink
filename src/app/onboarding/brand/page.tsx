import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/safe-next";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { h1 } from "@/components/ui/styles";
import { BrandOnboardingForm } from "../BrandOnboardingForm";

type SP = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = { title: "建立品牌資料" };

export default function BrandOnboardingPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <h1 className={`${h1} mb-6`}>填寫品牌資料</h1>
      <Suspense fallback={<FormSkeleton fields={2} />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Form({ searchParams }: { searchParams: SP }) {
  const me = await getCurrentUser();
  if (!me) return null; // layout 已處理導向
  const sp = await searchParams;
  // 填完要回去的頁面：這裡只擋外部網址，是否採用由送出時的 afterOnboardingPath 決定
  return <BrandOnboardingForm userId={me.id} next={safeNextPath(typeof sp.next === "string" ? sp.next : null)} />;
}
