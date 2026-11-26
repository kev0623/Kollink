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
    return isRole(a.requestedRole) ? `/onboarding/${a.requestedRole}` : "/onboarding";
  }
  const home = homeFor(a.role);
  if (next && PUBLIC_PROFILE_RE.test(next)) return next;
  if (next && (next === home || next.startsWith(`${home}/`) || next.startsWith(`${home}?`))) return next;
  return home;
}
