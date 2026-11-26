// 只給測試用：產生 LINE 風格的 HS256 ID token。
import { createHmac } from "node:crypto";

export const TEST_CHANNEL_ID = "1234567890";
export const TEST_CHANNEL_SECRET = "0123456789abcdef0123456789abcdef";
export const TEST_SUB = "U0123456789abcdef0123456789abcdef";

const b64 = (v: unknown) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

export function makeIdToken(
  payload: Record<string, unknown>,
  { secret = TEST_CHANNEL_SECRET, header = { typ: "JWT", alg: "HS256" } as Record<string, unknown> } = {},
): string {
  const head = `${b64(header)}.${b64(payload)}`;
  return `${head}.${createHmac("sha256", secret).update(head).digest("base64url")}`;
}

export function claims(nowSec: number, nonce: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: "https://access.line.me", sub: TEST_SUB, aud: TEST_CHANNEL_ID, exp: nowSec + 3600, iat: nowSec,
    nonce, amr: ["pwd"], name: "測試", email: "Someone@Example.com", ...extra,
  };
}
