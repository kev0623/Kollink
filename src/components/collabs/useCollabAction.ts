"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isStaleStateMessage } from "@/lib/briefs/errors";

type Result = { ok: true } | { ok: false; error?: string };

/**
 * 呼叫合作案的 Server Action：進行中 pending；狀態已變（連點、另一個分頁）時不當成錯誤，
 * 顯示提示並 router.refresh()；其他錯誤顯示在 error。
 */
export function useCollabAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function run(fn: () => Promise<Result>, onOk?: () => void) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          onOk?.();
          return;
        }
        if (res.error && isStaleStateMessage(res.error)) {
          setNotice("狀態已更新，已為你重新整理");
          router.refresh();
        } else if (res.error) {
          setError(res.error);
        }
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }

  return { pending, error, notice, run, setError };
}
