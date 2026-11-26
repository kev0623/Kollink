import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNextPath } from "@/lib/auth/safe-next";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { h1 } from "@/components/ui/styles";
import { CreatorOnboardingForm } from "../CreatorOnboardingForm";

type SP = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = { title: "建立創作者資料" };

export default function CreatorOnboardingPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <h1 className={`${h1} mb-2`}>填寫創作者資料</h1>
      <p className="mb-6 text-sm text-muted">送出後會進入審核。報價和作品可以之後再補。</p>
      <Suspense fallback={<FormSkeleton fields={6} />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Form({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  // 填完要回去的頁面：這裡只擋外部網址，是否採用由送出時的 afterOnboardingPath 決定
  return <CreatorOnboardingForm next={safeNextPath(typeof sp.next === "string" ? sp.next : null)} />;
}
