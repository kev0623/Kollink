import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

// LINE 暫存 cookie：AES-256-GCM 加密＋驗證（使用者看不到內容、改了就失效），金鑰由 Channel secret 以 HKDF 導出。
// purpose 同時寫在內容與 AAD：登入流程的 cookie 不能拿來當綁定 cookie 用，反之亦然。

export type Purpose = "flow" | "link";

function key(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.from("kollink-line-cookie"), Buffer.from("v1"), 32));
}

export function seal(purpose: Purpose, payload: Record<string, unknown>, secret: string, expSec: number): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(purpose));
  const body = Buffer.concat([cipher.update(JSON.stringify({ ...payload, p: purpose, exp: expSec }), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** 解不開、purpose 不對、過期一律回 null。 */
export function unseal<T extends Record<string, unknown>>(value: string | undefined, purpose: Purpose, secret: string, nowSec: number): T | null {
  if (!value || value.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const raw = Buffer.from(value, "base64url");
    if (raw.length < 12 + 16 + 2) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(raw.subarray(12, 28));
    const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    const data = JSON.parse(json) as Record<string, unknown>;
    if (data.p !== purpose || typeof data.exp !== "number" || data.exp <= nowSec) return null;
    return data as T;
  } catch {
    return null;
  }
}

/** 固定時間比較兩個字串（長度不同直接 false）。 */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** state、nonce、PKCE code_verifier 用的亂數（32 bytes → 43 字元 base64url）。 */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}
