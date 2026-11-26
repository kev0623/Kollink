import { HANDLE_RE } from "@/lib/validation/onboarding";

const PROTECTED_PREFIXES = ["/brand", "/creator", "/onboarding", "/admin"];

/** proxy 用：這個路徑是否需要登入。 */
export function requiresAuth(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const AUTH_PAGES = new Set(["/login", "/signup"]);

/**
 * proxy 用：已登入者造訪 /login、/signup 時要導去哪裡（null = 不導）。由 /auth/continue 依身分決定去向（next 在那裡清理）。
 * 網址帶 error 時不導：/auth/continue 讀身分失敗會回 /login?error=profile，再導回去會無限循環。
 */
export function authPageRedirect(pathname: string, params: URLSearchParams): string | null {
  if (!AUTH_PAGES.has(pathname) || params.has("error")) return null;
  const q = new URLSearchParams();
  const role = params.get("role");
  if (pathname === "/signup" && (role === "brand" || role === "creator")) q.set("role", role);
  const next = params.get("next");
  if (next) q.set("next", next);
  const s = q.toString();
  return s ? `/auth/continue?${s}` : "/auth/continue";
}

/** /c/<handle>（只有一段）且 handle 不符合格式：proxy 直接回 404（Suspense 內的 notFound() 只能回 200＋noindex）。 */
export function invalidCreatorPath(pathname: string): boolean {
  const m = /^\/c\/([^/]+)$/.exec(pathname);
  if (!m) return false;
  let h: string;
  try {
    h = decodeURIComponent(m[1]);
  } catch {
    return true;
  }
  return !HANDLE_RE.test(h);
}
