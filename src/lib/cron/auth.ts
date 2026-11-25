import { createHash, timingSafeEqual } from "node:crypto";

function digest(v: string): Buffer {
  return createHash("sha256").update(v, "utf8").digest();
}

/**
 * Vercel Cron 會帶 `Authorization: Bearer <CRON_SECRET>`。比較兩邊的 SHA-256（長度固定）再用 timingSafeEqual，
 * 不因內容或長度不同而提早結束。secret 沒設定一律不通過（不能讓「沒設定」等於「不檢查」）。
 */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const given = authorization ?? "";
  return timingSafeEqual(digest(given), digest(`Bearer ${secret}`));
}
