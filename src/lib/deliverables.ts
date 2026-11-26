// 交稿檔案（私密 bucket deliverables）。路徑規則與 20261125000200_deliverables.sql 的 deliverable_path_ok 相同：
// <collab_id>/<creator_id>/<uuid>.<jpg|png|webp|mp4|mov|pdf>
export const DELIVERABLES_BUCKET = "deliverables";
export const DELIVERABLE_MAX_BYTES = 50 * 1024 * 1024;
export const MAX_DELIVERABLE_FILES = 10;
export const SIGNED_URL_SECONDS = 3600;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
};

/** <input type="file" accept> 用。 */
export const DELIVERABLE_ACCEPT = Object.keys(EXT_BY_TYPE).join(",");

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const NAME_RE = new RegExp(`^${UUID}\\.(jpg|png|webp|mp4|mov|pdf)$`);

/** 上傳前檢查檔案並產生路徑（id 用 crypto.randomUUID()）。 */
export function planDeliverableUpload(
  collabId: string, uid: string, file: { type: string; size: number }, id: string,
): { path: string } | { error: string } {
  if (!Object.hasOwn(EXT_BY_TYPE, file.type)) return { error: "只接受 JPG、PNG、WebP、MP4、MOV、PDF" };
  if (file.size > DELIVERABLE_MAX_BYTES) return { error: "每個檔案不能超過 50MB" };
  return { path: `${collabId}/${uid}/${id.toLowerCase()}.${EXT_BY_TYPE[file.type]}` };
}

/** 路徑是否在這個合作案、這位創作者的資料夾，而且檔名合規。 */
export function isOwnDeliverablePath(collabId: string, uid: string, path: string): boolean {
  const prefix = `${collabId}/${uid}/`;
  return path.startsWith(prefix) && NAME_RE.test(path.slice(prefix.length));
}

export type FileKind = "image" | "video" | "pdf";

export function fileKindOf(path: string): FileKind {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "mp4" || ext === "mov") return "video";
  return "image";
}

const KIND_LABEL: Record<FileKind, string> = { image: "圖片", video: "影片", pdf: "PDF" };

/** 檔案的名稱（圖片 alt、連結名稱）：「第 n 次交稿・種類 序號」（index 從 0 起算）。 */
export function fileLabel(path: string, index: number, round: number): string {
  return `第 ${round} 次交稿・${KIND_LABEL[fileKindOf(path)]} ${index + 1}`;
}
