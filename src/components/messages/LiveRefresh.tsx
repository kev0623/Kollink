"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMessageInserts } from "./useMessageInserts";

/**
 * 對話列表的即時更新：收到任何新訊息（Realtime 只送自己讀得到的）就 debounce 400ms 後 router.refresh()，
 * 由伺服器重算預覽、排序與未讀數。refresh 會保留 ThreadView 的 state（use-router.md）。
 */
export function LiveRefresh() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useMessageInserts("list", null, () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 400);
  });
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return null;
}
