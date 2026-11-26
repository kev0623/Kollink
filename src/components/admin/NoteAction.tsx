"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isStaleStateMessage } from "@/lib/briefs/errors";
import { ADMIN_NOTE_MAX, validateAdminNote } from "@/lib/admin/notes";
import { textLength } from "@/lib/validation/brief";

type Result = { ok: true; notice?: string } | { ok: false; error: string };

type Props = {
  label: string;
  /** 展開後的說明（例如「已付款的款項會標記為需退款」） */
  message?: string;
  /** 輸入框的標籤，例如「退回原因（創作者看得到）」 */
  fieldLabel: string;
  /** validateAdminNote 的欄位名稱（錯誤訊息用） */
  noteName: string;
  confirmLabel: string;
  danger?: boolean;
  onSubmit: (note: string) => Promise<Result>;
};

/** 管理員動作：頁面內展開的確認區塊，原因／說明必填、最多 500 字（不用瀏覽器的 confirm()）。 */
export function NoteAction({ label, message, fieldLabel, noteName, confirmLabel, danger, onSubmit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = useId();
  const count = textLength(note);

  function submit() {
    const err = validateAdminNote(note.trim(), noteName);
    if (err) return setError(err);
    setError(null);
    startTransition(async () => {
      try {
        const res = await onSubmit(note);
        if (res.ok) {
          setOpen(false);
          setNote("");
          setNotice(res.notice ?? null);
        } else if (isStaleStateMessage(res.error)) {
          setOpen(false);
          setNotice("狀態已更新，已為你重新整理");
          router.refresh();
        } else {
          setError(res.error);
        }
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }

  const tone = danger ? "border-danger text-danger" : "border-line text-ink";
  if (!open) {
    return (
      <div className="w-full sm:w-auto">
        <button
          type="button" onClick={() => { setNotice(null); setOpen(true); }} aria-expanded={false}
          className={`h-10 w-full rounded-btn border bg-surface px-4 text-sm font-semibold sm:w-auto ${tone}`}
        >
          {label}
        </button>
        {notice && <p role="status" className="mt-2 break-words text-sm text-muted">{notice}</p>}
      </div>
    );
  }
  return (
    <div role="group" aria-label={label} className="w-full rounded-card border border-line bg-surface p-4">
      {message && <p className="mb-2 text-sm text-ink">{message}</p>}
      <label htmlFor={id} className="text-sm font-semibold text-ink">{fieldLabel}</label>
      <textarea
        id={id} rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending}
        className="mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ink"
      />
      <p aria-live="polite" className={`text-right text-xs ${count > ADMIN_NOTE_MAX ? "font-semibold text-danger" : "text-muted"}`}>
        {count}/{ADMIN_NOTE_MAX}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button" onClick={submit} disabled={pending}
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
  );
}
