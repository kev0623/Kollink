"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { nextPollDelay } from "@/lib/payments/poll";
import { btn } from "@/components/ui/styles";

/** 從綠界回來、款項確認中：每 5 秒重新整理（分頁隱藏時跳過），最多 3 分鐘；付款確認後頁面狀態改變，這個元件就不再渲染。 */
export function PaymentStatusPoller() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const delay = nextPollDelay(attempt);

  useEffect(() => {
    if (delay === null) return;
    const t = window.setTimeout(() => {
      if (!document.hidden) router.refresh();
      setAttempt((a) => a + 1);
    }, delay);
    return () => window.clearTimeout(t);
  }, [attempt, delay, router]);

  // 分頁隱藏時輪詢會跳過；回到這個分頁時補一次重新整理（超過 3 分鐘視窗後回來也能更新）
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-input border border-line bg-subtle p-4 text-sm text-ink">
      <span className="flex min-w-0 items-center gap-2">
        <RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" className={`shrink-0 ${delay !== null ? "motion-safe:animate-spin" : ""}`} />
        <span>{delay !== null ? "剛在綠界完成付款？正在確認中，確認後頁面會自動更新；請不要重複付款。" : "還沒收到付款確認。綠界有時需要幾分鐘，可以稍後再重新整理。"}</span>
      </span>
      <button type="button" onClick={() => { setAttempt(0); router.refresh(); }} className={btn.secondary}>重新整理</button>
    </div>
  );
}
