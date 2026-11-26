"use client";

import { useId, useState } from "react";
import { FileText, Film, ImageIcon } from "lucide-react";
import { submitDeliverablesAction } from "@/app/creator/collabs/actions";
import { ErrorText } from "@/components/ui/ErrorText";
import { FilePicker } from "@/components/ui/FilePicker";
import { btn, textarea } from "@/components/ui/styles";
import { createClient } from "@/lib/supabase/client";
import { uploadErrorMessage } from "@/lib/upload-limits";
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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [links, setLinks] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { pending, error, notice, run } = useCollabAction();
  const noteId = useId();
  const linksId = useId();
  const busy = uploading || pending;

  async function onPick(picked: File[]) {
    if (picked.length === 0) return;
    setUploadMsg(null);
    if (files.length + picked.length > MAX_DELIVERABLE_FILES) {
      return setUploadMsg(`一次最多 ${MAX_DELIVERABLE_FILES} 個檔案`);
    }
    setUploading(true);
    setProgress({ done: 0, total: picked.length });
    const failures: string[] = [];
    try {
      const storage = createClient().storage.from(DELIVERABLES_BUCKET);
      for (const [n, file] of picked.entries()) {
        setProgress({ done: n, total: picked.length });
        const plan = planDeliverableUpload(collabId, uid, file, crypto.randomUUID());
        if ("error" in plan) {
          failures.push(`${file.name}：${plan.error}`);
          continue;
        }
        try {
          const { error: e } = await storage.upload(plan.path, file, { contentType: file.type, upsert: false });
          if (e) {
            failures.push(`${file.name}：${uploadErrorMessage(e, "deliverables")}`);
            continue;
          }
        } catch {
          failures.push(`${file.name}：上傳失敗，請再試一次`);
          continue;
        }
        setFiles((cur) => [...cur, { path: plan.path, name: file.name }]);
      }
    } catch {
      failures.push("上傳失敗，請再試一次");
    } finally {
      setUploading(false);
      setProgress(null);
      if (failures.length > 0) setUploadMsg(failures.join("；"));
    }
  }

  async function removeFile(path: string) {
    setRemoving((cur) => new Set(cur).add(path));
    setUploadMsg(null);
    let failed = false;
    try {
      const { error: e } = await createClient().storage.from(DELIVERABLES_BUCKET).remove([path]);
      failed = !!e;
    } catch {
      failed = true;
    }
    if (failed) setUploadMsg("移除失敗，請再試一次");
    else setFiles((cur) => cur.filter((f) => f.path !== path));
    setRemoving((cur) => {
      const next = new Set(cur);
      next.delete(path);
      return next;
    });
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
        <p className="text-sm font-bold text-ink">作品檔案</p>
        <p className="text-xs text-muted">JPG、PNG、WebP、MP4、MOV、PDF，每個 50MB 以內，最多 {MAX_DELIVERABLE_FILES} 個</p>
        <div className="mt-2">
          <FilePicker
            label="選擇檔案" accept={DELIVERABLE_ACCEPT} multiple ariaLabel="上傳交稿檔案"
            disabled={busy || files.length >= MAX_DELIVERABLE_FILES} busy={uploading}
            fileName={uploading && progress ? `上傳中 ${progress.done + 1} / ${progress.total}` : files.length > 0 ? `已選 ${files.length} 個檔案` : null}
            invalid={!!fieldErrors.files} onFiles={(f) => void onPick(f)}
          />
        </div>
        {uploadMsg && <div className="mt-1 break-words"><ErrorText message={uploadMsg} /></div>}
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f) => {
              const kind = fileKindOf(f.path);
              const Icon = kind === "video" ? Film : kind === "pdf" ? FileText : ImageIcon;
              return (
                <li key={f.path} className="flex items-center gap-2 rounded-input border border-line bg-surface pl-3 text-sm">
                  <Icon size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
                  <button type="button" onClick={() => void removeFile(f.path)} disabled={busy || removing.has(f.path)} aria-label={`移除 ${f.name}`}
                    className={`${btn.ghost} shrink-0 text-muted`}>
                    移除
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-1"><ErrorText message={fieldErrors.files} /></div>
      </div>
      <div>
        <label htmlFor={linksId} className="text-sm font-bold text-ink">連結（選填，一行一個，最多 5 個）</label>
        <textarea id={linksId} rows={2} value={links} onChange={(e) => setLinks(e.target.value)} disabled={pending}
          placeholder="https://drive.google.com/..."
          aria-invalid={fieldErrors.links ? true : undefined} className={`${textarea} mt-1.5`} />
        <div className="mt-1"><ErrorText message={fieldErrors.links} /></div>
      </div>
      <div>
        <label htmlFor={noteId} className="text-sm font-bold text-ink">說明（選填）</label>
        <textarea id={noteId} rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending}
          aria-invalid={fieldErrors.note ? true : undefined} className={`${textarea} mt-1.5`} />
        <p className={`mt-1 text-right text-xs tabular-nums ${textLength(note) > NOTE_MAX ? "font-semibold text-danger" : "text-muted"}`}>
          {textLength(note)}/{NOTE_MAX}
        </p>
        <ErrorText message={fieldErrors.note} />
      </div>
      <button type="button" onClick={submit} disabled={busy}
        className={`${btn.primary} w-full sm:w-auto`}>
        {pending ? "送出中…" : uploading ? "等待上傳完成…" : "交稿"}
      </button>
      <ErrorText message={error} />
      {notice && <p role="status" className="break-words text-sm text-muted">{notice}</p>}
    </div>
  );
}
