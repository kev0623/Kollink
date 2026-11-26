"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestReviewAction } from "./me/actions";

// 與 me/actions.ts requestReviewAction 的狀態過期訊息一致（"use server" 檔不能 export 常數）。
const STALE_MESSAGE = "狀態已經更新，請重新整理";

/** 被退回的創作者修正後按這裡，回到待審核。 */
export function ResubmitButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-3">
      <button
        type="button" disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const res = await requestReviewAction();
              if (!res.ok) {
                setError(res.error);
                // 狀態已被更新（例如管理員剛處理）：重新整理，讓橫幅反映最新狀態
                if (res.error === STALE_MESSAGE) router.refresh();
              }
            } catch {
              setError("發生錯誤，請稍後再試");
            }
          });
        }}
        className="h-11 rounded-btn bg-ink px-5 text-sm font-semibold text-on-ink disabled:opacity-60"
      >
        {pending ? "送出中…" : "我已修正，重新送審"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
