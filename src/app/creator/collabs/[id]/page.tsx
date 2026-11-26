import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DetailSkeleton } from "@/components/ui/Skeleton";
import { CollabDetailSection } from "@/components/collabs/CollabPages";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "合作案詳情" };

export default function CreatorCollabPage({ params }: Props) {
  return (
    <div>
      <Link href="/creator/collabs" className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-btn px-2 text-sm text-muted hover:text-ink">
        <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />合作
      </Link>
      <div>
        <Suspense fallback={<DetailSkeleton />}>
          <CollabDetailSection side="creator" params={params} />
        </Suspense>
      </div>
    </div>
  );
}
