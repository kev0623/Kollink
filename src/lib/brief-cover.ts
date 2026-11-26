import { publicObjectUrl } from "./storage-url";
import { hasAllowedImageExtension } from "./upload-limits";

export const BRIEF_COVER_BUCKET = "brief-covers";
export const BRIEF_COVER_MAX_BYTES = 5 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function briefCoverUrl(path: string | null): string | null {
  return publicObjectUrl(BRIEF_COVER_BUCKET, path);
}

/**
 * 上傳前檢查檔案並產生路徑 <userId>/cover-<id>.<副檔名>。
 * 規則與 storage policy（20261124000600_brief_covers.sql）、briefs.cover_path 的 CHECK 一致（id 用 crypto.randomUUID()）。
 */
export function planCoverUpload(
  userId: string, file: { type: string; size: number; name?: string }, id: string,
): { path: string } | { error: string } {
  if (!Object.hasOwn(EXT_BY_TYPE, file.type) || (file.name !== undefined && !hasAllowedImageExtension(file.name))) return { error: "只接受 JPG、PNG、WebP" };
  if (file.size > BRIEF_COVER_MAX_BYTES) return { error: "檔案不能超過 5MB" };
  return { path: `${userId}/cover-${id}.${EXT_BY_TYPE[file.type]}` };
}
