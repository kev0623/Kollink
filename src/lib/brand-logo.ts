import { publicObjectUrl } from "./storage-url";

/** 資料庫只存 Logo 的 Storage 路徑（<user_id>/<檔名>）；顯示與預覽時才組成公開網址。 */
export function brandLogoUrl(path: string | null): string | null {
  return publicObjectUrl("brand-logos", path);
}
