"use client";
import { useActionState, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CREATOR_MEDIA_BUCKET, creatorMediaUrl, planMediaUpload } from "@/lib/creator-media";
import { MAX_PORTFOLIO } from "@/lib/validation/creator-profile";
import { inputClass } from "@/components/forms/Field";
import type { FormState } from "@/lib/auth/account-errors";
import type { PortfolioItem } from "@/lib/creators/view";
import { updatePortfolioAction } from "./actions";

type Row = { imagePath: string; linkUrl: string };

const smallBtn = "rounded-btn border border-line bg-surface px-3 py-1 text-sm text-ink hover:bg-primary-soft disabled:opacity-40";

export function PortfolioForm({ userId, initial }: { userId: string; initial: PortfolioItem[] }) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((it) => ({ imagePath: it.imagePath, linkUrl: it.linkUrl ?? "" })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // 本次上傳、尚未儲存的檔案；儲存成功後清空（之後就是資料庫在引用的檔案，不能刪）
  const owned = useRef(new Set<string>());
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await updatePortfolioAction(prev, fd);
    if (result.ok) owned.current.clear();
    return result;
  }, {});
  const headingId = useId();
  const fileId = useId();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    if (rows.length >= MAX_PORTFOLIO) return setMsg(`最多 ${MAX_PORTFOLIO} 張作品`);
    const plan = planMediaUpload(userId, "portfolio", file, crypto.randomUUID());
    if ("error" in plan) return setMsg(plan.error);
    setBusy(true);
    try {
      const { error } = await createClient().storage.from(CREATOR_MEDIA_BUCKET)
        .upload(plan.path, file, { contentType: file.type });
      if (error) return setMsg("上傳失敗，請再試一次");
      owned.current.add(plan.path);
      setRows((r) => [...r, { imagePath: plan.path, linkUrl: "" }]);
    } catch {
      setMsg("上傳失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  }

  function move(i: number, delta: number) {
    setRows((r) => {
      const j = i + delta;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function removeRow(i: number) {
    const path = rows[i].imagePath;
    if (owned.current.has(path)) {
      owned.current.delete(path);
      void Promise.resolve(createClient().storage.from(CREATOR_MEDIA_BUCKET).remove([path])).catch(() => {});
    }
    setRows((r) => r.filter((_, x) => x !== i));
  }

  function setLink(i: number, linkUrl: string) {
    setRows((r) => r.map((row, x) => (x === i ? { ...row, linkUrl } : row)));
  }

  const error = state.fieldErrors?.portfolio ?? state.formError;
  return (
    <form action={action} className="max-w-xl space-y-4 rounded-card border border-line bg-surface p-5 md:p-8">
      <div>
        <h2 id={headingId} className="text-lg font-bold text-ink">作品（最多 {MAX_PORTFOLIO} 張）</h2>
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
                  inputMode="url" value={row.linkUrl} onChange={(e) => setLink(i, e.target.value)} className={inputClass}
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={smallBtn} disabled={i === 0 || pending} onClick={() => move(i, -1)}>上移</button>
                  <button type="button" className={smallBtn} disabled={i === rows.length - 1 || pending} onClick={() => move(i, 1)}>下移</button>
                  <button type="button" className={smallBtn} disabled={pending} onClick={() => removeRow(i)}>刪除</button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div>
        <label htmlFor={fileId} className="text-sm font-semibold text-ink">新增作品</label>
        <input
          id={fileId} type="file" className="mt-1 block w-full" accept="image/png,image/jpeg,image/webp"
          disabled={busy || pending || rows.length >= MAX_PORTFOLIO}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onFile(file);
          }}
        />
        <span className="mt-1 block text-xs text-muted">JPG、PNG、WebP，5MB 以內</span>
      </div>
      <input type="hidden" name="items" value={JSON.stringify(rows)} />
      {msg && <p role="status" className="text-xs text-danger">{msg}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {state.ok && <p role="status" className="text-sm text-success">已儲存</p>}
      <button disabled={pending || busy} className="h-11 w-full rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 md:w-auto">
        儲存作品
      </button>
    </form>
  );
}
