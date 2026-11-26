const PROTECTED_PREFIXES = ["/brand", "/creator", "/onboarding", "/admin"];

/** proxy 用：這個路徑是否需要登入。 */
export function requiresAuth(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
