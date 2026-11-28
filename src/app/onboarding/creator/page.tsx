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
      <h1 className={`${h1} mb-5`}>建立創作者檔案</h1>
      <Suspense fallback={<FormSkeleton fields={2} />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Form({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  // 填完要回去的頁面：這裡只擋外部網址，是否採用由送出時的 afterOnboardingPath 決定
  return <CreatorOnboardingForm next={safeNextPath(typeof sp.next === "string" ? sp.next : null)} siteHost={siteHost()} />;
}

/** 網站的主機名稱（例如 kollink.vercel.app），讓「領取網址」顯示完整網址；沒設定 SITE_URL 時只顯示路徑。 */
function siteHost(): string {
  try {
    return new URL(process.env.SITE_URL ?? "").host;
  } catch {
    return "";
  }
}
