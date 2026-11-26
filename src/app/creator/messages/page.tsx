import type { Metadata } from "next";
import { Suspense } from "react";
import { ConversationIndexSection, MessagesSkeleton } from "@/components/messages/MessagesPages";

// 頁面殼是靜態的；session 在 <Suspense> 內讀（cacheComponents）
export const metadata: Metadata = { title: "訊息" };

export default function CreatorMessagesPage() {
  return (
    <Suspense fallback={<MessagesSkeleton />}>
      <ConversationIndexSection side="creator" />
    </Suspense>
  );
}
