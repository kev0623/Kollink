"use client";

import { useState, useTransition } from "react";
import { requestReviewAction } from "./me/actions";

/** 被退回的創作者修正後按這裡，回到待審核。 */
export function ResubmitButton() {
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
              if (!res.ok) setError(res.error);
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
