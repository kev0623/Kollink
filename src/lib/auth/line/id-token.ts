import { createHmac, timingSafeEqual } from "node:crypto";
import { isEmail } from "@/lib/validation/onboarding";
import { LINE_ISSUER } from "./config";
import { safeEqual } from "./sealed-cookie";

// LINE 網頁登入的 ID token 以 Channel secret 做 HS256 簽章（https://developers.line.biz/en/docs/line-login/verify-id-token/）。
// 我們自己驗：只接受 HS256、驗簽用固定時間比較、iss／aud／exp／iat／nonce 全部檢查。
// 不呼叫 LINE 的 /verify 端點：token 是剛從 LINE token 端點（TLS、伺服器對伺服器）拿到的，本地驗證不多一次網路往返，也能完整單元測試。

export type LineClaims = { sub: string; email: string | null; name: string | null };
export type VerifyFailure = "format" | "alg" | "signature" | "iss" | "aud" | "exp" | "iat" | "nonce" | "sub";
export type VerifyResult = { ok: true; claims: LineClaims } | { ok: false; reason: VerifyFailure };

export const LINE_SUB_RE = /^U[0-9a-f]{32}$/;

function decodeJson(part: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function verifyLineIdToken(
  token: string,
  opts: { channelId: string; channelSecret: string; nonce: string; nowSec: number; skewSec?: number; maxAgeSec?: number },
): VerifyResult {
  const skew = opts.skewSec ?? 60;
  const maxAge = opts.maxAgeSec ?? 600;
  if (typeof token !== "string" || token.length > 8192) return { ok: false, reason: "format" };
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return { ok: false, reason: "format" };
  const header = decodeJson(parts[0]);
  if (!header) return { ok: false, reason: "format" };
  // 只接受 HS256：none、RS256／ES256（金鑰混淆）等一律拒絕
  if (header.alg !== "HS256") return { ok: false, reason: "alg" };

  const expected = createHmac("sha256", opts.channelSecret).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "signature" };

  const c = decodeJson(parts[1]);
  if (!c) return { ok: false, reason: "format" };
  if (c.iss !== LINE_ISSUER) return { ok: false, reason: "iss" };
  if (c.aud !== opts.channelId) return { ok: false, reason: "aud" };
  if (typeof c.exp !== "number" || c.exp <= opts.nowSec - skew) return { ok: false, reason: "exp" };
  if (typeof c.iat !== "number" || c.iat > opts.nowSec + skew || c.iat < opts.nowSec - maxAge) return { ok: false, reason: "iat" };
  if (typeof c.nonce !== "string" || !safeEqual(c.nonce, opts.nonce)) return { ok: false, reason: "nonce" };
  if (typeof c.sub !== "string" || !LINE_SUB_RE.test(c.sub)) return { ok: false, reason: "sub" };

  const rawEmail = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
  // name 只原樣傳出（字串才取）；清理在 cleanLineName（存進 cookie 前）
  return { ok: true, claims: { sub: c.sub, email: rawEmail && isEmail(rawEmail) ? rawEmail : null, name: typeof c.name === "string" ? c.name : null } };
}
