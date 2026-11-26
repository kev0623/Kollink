import { Suspense } from "react";
import { ConversationIndexSection, MessagesSkeleton } from "@/components/messages/MessagesPages";

// 頁面殼是靜態的；session 在 <Suspense> 內讀（cacheComponents）
export default function BrandMessagesPage() {
  return (
    <Suspense fallback={<MessagesSkeleton />}>
      <ConversationIndexSection side="brand" />
    </Suspense>
  );
}
