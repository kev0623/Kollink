"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MessageRow } from "@/lib/messages/view";

export type LiveStatus = "connecting" | "live" | "error";

/**
 * 訂閱 messages 的 INSERT（Supabase Realtime Postgres Changes）。Realtime 以訂閱者的 JWT 檢查 messages_select（RLS），
 * 所以只收得到自己讀得到的訊息；conversationId 有值時再加上 conversation_id 的過濾。
 * 訂閱前先 await realtime.setAuth()（不帶參數 = 取目前 session 的 JWT），避免第一次連線還是 anon、什麼都收不到。
 * channel 名稱加亂數：realtime-js 對同名 topic 會回傳同一個 channel。
 */
export function useMessageInserts(tag: string, conversationId: string | null, onInsert: (row: MessageRow) => void): LiveStatus {
  const callback = useRef(onInsert);
  useEffect(() => {
    callback.current = onInsert;
  });
  const [status, setStatus] = useState<LiveStatus>("connecting");
  // tag／conversationId 改變時回到 connecting（render 期間重設，不在 effect 裡 setState）
  const key = `${tag}:${conversationId ?? ""}`;
  const [seenKey, setSeenKey] = useState(key);
  if (seenKey !== key) {
    setSeenKey(key);
    setStatus("connecting");
  }

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void (async () => {
      try {
        await supabase.realtime.setAuth();
      } catch {
        if (!cancelled) setStatus("error");
        return;
      }
      if (cancelled) return;
      channel = supabase
        .channel(`messages:${tag}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: conversationId ? `conversation_id=eq.${conversationId}` : undefined,
          },
          (payload) => callback.current(payload.new as MessageRow),
        )
        .subscribe((s) => {
          if (cancelled) return;
          if (s === "SUBSCRIBED") setStatus("live");
          else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setStatus("error");
        });
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [tag, conversationId]);

  return status;
}
