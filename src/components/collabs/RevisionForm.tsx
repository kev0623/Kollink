"use client";

import { useId, useState } from "react";
import { brandCollabAction } from "@/app/brand/collabs/actions";
import { ErrorText } from "@/components/ui/ErrorText";
import { btn, textarea } from "@/components/ui/styles";
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
  const over = count > NOTE_MAX;

  if (!open) {
    return (
      <div className="w-full sm:w-auto">
        <button type="button" onClick={() => setOpen(true)} aria-expanded={false} className={`${btn.secondary} w-full sm:w-auto`}>
          要求修改
        </button>
        {notice && <p role="status" className="mt-2 text-sm text-muted">{notice}</p>}
      </div>
    );
  }
  return (
    <div role="group" aria-label="要求修改" className="w-full rounded-card border border-line-strong bg-surface p-4">
      <label htmlFor={id} className="text-sm font-bold text-ink">要修改的地方（必填）</label>
      <textarea
        id={id} rows={4} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending}
        aria-invalid={error ? true : undefined} className={`${textarea} mt-1.5`}
      />
      <p aria-live="polite" className={`mt-1 text-right text-xs tabular-nums ${over ? "font-bold text-danger" : "text-muted"}`}>
        {count}/{NOTE_MAX}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button" disabled={pending || over} className={btn.primary}
          onClick={() => {
            const err = validateRevisionNote(note.trim());
            if (err) return setError(err);
            run(() => brandCollabAction(collabId, "request_changes", note), () => { setOpen(false); setNote(""); });
          }}
        >
          {pending ? "送出中…" : "送出修改要求"}
        </button>
        <button type="button" disabled={pending} onClick={() => { setOpen(false); setError(null); }} className={btn.secondary}>取消</button>
      </div>
      <div className="mt-2"><ErrorText message={error} /></div>
      {notice && <p role="status" className="mt-2 text-sm text-muted">{notice}</p>}
    </div>
  );
}
