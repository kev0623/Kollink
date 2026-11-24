import { creatorMediaUrl } from "@/lib/creator-media";

const OG_AVATAR_TYPES = new Set(["image/png", "image/jpeg"]);
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * OG 圖片用的頭像：伺服器自己抓 Storage 的公開檔案，轉成 data URI。
 * ImageResponse 會擋 localhost／私有 IP 的網址，webp 也不保證能畫，所以只接受 PNG／JPEG；失敗一律回傳 null（改顯示名字首字）。
 */
export async function avatarDataUri(path: string | null, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!path || !/\.(png|jpe?g)$/i.test(path)) return null;
  const url = creatorMediaUrl(path);
  if (!url) return null;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(3000) });
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!res.ok || !OG_AVATAR_TYPES.has(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
