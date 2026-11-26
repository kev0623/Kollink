import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MoneySkeleton } from "@/components/earnings/EarningsParts";
import { CreatorEarningsSection } from "@/components/earnings/EarningsSections";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// 頁面殼是靜態的；searchParams 與 session 都在 <Suspense> 內讀（cacheComponents）
export const metadata: Metadata = { title: "收入" };

export default function CreatorEarningsPage({ searchParams }: Props) {
  return (
    <div>
      <PageHeader title="收入" description="合作完成後，平台會以銀行轉帳撥款給你。" />
      <Suspense fallback={<MoneySkeleton figures={3} />}>
        <CreatorEarningsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
