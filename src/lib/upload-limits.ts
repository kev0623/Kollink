// 上傳前的前端檢查與失敗訊息。規則與 storage policy（20261129000100_security_hardening.sql）一致：
// 公開圖片 bucket 只接受 jpg／jpeg／png／webp 副檔名（前端的路徑副檔名由內容類型決定），每位使用者在每個 bucket 有物件數上限；
// 超過上限時 Storage 只回 403（RLS 錯誤），分不出是數量還是檔名，所以前端先自己檢查並在 403 時提示可能的原因。

/** 每位使用者在各 bucket 的物件數上限（deliverables 是每個合作案資料夾）。與資料庫 storage_upload_quota_ok／can_upload_deliverable 一致。 */
export const UPLOAD_QUOTA = {
  "brand-logos": 40,
  "creator-media": 120,
  "brief-covers": 300,
  deliverables: 200,
} as const;

export type UploadBucket = keyof typeof UPLOAD_QUOTA;

type StorageErrorLike = { statusCode?: string | number; status?: string | number; message?: string } | null | undefined;

/** Storage 上傳失敗 → 畫面文字。403（RLS）可能是數量已達上限。 */
export function uploadErrorMessage(error: StorageErrorLike, bucket: UploadBucket): string {
  const code = String(error?.statusCode ?? error?.status ?? "");
  const msg = (error?.message ?? "").toLowerCase();
  if (code === "403" || msg.includes("row-level security") || msg.includes("unauthorized")) {
    const scope = bucket === "deliverables" ? "這個合作案" : "你的帳號";
    return `上傳被拒絕：${scope}的上傳數量可能已達上限（${UPLOAD_QUOTA[bucket]} 個），請聯絡平台協助；若不是數量問題，請確認檔案格式。`;
  }
  return "上傳失敗，請再試一次";
}
