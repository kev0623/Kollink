"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { loadOlderMessagesAction, markReadAction } from "@/lib/messages/actions";
import {
  closedNotice, mergeMessages, MESSAGES_READ_EVENT, toMessage, withDaySeparators,
  type Message, type MessageSide,
} from "@/lib/messages/view";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { useMessageInserts } from "./useMessageInserts";

type Props = {
  conversationId: string;
  meId: string;
  side: MessageSide;
  initialMessages: Message[];
  initialHasMore: boolean;
  closed: boolean;
};

/**
 * 對話內容：訊息（由舊到新、日期分隔線）、載入較早的訊息、即時新訊息、標記已讀、輸入區。
 * router.refresh()（列表的 LiveRefresh）會帶來新的 initialMessages：合併進目前的訊息，不覆蓋已載入的舊訊息。
 */
export function ThreadView({ conversationId, meId, side, initialMessages, initialHasMore, closed }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [seenInitial, setSeenInitial] = useState(initialMessages);
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, startOlder] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  if (initialMessages !== seenInitial) {
    setSeenInitial(initialMessages);
    setMessages((cur) => mergeMessages(cur, initialMessages));
  }

  const markRead = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    markReadAction(conversationId)
      .then((r) => {
        if (r.ok) window.dispatchEvent(new Event(MESSAGES_READ_EVENT));
      })
      .catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [markRead]);

  const live = useMessageInserts("thread", conversationId, (row) => {
    const m = toMessage(row);
    setMessages((cur) => mergeMessages(cur, [m]));
    if (m.senderId !== meId) markRead();
  });

  // 連上（第一次與每次重連）時重新取一次資料：訂閱成功之前插入的訊息收不到推送；merge 以 id 去重
  useEffect(() => {
    if (live === "live") router.refresh();
  }, [live, router]);

  // 最後一則改變（收到或送出新訊息、第一次進入）時捲到最底；載入較早的訊息不會改變最後一則，所以不捲動
  const lastId = messages.length > 0 ? messages[messages.length - 1].id : null;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  function loadOlder() {
    const first = messages[0];
    if (!first) return;
    setError(null);
    startOlder(async () => {
      try {
        const r = await loadOlderMessagesAction(conversationId, first.createdAt, first.id);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setMessages((cur) => mergeMessages(r.messages, cur));
        setHasMore(r.hasMore);
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 md:overflow-y-auto">
        {live === "error" && (
          <p role="status" className="mb-3 rounded-input bg-surface p-3 text-center text-sm text-muted">即時更新已中斷，請重新整理頁面</p>
        )}
        {hasMore && (
          <div className="mb-3 text-center">
            <button type="button" onClick={loadOlder} disabled={loadingOlder}
              className="h-9 rounded-btn border border-line bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-60">
              {loadingOlder ? "載入中…" : "載入較早的訊息"}
            </button>
          </div>
        )}
        {error && <p role="alert" className="mb-3 text-center text-sm text-danger">{error}</p>}
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">還沒有訊息，打聲招呼吧。</p>
        ) : (
          <ol aria-label="訊息" className="space-y-3 px-1">
            {withDaySeparators(messages).map((e) =>
              e.kind === "day" ? (
                <li key={e.key} className="py-1 text-center text-xs text-muted">{e.label}</li>
              ) : (
                <li key={e.key}><MessageBubble m={e.message} mine={e.message.senderId === meId} /></li>
              ),
            )}
          </ol>
        )}
        <div ref={endRef} />
      </div>
      {closed ? (
        <p className="shrink-0 rounded-card border border-line bg-surface p-4 text-center text-sm text-muted">{closedNotice(side)}</p>
      ) : (
        <Composer conversationId={conversationId} onSent={(m) => setMessages((cur) => mergeMessages(cur, [m]))} />
      )}
    </div>
  );
}
