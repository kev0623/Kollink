"use client";
import { useId, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { brandLogoUrl } from "@/lib/brand-logo";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

type Props = {
  userId: string;
  initialPath: string | null;
  error?: string;
  /** 上傳中為 true；表單用來停用送出按鈕。 */
  onBusyChange?: (busy: boolean) => void;
};

export function LogoField({ userId, initialPath, error, onBusyChange }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [logoPath, setLogoPath] = useState<string | null>(initialPath);
  const url = brandLogoUrl(logoPath);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // 這個元件本次上傳、尚未被表單儲存的檔案；initialPath 是資料庫還在引用的，永遠不刪。
  const ownedRef = useRef<string | null>(null);
  const noteId = useId();

  function setBusyState(b: boolean) {
    setBusy(b);
    onBusyChange?.(b);
  }

  function discard(path: string | null) {
    if (!path || path !== ownedRef.current) return;
    ownedRef.current = null;
    // 盡力刪除，失敗就忽略
    void Promise.resolve(supabase.storage.from("brand-logos").remove([path])).catch(() => {});
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
      const { error: e } = await supabase.storage.from("brand-logos").upload(path, file, { contentType: file.type });
      if (e) return setMsg("上傳失敗，請再試一次");
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
    discard(logoPath);
    setLogoPath(null);
    setMsg(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const note = msg ?? error;
  return (
    <div>
      <span className="text-sm font-bold">Logo（選填）</span>
      <div className="mt-1 flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Logo 預覽" className="h-12 w-12 rounded-btn border border-line object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-btn border border-dashed border-line" />
        )}
        <input
          ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
          aria-label="品牌 Logo" aria-describedby={note ? noteId : undefined} aria-invalid={note ? true : undefined}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // 讓同一個檔案可以再選一次
            void onFile(file);
          }}
        />
        {url && <button type="button" disabled={busy} className="text-sm text-muted" onClick={remove}>移除 Logo</button>}
      </div>
      <input type="hidden" name="logoPath" value={logoPath ?? ""} />
      {msg && <span id={noteId} role="status" className="mt-1 block text-xs text-primary">{msg}</span>}
      {!msg && error && <span id={noteId} className="mt-1 block text-xs text-primary">{error}</span>}
    </div>
  );
}
