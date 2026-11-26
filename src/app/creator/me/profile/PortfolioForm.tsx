"use client";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadErrorMessage } from "@/lib/upload-limits";
import { CREATOR_MEDIA_BUCKET, creatorMediaUrl, planMediaUpload } from "@/lib/creator-media";
import { MAX_PORTFOLIO } from "@/lib/validation/creator-profile";
import { SavedMark, UnsavedBadge } from "@/components/forms/UnsavedBadge";
import { useUnsavedChanges } from "@/components/forms/useUnsavedChanges";
import { ErrorText } from "@/components/ui/ErrorText";
import { FilePicker } from "@/components/ui/FilePicker";
import { btn, cardPad, input } from "@/components/ui/styles";
import type { FormState } from "@/lib/auth/account-errors";
import type { PortfolioItem } from "@/lib/creators/view";
import { addPortfolioImageAction, updatePortfolioAction } from "./actions";

type Row = { imagePath: string; linkUrl: string };

export function PortfolioForm({ userId, initial }: { userId: string; initial: PortfolioItem[] }) {
  const initialRows = (): Row[] => initial.map((it) => ({ imagePath: it.imagePath, linkUrl: it.linkUrl ?? "" }));
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [savedRows, setSavedRows] = useState<Row[]>(initialRows);
  const saved = JSON.stringify(savedRows);
  const [showSaved, setShowSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [imgSaving, setImgSaving] = useState(false);
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  // 本次上傳、尚未儲存的檔案；儲存成功後清空（之後就是資料庫在引用的檔案，不能刪）
  const owned = useRef(new Set<string>());
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const submitted = rowsRef.current;
    const result = await updatePortfolioAction(prev, fd);
    if (result.ok) {
      owned.current.clear();
      setSavedRows(submitted);
    }
    setShowSaved(result.ok === true);
    return result;
  }, {});
  const headingId = useId();
  const dirty = JSON.stringify(rows) !== saved;
  useUnsavedChanges(dirty);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    setShowSaved(false);
    if (rows.length >= MAX_PORTFOLIO) return setMsg(`最多 ${MAX_PORTFOLIO} 張作品`);
    const plan = planMediaUpload(userId, "portfolio", file, crypto.randomUUID());
    if ("error" in plan) return setMsg(plan.error);
    setBusy(true);
    try {
      const { error } = await createClient().storage.from(CREATOR_MEDIA_BUCKET)
        .upload(plan.path, file, { contentType: file.type });
      if (error) return setMsg(uploadErrorMessage(error, "creator-media"));
      const row: Row = { imagePath: plan.path, linkUrl: "" };
      setRows((r) => [...r, row]);
      // 只儲存這張新圖（清單用已儲存的）；沒存成功時這張留在清單裡，標示尚未儲存
      setImgSaving(true);
      try {
        const res = await addPortfolioImageAction(plan.path);
        if (res.ok) {
          setSavedRows((s) => [...s, row]);
        } else {
          owned.current.add(plan.path);
          setMsg(`圖片已上傳但還沒儲存：${res.formError ?? "儲存失敗"}。可以按下方「儲存作品」再試。`);
        }
      } catch {
        owned.current.add(plan.path);
        setMsg("圖片已上傳但還沒儲存，請按下方「儲存作品」再試。");
      } finally {
        setImgSaving(false);
      }
    } catch {
      setMsg("上傳失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  }

  function move(i: number, delta: number) {
    setShowSaved(false);
    setRows((r) => {
      const j = i + delta;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function removeRow(i: number) {
    setShowSaved(false);
    const path = rows[i].imagePath;
    if (owned.current.has(path)) {
      owned.current.delete(path);
      void Promise.resolve(createClient().storage.from(CREATOR_MEDIA_BUCKET).remove([path])).catch(() => {});
    }
    setRows((r) => r.filter((_, x) => x !== i));
  }

  function setLink(i: number, linkUrl: string) {
    setShowSaved(false);
    setRows((r) => r.map((row, x) => (x === i ? { ...row, linkUrl } : row)));
  }

  const error = state.fieldErrors?.portfolio ?? state.formError;
  const noteId = useId();
  return (
    <form action={action} noValidate className={`${cardPad} max-w-2xl space-y-5`}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={headingId} className="text-lg font-bold text-ink">作品（最多 {MAX_PORTFOLIO} 張）</h3>
          <UnsavedBadge show={dirty} />
        </div>
        <p className="mt-1 text-sm text-muted">第一張排在最前面。每張可以附一個 IG 貼文連結（選填）。沒有作品時公開頁不顯示這個區塊。</p>
      </div>
      {rows.length > 0 && (
        <ol aria-labelledby={headingId} className="space-y-3">
          {rows.map((row, i) => (
            <li key={row.imagePath} className="flex gap-3 rounded-input border border-line p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={creatorMediaUrl(row.imagePath) ?? undefined} alt={`作品 ${i + 1}`} className="h-20 w-20 shrink-0 rounded-input object-cover" />
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  aria-label={`作品 ${i + 1} 的 IG 貼文連結（選填）`} placeholder="https://instagram.com/p/…"
                  inputMode="url" value={row.linkUrl} onChange={(e) => setLink(i, e.target.value)} className={input}
                />
                <div className="flex flex-wrap gap-1">
                  <button type="button" className={btn.icon} disabled={i === 0 || pending} onClick={() => move(i, -1)}>
                    <ArrowUp size={18} strokeWidth={1.5} aria-hidden="true" /><span className="sr-only">上移第 {i + 1} 個作品</span>
                  </button>
                  <button type="button" className={btn.icon} disabled={i === rows.length - 1 || pending} onClick={() => move(i, 1)}>
                    <ArrowDown size={18} strokeWidth={1.5} aria-hidden="true" /><span className="sr-only">下移第 {i + 1} 個作品</span>
                  </button>
                  <button type="button" className={`${btn.icon} text-danger hover:bg-danger-soft`} disabled={pending} onClick={() => removeRow(i)}>
                    <Trash2 size={18} strokeWidth={1.5} aria-hidden="true" /><span className="sr-only">刪除第 {i + 1} 個作品</span>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div>
        <FilePicker
          label="新增作品圖片" ariaLabel="上傳作品圖片" accept="image/png,image/jpeg,image/webp"
          busy={busy} disabled={pending || imgSaving || rows.length >= MAX_PORTFOLIO} fileName={null}
          describedBy={msg ? noteId : undefined} invalid={msg ? true : undefined}
          onFiles={(files) => void onFile(files[0])}
        />
        <span className="mt-1.5 block text-xs text-muted">JPG、PNG、WebP，5MB 以內。圖片上傳後會直接儲存；其他還沒儲存的修改（連結、順序、刪除）不受影響。</span>
        {msg && <span id={noteId} role="status" className="mt-1.5 block text-xs text-danger">{msg}</span>}
      </div>
      <input type="hidden" name="items" value={JSON.stringify(rows)} />
      <ErrorText message={error} />
      <div className="flex flex-wrap items-center gap-4">
        <button disabled={pending || busy || imgSaving} className={btn.primary}>{pending ? "儲存中…" : "儲存作品"}</button>
        <SavedMark show={showSaved && !dirty && state.ok === true} />
      </div>
    </form>
  );
}
