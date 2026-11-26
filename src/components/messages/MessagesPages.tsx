import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { todayTw } from "@/lib/briefs/dates";
import { isUuid } from "@/lib/briefs/query";
import { loadMyConversations, loadThread } from "@/lib/messages/load";
import type { MessageSide } from "@/lib/messages/view";
import { ConversationList } from "./ConversationList";
import { LiveRefresh } from "./LiveRefresh";
import { ThreadHeader } from "./ThreadHeader";
import { ThreadView } from "./ThreadView";

/**
 * 桌面左邊列表、右邊內容；手機只顯示其中一邊（列表頁顯示列表，對話頁顯示對話）。
 * 桌面兩欄固定在視窗內各自捲動（10rem = 主內容區上下的 margin、padding 與標題）。
 */
function MessagesLayout({ list, thread }: { list: React.ReactNode; thread: React.ReactNode | null }) {
  return (
    <div>
      <h1 className={`text-[32px] font-bold text-ink ${thread ? "hidden md:block" : ""}`}>訊息</h1>
      <LiveRefresh />
      <div className="mt-4 md:grid md:h-[calc(100dvh-10rem)] md:grid-cols-[20rem_minmax(0,1fr)] md:gap-4">
        <div className={`relative min-h-0 md:block md:overflow-y-auto ${thread ? "hidden" : ""}`}>{list}</div>
        <div className={`min-h-0 min-w-0 flex-col gap-3 md:flex ${thread ? "flex" : "hidden"}`}>
          {thread ?? (
            <p className="flex flex-1 items-center justify-center rounded-card border border-line bg-surface text-sm text-muted">
              選擇一個對話開始聊天
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** 列表頁的內容（在 <Suspense> 內）：layout 的 Gate 在用戶端換頁時不會重跑，這裡自己 requireRole。 */
export async function ConversationIndexSection({ side }: { side: MessageSide }) {
  await requireRole(side);
  const items = await loadMyConversations();
  // requireRole 之後才能讀現在時間
  const today = todayTw();
  return <MessagesLayout list={<ConversationList side={side} items={items} activeId={null} today={today} />} thread={null} />;
}

/** 對話頁的內容（在 <Suspense> 內）。不是參與者、不是這一區的視角、id 不是 UUID：一律 notFound()（soft 404）。 */
export async function ThreadSection({ side, params }: { side: MessageSide; params: Promise<{ id: string }> }) {
  const me = await requireRole(side);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [items, thread] = await Promise.all([loadMyConversations(), loadThread(id)]);
  if (!thread || thread.conversation.side !== side) notFound();
  const today = todayTw();
  return (
    <MessagesLayout
      list={<ConversationList side={side} items={items} activeId={id} today={today} />}
      thread={
        <>
          <ThreadHeader side={side} c={thread.conversation} collabs={thread.collabs} />
          <ThreadView
            key={id}
            conversationId={id}
            meId={me.id}
            side={side}
            initialMessages={thread.messages}
            initialHasMore={thread.hasMore}
            closed={thread.conversation.closed}
          />
        </>
      }
    />
  );
}

export function MessagesSkeleton() {
  return (
    <div aria-busy="true">
      <p className="sr-only">載入中…</p>
      <div className="h-10 w-32 rounded-full bg-surface" />
      <div className="mt-4 h-64 rounded-card border border-line bg-surface" />
    </div>
  );
}
