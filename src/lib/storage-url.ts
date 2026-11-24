/** 資料庫只存 Storage 路徑（<user_id>/<檔名>）；顯示與預覽時才組成公開 bucket 的網址。 */
export function publicObjectUrl(bucket: string, path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${encoded}`;
}
