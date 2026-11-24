"use client";

import { useEffect, useId, useState } from "react";
import { BriefCover } from "@/components/briefs/BriefCover";
import { createClient } from "@/lib/supabase/client";
import { BRIEF_COVER_BUCKET, planCoverUpload } from "@/lib/brief-cover";
import { createCoverOwnership } from "@/lib/cover-ownership";

type Props = {
  userId: string;
  value: string | null;
  onChange: (path: string | null) => void;
  brandName: string;
  brandLogoPath: string | null;
  error?: string;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
  /** 每次儲存成功（原地存成草稿）換一個新值；目前封面此後視為已存進資料庫，不會被刪。 */
  savedMark?: unknown;
};

/**
 * 招募封面（選填）。上傳到 brief-covers/<uid>/cover-<uuid>.<副檔名>；沒有封面時預覽顯示品牌 Logo。
 * 只刪除這次畫面上傳、尚未儲存就被換掉的檔案；已存進資料庫的封面（含原地存成草稿後）不刪（孤兒檔由排程清理，見 followups）。
 */
export function CoverField({ userId, value, onChange, brandName, brandLogoPath, error, onBusyChange, disabled, savedMark }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ownership] = useState(() => createCoverOwnership((p) => {
    void Promise.resolve(createClient().storage.from(BRIEF_COVER_BUCKET).remove([p])).catch(() => {});
  }));
  const noteId = useId();

  function setBusyState(b: boolean) {
    setBusy(b);
    onBusyChange?.(b);
  }

  useEffect(() => {
    if (savedMark) ownership.markPersisted();
  }, [savedMark, ownership]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    const plan = planCoverUpload(userId, file, crypto.randomUUID());
    if ("error" in plan) return setMsg(plan.error);
    setBusyState(true);
    try {
      const { error: e } = await createClient().storage.from(BRIEF_COVER_BUCKET)
        .upload(plan.path, file, { contentType: file.type });
      if (e) return setMsg("上傳失敗，請再試一次");
      ownership.adopt(plan.path);
      onChange(plan.path);
    } catch {
      setMsg("上傳失敗，請再試一次");
    } finally {
      setBusyState(false);
    }
  }

  function remove() {
    if (disabled) return;
    ownership.discard(value);
    onChange(null);
    setMsg(null);
  }

  const note = msg ?? error;
  return (
    <div>
      <span className="text-sm font-semibold text-ink">封面圖（選填）</span>
      <div className="mt-1 max-w-sm overflow-hidden rounded-card border border-line">
        <BriefCover coverPath={value} brandName={brandName} brandLogoPath={brandLogoPath} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          type="file" className="min-w-0 flex-1" accept="image/png,image/jpeg,image/webp" disabled={busy || disabled}
          aria-label="上傳封面圖" aria-describedby={note ? noteId : undefined} aria-invalid={note ? true : undefined}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onFile(file);
          }}
        />
        {value && <button type="button" disabled={busy || disabled} className="text-sm text-muted" onClick={remove}>移除封面</button>}
      </div>
      <input type="hidden" name="coverPath" value={value ?? ""} />
      {note && <span id={noteId} role={msg ? "status" : undefined} className="mt-1 block text-xs text-danger">{note}</span>}
      <span className="mt-1 block text-xs text-muted">JPG、PNG、WebP，5MB 以內；沒有封面時顯示品牌 Logo</span>
    </div>
  );
}
