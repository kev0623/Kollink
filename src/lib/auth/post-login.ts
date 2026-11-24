import { safeNextPath } from "./safe-next";

export type Role = "brand" | "creator";

export function isRole(v: unknown): v is Role {
  return v === "brand" || v === "creator";
}

export function homeFor(role: Role): "/brand" | "/creator" {
  return role === "brand" ? "/brand" : "/creator";
}

/** 登入後要去哪裡。規則見 docs/superpowers/specs/2026-11-23-auth-design.md 第 1 節。 */
export function resolvePostLoginPath(a: { role: Role | null; requestedRole: string | null; next: string | null }): string {
  if (!a.role) return isRole(a.requestedRole) ? `/onboarding/${a.requestedRole}` : "/onboarding";
  const home = homeFor(a.role);
  const next = safeNextPath(a.next);
  if (next && (next === home || next.startsWith(`${home}/`) || next.startsWith(`${home}?`))) return next;
  return home;
}
