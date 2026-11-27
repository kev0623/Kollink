import { safeNextPath } from "./safe-next";

export type Role = "brand" | "creator";

export function isRole(v: unknown): v is Role {
  return v === "brand" || v === "creator";
}

export function homeFor(role: Role): "/brand" | "/creator" {
  return role === "brand" ? "/brand" : "/creator";
}

/** 創作者公開頁：任何身分登入後都可以回到這裡（例如品牌從報價鎖定區塊登入）。 */
const PUBLIC_PROFILE_RE = /^\/c\/[a-z0-9_.]{3,30}$/;

/**
 * 登入後要去哪裡。規則見 docs/superpowers/specs/2026-11-23-auth-design.md 第 1 節；/c/<handle> 見計畫 3。
 * 管理員（計畫 9）：next 在 /admin 底下就採用；沒有 profile 的管理員帳號一律到 /admin（不進填資料頁）。
 */
export function resolvePostLoginPath(a: {
  role: Role | null; requestedRole: string | null; next: string | null; isAdmin?: boolean;
}): string {
  const next = safeNextPath(a.next);
  if (a.isAdmin && next && (next === "/admin" || next.startsWith("/admin/") || next.startsWith("/admin?"))) return next;
  if (!a.role) {
    if (a.isAdmin) return "/admin";
    return onboardingPath(a.requestedRole, next);
  }
  const home = homeFor(a.role);
  if (next && PUBLIC_PROFILE_RE.test(next)) return next;
  if (next && (next === home || next.startsWith(`${home}/`) || next.startsWith(`${home}?`))) return next;
  return home;
}

/** 某個身分填完資料後，next 會不會被採用（公開頁，或該身分後台首頁以外的頁面）。 */
function keptAfterOnboarding(role: Role, next: string): boolean {
  return next !== homeFor(role) && resolvePostLoginPath({ role, requestedRole: null, next }) === next;
}

/**
 * 還沒有帳號資料的人要去的填資料頁。原本要去的地方（next）一路帶著，填完才回得去
 * （例如品牌從創作者公開頁的報價鎖定區塊註冊）。只帶填完後真的會採用的 next：
 * 已選身分就依該身分判斷，還沒選就看任一身分是否會採用，最後由 afterOnboardingPath 再檢查一次。
 */
export function onboardingPath(requestedRole: string | null | undefined, next: string | null | undefined): string {
  const base = isRole(requestedRole) ? `/onboarding/${requestedRole}` : "/onboarding";
  const safe = safeNextPath(next);
  if (!safe) return base;
  const kept = isRole(requestedRole)
    ? keptAfterOnboarding(requestedRole, safe)
    : keptAfterOnboarding("brand", safe) || keptAfterOnboarding("creator", safe);
  return kept ? `${base}?next=${encodeURIComponent(safe)}` : base;
}

/** 填完資料後要去哪裡：next 合法且屬於這個身分看得到的範圍就回去，否則到該身分的首頁。 */
export function afterOnboardingPath(role: Role, next: string | null | undefined): string {
  return resolvePostLoginPath({ role, requestedRole: null, next: next ?? null });
}

/** 管理員帳號還沒通過第二步驟（TOTP）時，要去後台的路徑先繞到 /admin/mfa，驗證完再回原本的頁面。 */
export function withMfaStep(path: string, needsMfa: boolean): string {
  if (!needsMfa) return path;
  if (path === "/admin/mfa" || path.startsWith("/admin/mfa?")) return path;
  if (path === "/admin" || path.startsWith("/admin/") || path.startsWith("/admin?")) {
    return path === "/admin" ? "/admin/mfa" : `/admin/mfa?next=${encodeURIComponent(path)}`;
  }
  return path;
}
