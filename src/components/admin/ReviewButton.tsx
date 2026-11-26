"use client";

import { useState, useTransition } from "react";
import { markMessageReviewedAction } from "@/app/admin/actions";

/** 標記已檢視：不會改變任何人的資料，所以不需要確認區塊；進行中 disabled。 */
export function ReviewButton({ messageId }: { messageId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button" disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const res = await markMessageReviewedAction(messageId);
              if (!res.ok) setError(res.error);
            } catch {
              setError("發生錯誤，請稍後再試");
            }
          });
        }}
        className="h-10 rounded-btn border border-line bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "處理中…" : "標記已檢視"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
