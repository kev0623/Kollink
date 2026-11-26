import { publicObjectUrl } from "./storage-url";
import { hasAllowedImageExtension } from "./upload-limits";

export const CREATOR_MEDIA_BUCKET = "creator-media";
export const CREATOR_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type MediaKind = "avatar" | "portfolio";

export function creatorMediaUrl(path: string | null): string | null {
  return publicObjectUrl(CREATOR_MEDIA_BUCKET, path);
}

/**
 * 上傳前檢查檔案並產生路徑 <userId>/<kind>-<id>.<副檔名>。
 * 規則與 storage policy、資料庫的 check_media_path 一致（id 用 crypto.randomUUID()）。
 */
export function planMediaUpload(
  userId: string, kind: MediaKind, file: { type: string; size: number; name?: string }, id: string,
): { path: string } | { error: string } {
  if (!Object.hasOwn(EXT_BY_TYPE, file.type) || (file.name !== undefined && !hasAllowedImageExtension(file.name))) return { error: "只接受 JPG、PNG、WebP" };
  if (file.size > CREATOR_MEDIA_MAX_BYTES) return { error: "檔案不能超過 5MB" };
  return { path: `${userId}/${kind}-${id}.${EXT_BY_TYPE[file.type]}` };
}
