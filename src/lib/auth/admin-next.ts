import { safeNextPath } from "./safe-next";

/**
 * proxy.ts 把「這次請求的站內路徑」放進這個請求標頭，requireAdmin() 讀它決定 /admin/mfa 驗證後要回哪一頁。
 * proxy 一律覆寫，用戶端自己帶的值不會被採用；而且讀出來後一樣經過 adminNextPath 檢查。
 */
export const REQUEST_PATH_HEADER = "x-kollink-path";

/** 請求網址 → 站內路徑（pathname + search），去掉 RSC 用的 _rsc 參數。 */
export function requestPath(url: URL): string {
  const params = new URLSearchParams(url.search);
  params.delete("_rsc");
  const q = params.toString();
  return q ? `${url.pathname}?${q}` : url.pathname;
}

/** 管理員第二步驟驗證完要回去的頁面：必須通過 safeNextPath，且是 /admin 底下（不含 /admin/mfa 本身）；否則 null。 */
export function adminNextPath(input: string | null | undefined): string | null {
  const p = safeNextPath(input);
  if (!p) return null;
  const pathname = p.split(/[?#]/)[0];
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return null;
  if (pathname === "/admin/mfa" || pathname.startsWith("/admin/mfa/")) return null;
  return p;
}

/** requireAdmin 要導去的第二步驟頁：帶上合法的 next（/admin 本身不用帶）。 */
export function mfaRedirectPath(from: string | null | undefined): string {
  const next = adminNextPath(from);
  return next && next !== "/admin" ? `/admin/mfa?next=${encodeURIComponent(next)}` : "/admin/mfa";
}
