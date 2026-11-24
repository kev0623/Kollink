"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isStaleStateMessage } from "@/lib/briefs/errors";

type Result = { ok: true } | { ok: false; error: string } | undefined;

type Props = {
  label: string;
  /** 確認區塊裡的說明文字 */
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<Result>;
};

/** 頁面內的確認區塊（不用瀏覽器的 confirm()）：先按按鈕，展開說明與「確定／取消」。 */
export function ConfirmAction({ label, message, confirmLabel, danger, onConfirm }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const regionId = useId();

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await onConfirm();
        if (res && !res.ok) {
          if (isStaleStateMessage(res.error)) {
            // 連點或另一個分頁已處理：狀態已變，重新整理即可
            setOpen(false);
            setNotice("狀態已更新，已為你重新整理");
            router.refresh();
          } else {
            setError(res.error);
          }
        } else {
          setOpen(false);
        }
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }

  const tone = danger ? "border-danger text-danger" : "border-line text-ink";
  return (
    <div className="w-full sm:w-auto">
      {!open ? (
        <>
          <button
            type="button" onClick={() => { setNotice(null); setOpen(true); }} aria-expanded={false} aria-controls={regionId}
            className={`h-10 w-full rounded-btn border bg-surface px-4 text-sm font-semibold sm:w-auto ${tone}`}
          >
            {label}
          </button>
          {notice && <p role="status" className="mt-2 text-sm text-muted">{notice}</p>}
        </>
      ) : (
        <div id={regionId} role="group" aria-label={label} className="rounded-card border border-line bg-surface p-4">
          <p className="text-sm text-ink">{message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button" onClick={confirm} disabled={pending}
              className={`h-10 rounded-btn px-4 text-sm font-semibold text-on-ink disabled:opacity-60 ${danger ? "bg-danger" : "bg-ink"}`}
            >
              {pending ? "處理中…" : confirmLabel}
            </button>
            <button
              type="button" onClick={() => { setOpen(false); setError(null); }} disabled={pending}
              className="h-10 rounded-btn border border-line px-4 text-sm font-semibold text-ink disabled:opacity-60"
            >
              取消
            </button>
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
