import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildAuthorizeUrl, exchangeLineCode, resolveLineAccount } from "./flow";

describe("buildAuthorizeUrl", () => {
  it("帶 PKCE S256、state、nonce、openid profile email", () => {
    const u = new URL(buildAuthorizeUrl({ channelId: "1234567890", redirectUri: "https://kollink.vercel.app/auth/line/callback", state: "st", nonce: "no", codeVerifier: "cv" }));
    expect(u.origin + u.pathname).toBe("https://access.line.me/oauth2/v2.1/authorize");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      response_type: "code", client_id: "1234567890", redirect_uri: "https://kollink.vercel.app/auth/line/callback",
      state: "st", scope: "openid profile email", nonce: "no",
      code_challenge: createHash("sha256").update("cv").digest("base64url"), code_challenge_method: "S256",
    });
  });
});

describe("exchangeLineCode", () => {
  const args = { code: "c1", redirectUri: "https://x/auth/line/callback", channelId: "1", channelSecret: "s", codeVerifier: "v" };
  it("成功：回 id_token；送出 redirect_uri、client 資料、code_verifier", async () => {
    const f = vi.fn(async () => Response.json({ id_token: "a.b.c", access_token: "x" }));
    expect(await exchangeLineCode(args, f as unknown as typeof fetch)).toEqual({ idToken: "a.b.c" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.line.me/oauth2/v2.1/token");
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      grant_type: "authorization_code", code: "c1", redirect_uri: args.redirectUri, client_id: "1", client_secret: "s", code_verifier: "v",
    });
  });
  it("失敗：HTTP 錯誤、沒有 id_token、網路錯誤、沒有 code", async () => {
    expect(await exchangeLineCode(args, (async () => new Response("{}", { status: 400 })) as unknown as typeof fetch)).toEqual({ error: "http_400" });
    expect(await exchangeLineCode(args, (async () => Response.json({})) as unknown as typeof fetch)).toEqual({ error: "no_id_token" });
    expect(await exchangeLineCode(args, (async () => { throw new Error("x"); }) as unknown as typeof fetch)).toEqual({ error: "network" });
    expect(await exchangeLineCode({ ...args, code: "" }, vi.fn() as unknown as typeof fetch)).toEqual({ error: "code" });
  });
});

describe("resolveLineAccount", () => {
  it("已綁定：直接登入（就算這次沒有 Email）", () => {
    expect(resolveLineAccount({ linkedUserId: "u1", email: null, emailUserId: null })).toEqual({ kind: "signin", userId: "u1" });
    expect(resolveLineAccount({ linkedUserId: "u1", email: "a@b.co", emailUserId: "u2" })).toEqual({ kind: "signin", userId: "u1" });
  });
  it("沒綁定、沒有 Email：不建立帳號", () => {
    expect(resolveLineAccount({ linkedUserId: null, email: null, emailUserId: null })).toEqual({ kind: "no_email" });
  });
  it("沒綁定、Email 已有帳號：要驗證碼才綁定（不直接登入）", () => {
    expect(resolveLineAccount({ linkedUserId: null, email: "a@b.co", emailUserId: "u2" })).toEqual({ kind: "verify_existing", userId: "u2" });
  });
  it("沒綁定、新 Email：也要驗證碼（防先搶註）", () => {
    expect(resolveLineAccount({ linkedUserId: null, email: "a@b.co", emailUserId: null })).toEqual({ kind: "verify_new" });
  });
});
