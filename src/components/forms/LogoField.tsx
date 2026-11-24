"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { brandLogoUrl } from "@/lib/brand-logo";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export function LogoField({ userId, initialPath, error }: { userId: string; initialPath: string | null; error?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [logoPath, setLogoPath] = useState<string | null>(initialPath);
  const url = brandLogoUrl(logoPath);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    const ext = TYPES[file.type];
    if (!ext) return setMsg("只接受 PNG、JPG、WebP");
    if (file.size > MAX_BYTES) return setMsg("檔案不能超過 2MB");
    setBusy(true);
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: e } = await supabase.storage.from("brand-logos").upload(path, file, { contentType: file.type });
    setBusy(false);
    if (e) return setMsg("上傳失敗，請再試一次");
    setLogoPath(path);
  }

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
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => void onFile(e.target.files?.[0])} />
        {url && <button type="button" className="text-sm text-muted" onClick={() => setLogoPath(null)}>移除</button>}
      </div>
      <input type="hidden" name="logoPath" value={logoPath ?? ""} />
      {(msg || error) && <span role="alert" className="mt-1 block text-xs text-primary">{msg ?? error}</span>}
    </div>
  );
}
