import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { CollabDetailSection } from "@/components/collabs/CollabPages";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "合作案詳情" };

export default function CreatorCollabPage({ params }: Props) {
  return (
    <div>
      <Link href="/creator/collabs" className="text-sm text-muted">← 合作</Link>
      <div className="mt-2">
        <Suspense fallback={<p className="text-muted">載入中…</p>}>
          <CollabDetailSection side="creator" params={params} />
        </Suspense>
      </div>
    </div>
  );
}
