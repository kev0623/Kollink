import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesSkeleton, ThreadSection } from "@/components/messages/MessagesPages";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "對話" };

export default function CreatorThreadPage({ params }: Props) {
  return (
    <Suspense fallback={<MessagesSkeleton />}>
      <ThreadSection side="creator" params={params} />
    </Suspense>
  );
}
