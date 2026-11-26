import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MoneySkeleton } from "@/components/earnings/EarningsParts";
import { BrandPaymentsSection } from "@/components/earnings/EarningsSections";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// 頁面殼是靜態的；searchParams 與 session 都在 <Suspense> 內讀（cacheComponents）
export const metadata: Metadata = { title: "付款紀錄" };

export default function BrandPaymentsPage({ searchParams }: Props) {
  return (
    <div>
      <PageHeader title="付款紀錄" description="每個合作案的付款狀態與金額。" />
      <Suspense fallback={<MoneySkeleton figures={2} />}>
        <BrandPaymentsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
