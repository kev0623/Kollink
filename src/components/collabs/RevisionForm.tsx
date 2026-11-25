"use client";

import { useId, useState } from "react";
import { brandCollabAction } from "@/app/brand/collabs/actions";
import { textLength } from "@/lib/validation/brief";
import { NOTE_MAX, validateRevisionNote } from "@/lib/validation/collab";
import { useCollabAction } from "./useCollabAction";

/** 要求修改：頁面內展開的確認區塊，說明必填、最多 1000 字。 */
export function RevisionForm({ collabId }: { collabId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const { pending, error, notice, run, setError } = useCollabAction();
  const id = useId();
  const count = textLength(note);

  if (!open) {
    return (
      <div className="w-full sm:w-auto">
        <button type="button" onClick={() => setOpen(true)} aria-expanded={false}
          className="h-11 w-full rounded-btn border border-line bg-surface px-4 font-semibold text-ink sm:w-auto">
          要求修改
        </button>
        {notice && <p role="status" className="mt-2 text-sm text-muted">{notice}</p>}
      </div>
    );
  }
  return (
    <div role="group" aria-label="要求修改" className="w-full rounded-card border border-line bg-surface p-4">
      <label htmlFor={id} className="text-sm font-semibold text-ink">要修改的地方（必填）</label>
      <textarea
        id={id} rows={4} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending}
        className="mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ink"
      />
      <p aria-live="polite" className={`text-right text-xs ${count > NOTE_MAX ? "font-semibold text-danger" : "text-muted"}`}>
        {count}/{NOTE_MAX}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button" disabled={pending}
          onClick={() => {
            const err = validateRevisionNote(note.trim());
            if (err) return setError(err);
            run(() => brandCollabAction(collabId, "request_changes", note), () => { setOpen(false); setNote(""); });
          }}
          className="h-10 rounded-btn bg-ink px-4 text-sm font-semibold text-on-ink disabled:opacity-60"
        >
          {pending ? "送出中…" : "送出修改要求"}
        </button>
        <button type="button" disabled={pending} onClick={() => { setOpen(false); setError(null); }}
          className="h-10 rounded-btn border border-line px-4 text-sm font-semibold text-ink disabled:opacity-60">
          取消
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="mt-2 text-sm text-muted">{notice}</p>}
    </div>
  );
}
