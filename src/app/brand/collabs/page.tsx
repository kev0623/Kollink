import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { CollabListSection, CollabListSkeleton } from "@/components/collabs/CollabPages";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// 頁面殼是靜態的；searchParams 與 session 都在 <Suspense> 內讀（cacheComponents）
export const metadata: Metadata = { title: "合作案" };

export default function BrandCollabsPage({ searchParams }: Props) {
  return (
    <div>
      <PageHeader title="合作案" />
      <div>
        <Suspense fallback={<CollabListSkeleton />}>
          <CollabListSection side="brand" searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
