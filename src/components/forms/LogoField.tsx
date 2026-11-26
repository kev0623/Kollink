"use client";
import { useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { brandLogoUrl } from "@/lib/brand-logo";
import { FilePicker } from "@/components/ui/FilePicker";
import { btn } from "@/components/ui/styles";
import { uploadErrorMessage } from "@/lib/upload-limits";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

type Props = {
  userId: string;
  initialPath: string | null;
  error?: string;
  /** 上傳中為 true；表單用來停用送出按鈕。 */
  onBusyChange?: (busy: boolean) => void;
  /** 表單儲存中為 true：不能換檔、移除，也不會刪除任何檔案（避免儲存途中刪掉正要寫入資料庫的 Logo）。 */
  disabled?: boolean;
};

export function LogoField({ userId, initialPath, error, onBusyChange, disabled }: Props) {
  const [logoPath, setLogoPath] = useState<string | null>(initialPath);
  const url = brandLogoUrl(logoPath);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 這個元件本次上傳、尚未被表單儲存的檔案；initialPath 是資料庫還在引用的，永遠不刪。
  const ownedRef = useRef<string | null>(null);
  const noteId = useId();

  function setBusyState(b: boolean) {
    setBusy(b);
    onBusyChange?.(b);
  }

  function discard(path: string | null) {
    if (disabled || !path || path !== ownedRef.current) return;
    ownedRef.current = null;
    // 盡力刪除，失敗就忽略
    void Promise.resolve(createClient().storage.from("brand-logos").remove([path])).catch(() => {});
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    const ext = TYPES[file.type];
    if (!ext) return setMsg("只接受 PNG、JPG、WebP");
    if (file.size > MAX_BYTES) return setMsg("檔案不能超過 2MB");
    setBusyState(true);
    try {
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: e } = await createClient().storage.from("brand-logos").upload(path, file, { contentType: file.type });
      if (e) return setMsg(uploadErrorMessage(e, "brand-logos"));
      discard(ownedRef.current);
      ownedRef.current = path;
      setLogoPath(path);
    } catch {
      setMsg("上傳失敗，請再試一次");
    } finally {
      setBusyState(false);
    }
  }

  function remove() {
    if (disabled) return;
    discard(logoPath);
    setLogoPath(null);
    setMsg(null);
  }

  const note = msg ?? error;
  return (
    <div>
      <span className="text-sm font-semibold text-ink">Logo（選填）</span>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Logo 預覽" className="h-12 w-12 rounded-input border border-line object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-input border border-dashed border-line" />
        )}
        <FilePicker
          label={logoPath ? "更換圖片" : "選擇圖片"} ariaLabel="上傳 Logo" accept="image/png,image/jpeg,image/webp"
          busy={busy} disabled={disabled} fileName={logoPath ? "已上傳" : null}
          describedBy={note ? noteId : undefined} invalid={note ? true : undefined}
          onFiles={(files) => void onFile(files[0])}
        />
        {url && <button type="button" disabled={busy || disabled} className={btn.ghost} onClick={remove}>移除 Logo</button>}
      </div>
      <input type="hidden" name="logoPath" value={logoPath ?? ""} />
      {msg && <span id={noteId} role="status" className="mt-1 block text-xs text-danger">{msg}</span>}
      {!msg && error && <span id={noteId} className="mt-1 block text-xs text-danger">{error}</span>}
    </div>
  );
}
