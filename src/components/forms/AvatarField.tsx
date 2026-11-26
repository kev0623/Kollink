"use client";
import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FilePicker } from "@/components/ui/FilePicker";
import { btn } from "@/components/ui/styles";
import { uploadErrorMessage } from "@/lib/upload-limits";
import { CREATOR_MEDIA_BUCKET, creatorMediaUrl, planMediaUpload } from "@/lib/creator-media";
import { initialOf } from "@/lib/format";

type Props = {
  userId: string;
  /** 沒有頭像時顯示名字第一個字。 */
  name: string;
  initialPath: string | null;
  error?: string;
  /** 上傳中為 true；表單用來停用送出按鈕。 */
  onBusyChange?: (busy: boolean) => void;
  /** 表單儲存中為 true：不能換檔、移除，也不會刪除任何檔案。 */
  disabled?: boolean;
  /** 路徑變了（上傳成功／移除）。 */
  onPathChange?: (path: string | null) => void;
  /** 上傳成功、路徑已更新之後（頁面據此「上傳即儲存」）。 */
  onUploaded?: (path: string) => void;
  /** 使用者動了這個欄位（選檔、移除）：頁面據此隱藏「已儲存」。 */
  onTouch?: () => void;
  /** 每次儲存成功加一：之後這個頭像就是資料庫在引用的檔案，換檔時不能再刪它。 */
  savedCount?: number;
};

export function AvatarField({ userId, name, initialPath, error, onBusyChange, disabled, onPathChange, onUploaded, onTouch, savedCount }: Props) {
  const [path, setPath] = useState<string | null>(initialPath);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ownedRef = useRef<string | null>(null);
  const noteId = useId();
  const url = creatorMediaUrl(path);

  useEffect(() => { ownedRef.current = null; }, [savedCount]);

  function setBusyState(b: boolean) {
    setBusy(b);
    onBusyChange?.(b);
  }

  function discard(p: string | null) {
    if (disabled || !p || p !== ownedRef.current) return;
    ownedRef.current = null;
    // 盡力刪除，失敗就忽略（孤兒檔由排程清理，見 followups）
    void Promise.resolve(createClient().storage.from(CREATOR_MEDIA_BUCKET).remove([p])).catch(() => {});
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    onTouch?.();
    const plan = planMediaUpload(userId, "avatar", file, crypto.randomUUID());
    if ("error" in plan) return setMsg(plan.error);
    setBusyState(true);
    try {
      const { error: e } = await createClient().storage.from(CREATOR_MEDIA_BUCKET)
        .upload(plan.path, file, { contentType: file.type });
      if (e) return setMsg(uploadErrorMessage(e, "creator-media"));
      discard(ownedRef.current);
      ownedRef.current = plan.path;
      setPath(plan.path);
      onPathChange?.(plan.path);
      onUploaded?.(plan.path);
    } catch {
      setMsg("上傳失敗，請再試一次");
    } finally {
      setBusyState(false);
    }
  }

  function remove() {
    if (disabled) return;
    discard(path);
    setPath(null);
    setMsg(null);
    onPathChange?.(null);
    onTouch?.();
  }

  const note = msg ?? error;
  return (
    <div>
      <span className="text-sm font-bold text-ink">頭像（選填）</span>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="頭像預覽" className="h-16 w-16 rounded-full border border-line object-cover" />
        ) : (
          <div aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-subtle text-2xl font-semibold text-ink">
            {initialOf(name)}
          </div>
        )}
        <FilePicker
          label={path ? "更換圖片" : "選擇圖片"} ariaLabel="上傳頭像" accept="image/png,image/jpeg,image/webp"
          busy={busy} disabled={disabled} fileName={path ? "已上傳" : null}
          describedBy={note ? noteId : undefined} invalid={note ? true : undefined}
          onFiles={(files) => void onFile(files[0])}
        />
        {path && <button type="button" disabled={busy || disabled} className={btn.ghost} onClick={remove}>移除頭像</button>}
      </div>
      <input type="hidden" name="avatarPath" value={path ?? ""} />
      {note && <span id={noteId} role={msg ? "status" : undefined} className="mt-1.5 flex items-start gap-1 text-xs text-danger"><AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0" /><span>{note}</span></span>}
      <span className="mt-1 block text-xs text-muted">JPG、PNG、WebP，5MB 以內</span>
    </div>
  );
}
