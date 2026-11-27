import type { Metadata } from "next";
import { Suspense } from "react";
import { RolePicker } from "@/components/auth/RolePicker";
import { onboardingPath } from "@/lib/auth/post-login";
import { h1 } from "@/components/ui/styles";

type SP = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = { title: "選擇身分" };

export default function OnboardingPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <h1 className={`${h1} mb-6`}>你是品牌還是創作者？</h1>
      {/* 先顯示不帶 next 的連結，讀到網址後換成帶 next 的（版面相同，不跳動） */}
      <Suspense fallback={<RolePicker hrefFor={(r) => `/onboarding/${r}`} />}>
        <Picker searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** 原本要去的頁面（?next=）帶到下一步，填完資料才回得去。 */
async function Picker({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : null;
  return <RolePicker hrefFor={(r) => onboardingPath(r, next)} />;
}
