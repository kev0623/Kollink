import type { Metadata } from "next";
import { Suspense } from "react";
import { CollabListSection, CollabListSkeleton } from "@/components/collabs/CollabPages";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// 頁面殼是靜態的；searchParams 與 session 都在 <Suspense> 內讀（cacheComponents）
export const metadata: Metadata = { title: "我的合作" };

export default function CreatorCollabsPage({ searchParams }: Props) {
  return (
    <div>
      <h1 className="text-[32px] font-bold text-ink">合作</h1>
      <div className="mt-6">
        <Suspense fallback={<CollabListSkeleton />}>
          <CollabListSection side="creator" searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
