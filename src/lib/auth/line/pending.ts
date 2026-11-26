import { cleanText, isEmail } from "@/lib/validation/onboarding";
import { LINE_SUB_RE } from "./id-token";

export type PendingLink = { sub: string; email: string; name: string | null; uid: string | null; next: string | null; role: string | null };

export const LINE_NAME_MAX = 40;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;

/** LINE 顯示名稱：只用來在驗證碼畫面顯示（純文字，不存資料庫）。去掉控制與雙向字元、頭尾空白，最多 40 個字。 */
export function cleanLineName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const cleaned = cleanText(v.slice(0, 400).replace(CONTROL_OR_BIDI, "")).trim();
  const cps = Array.from(cleaned).slice(0, LINE_NAME_MAX).join("").trim();
  return cps || null;
}

/** 解密後的綁定 cookie 內容驗證：格式不對一律 null。 */
export function parsePendingLink(v: Record<string, unknown> | null): PendingLink | null {
  if (!v) return null;
  const { sub, email, name, uid, next, role } = v;
  if (typeof sub !== "string" || !LINE_SUB_RE.test(sub)) return null;
  if (typeof email !== "string" || email !== email.trim().toLowerCase() || !isEmail(email)) return null;
  return {
    sub, email, name: cleanLineName(name),
    uid: typeof uid === "string" ? uid : null,
    next: typeof next === "string" ? next : null,
    role: typeof role === "string" ? role : null,
  };
}

/** 給畫面顯示與寄驗證碼用：只取出 Email 與 LINE 顯示名稱（不含 LINE ID、帳號 id）。 */
export function pendingView(v: Record<string, unknown> | null): { email: string; name: string | null } | null {
  const link = parsePendingLink(v);
  return link ? { email: link.email, name: link.name } : null;
}

export type BindCheck = { ok: true } | { ok: false; reason: "mismatch" };

/** 綁定前確認目前的 session 就是剛用驗證碼登入、擁有這個 Email 的帳號（既有帳號時還要是查詢當下的那一個）。 */
export function checkBindUser(user: { id: string; email?: string | null }, link: PendingLink): BindCheck {
  if ((user.email ?? "").toLowerCase() !== link.email) return { ok: false, reason: "mismatch" };
  if (link.uid && user.id !== link.uid) return { ok: false, reason: "mismatch" };
  return { ok: true };
}
