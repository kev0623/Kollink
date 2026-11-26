"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MESSAGES_READ_EVENT, unreadBadgeText } from "@/lib/messages/view";
import { useMessageInserts } from "@/components/messages/useMessageInserts";

async function fetchUnread(): Promise<number | null> {
  const { data, error } = await createClient().rpc("unread_conversation_count");
  return !error && typeof data === "number" ? data : null;
}

/**
 * 導覽列「訊息」圖示右上角的未讀徽章（有未讀的對話數）。用瀏覽器 client 直接呼叫 unread_conversation_count
 * （definer 函式自己用 auth.uid()）。重新查詢的時機：掛上、換頁、ThreadView 標記已讀、任何新訊息（Realtime）。
 */
export function UnreadBadge() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetchUnread()
      .then((n) => {
        if (!cancelled && n !== null) setCount(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname, tick]);

  useEffect(() => {
    window.addEventListener(MESSAGES_READ_EVENT, bump);
    return () => window.removeEventListener(MESSAGES_READ_EVENT, bump);
  }, [bump]);

  useMessageInserts("nav", null, bump);

  const text = unreadBadgeText(count);
  if (!text) return null;
  return (
    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-btn bg-danger px-1 text-[10px] font-semibold leading-none text-on-ink">
      {text}
      <span className="sr-only">個對話有未讀訊息</span>
    </span>
  );
}
