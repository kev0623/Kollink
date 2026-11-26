import { isEmail } from "@/lib/validation/onboarding";
import { LINE_SUB_RE } from "./id-token";

export type PendingLink = { sub: string; email: string; uid: string | null; next: string | null; role: string | null };

/** 解密後的綁定 cookie 內容驗證：格式不對一律 null。 */
export function parsePendingLink(v: Record<string, unknown> | null): PendingLink | null {
  if (!v) return null;
  const { sub, email, uid, next, role } = v;
  if (typeof sub !== "string" || !LINE_SUB_RE.test(sub)) return null;
  if (typeof email !== "string" || email !== email.trim().toLowerCase() || !isEmail(email)) return null;
  return {
    sub, email,
    uid: typeof uid === "string" ? uid : null,
    next: typeof next === "string" ? next : null,
    role: typeof role === "string" ? role : null,
  };
}

/** 給畫面顯示與寄驗證碼用：只取出 Email。 */
export function pendingEmail(v: Record<string, unknown> | null): string | null {
  return parsePendingLink(v)?.email ?? null;
}

export type BindCheck = { ok: true } | { ok: false; reason: "mismatch" };

/** 綁定前確認目前的 session 就是剛用驗證碼登入、擁有這個 Email 的帳號（既有帳號時還要是查詢當下的那一個）。 */
export function checkBindUser(user: { id: string; email?: string | null }, link: PendingLink): BindCheck {
  if ((user.email ?? "").toLowerCase() !== link.email) return { ok: false, reason: "mismatch" };
  if (link.uid && user.id !== link.uid) return { ok: false, reason: "mismatch" };
  return { ok: true };
}
