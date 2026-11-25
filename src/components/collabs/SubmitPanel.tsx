"use client";

import { useId, useState } from "react";
import { FileText, Film, ImageIcon, X } from "lucide-react";
import { submitDeliverablesAction } from "@/app/creator/collabs/actions";
import { createClient } from "@/lib/supabase/client";
import {
  DELIVERABLE_ACCEPT, DELIVERABLES_BUCKET, fileKindOf, MAX_DELIVERABLE_FILES, planDeliverableUpload,
} from "@/lib/deliverables";
import { textLength } from "@/lib/validation/brief";
import { NOTE_MAX, parseLinks, validateSubmission } from "@/lib/validation/collab";
import { useCollabAction } from "./useCollabAction";

type Uploaded = { path: string; name: string };

/**
 * 交稿：選檔就直接上傳到 deliverables/<合作案>/<自己>/<uuid>.<副檔名>（瀏覽器、創作者自己的 client）；
 * 送出前移除的檔案立即刪除（還沒交出的檔案 policy 允許刪）。送出時呼叫 submitDeliverablesAction。
 */
export function SubmitPanel({ collabId, uid }: { collabId: string; uid: string }) {
  const [files, setFiles] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [links, setLinks] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { pending, error, notice, run } = useCollabAction();
  const noteId = useId();
  const linksId = useId();
  const busy = uploading || pending;

  async function onPick(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploadMsg(null);
    const picked = Array.from(list);
    if (files.length + picked.length > MAX_DELIVERABLE_FILES) {
      return setUploadMsg(`一次最多 ${MAX_DELIVERABLE_FILES} 個檔案`);
    }
    setUploading(true);
    const storage = createClient().storage.from(DELIVERABLES_BUCKET);
    try {
      for (const file of picked) {
        const plan = planDeliverableUpload(collabId, uid, file, crypto.randomUUID());
        if ("error" in plan) {
          setUploadMsg(`${file.name}：${plan.error}`);
          continue;
        }
        const { error: e } = await storage.upload(plan.path, file, { contentType: file.type, upsert: false });
        if (e) {
          setUploadMsg(`${file.name}：上傳失敗，請再試一次`);
          continue;
        }
        setFiles((cur) => [...cur, { path: plan.path, name: file.name }]);
      }
    } finally {
      setUploading(false);
    }
  }

  function removeFile(path: string) {
    setFiles((cur) => cur.filter((f) => f.path !== path));
    void Promise.resolve(createClient().storage.from(DELIVERABLES_BUCKET).remove([path])).catch(() => {});
  }

  function submit() {
    const input = { note: note.trim(), links: parseLinks(links), filePaths: files.map((f) => f.path) };
    const fe = validateSubmission(input, collabId, uid);
    setFieldErrors(fe ?? {});
    if (fe) return;
    run(async () => {
      const res = await submitDeliverablesAction(collabId, input);
      if (!res.ok && res.fieldErrors) setFieldErrors(res.fieldErrors);
      return res.ok ? res : { ok: false, error: res.error };
    });
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <p className="text-sm font-semibold text-ink">作品檔案</p>
        <p className="text-xs text-muted">JPG、PNG、WebP、MP4、MOV、PDF，每個 50MB 以內，最多 {MAX_DELIVERABLE_FILES} 個</p>
        <input
          type="file" multiple accept={DELIVERABLE_ACCEPT} disabled={busy || files.length >= MAX_DELIVERABLE_FILES}
          aria-label="上傳作品檔案" className="mt-2 w-full min-w-0 text-sm"
          onChange={(e) => { void onPick(e.target.files); e.target.value = ""; }}
        />
        {uploading && <p role="status" className="mt-1 text-sm text-muted">上傳中…</p>}
        {uploadMsg && <p role="alert" className="mt-1 text-sm text-danger">{uploadMsg}</p>}
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f) => {
              const kind = fileKindOf(f.path);
              const Icon = kind === "video" ? Film : kind === "pdf" ? FileText : ImageIcon;
              return (
                <li key={f.path} className="flex items-center gap-2 rounded-btn border border-line px-3 py-2 text-sm">
                  <Icon size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
                  <button type="button" onClick={() => removeFile(f.path)} disabled={busy} aria-label={`移除 ${f.name}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn text-muted disabled:opacity-60">
                    <X size={16} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {fieldErrors.files && <p className="mt-1 text-sm text-danger">{fieldErrors.files}</p>}
      </div>
      <div>
        <label htmlFor={linksId} className="text-sm font-semibold text-ink">連結（選填，一行一個，最多 5 個）</label>
        <textarea id={linksId} rows={2} value={links} onChange={(e) => setLinks(e.target.value)} disabled={pending}
          placeholder="https://drive.google.com/..."
          className="mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ink" />
        {fieldErrors.links && <p className="mt-1 text-sm text-danger">{fieldErrors.links}</p>}
      </div>
      <div>
        <label htmlFor={noteId} className="text-sm font-semibold text-ink">說明（選填）</label>
        <textarea id={noteId} rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending}
          className="mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ink" />
        <p className={`text-right text-xs ${textLength(note) > NOTE_MAX ? "font-semibold text-danger" : "text-muted"}`}>
          {textLength(note)}/{NOTE_MAX}
        </p>
        {fieldErrors.note && <p className="text-sm text-danger">{fieldErrors.note}</p>}
      </div>
      <button type="button" onClick={submit} disabled={busy}
        className="h-11 w-full rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 sm:w-auto">
        {pending ? "送出中…" : uploading ? "等待上傳完成…" : "交稿"}
      </button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted">{notice}</p>}
    </div>
  );
}
