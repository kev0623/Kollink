import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesSkeleton, ThreadSection } from "@/components/messages/MessagesPages";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "對話" };

export default function BrandThreadPage({ params }: Props) {
  return (
    <Suspense fallback={<MessagesSkeleton />}>
      <ThreadSection side="brand" params={params} />
    </Suspense>
  );
}
