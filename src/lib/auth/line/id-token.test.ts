import { describe, expect, it } from "vitest";
import { verifyLineIdToken } from "./id-token";
import { claims, makeIdToken, TEST_CHANNEL_ID, TEST_CHANNEL_SECRET, TEST_SUB } from "./test-helpers";

const NOW = 1_800_000_000;
const NONCE = "n-0123456789";
const opts = { channelId: TEST_CHANNEL_ID, channelSecret: TEST_CHANNEL_SECRET, nonce: NONCE, nowSec: NOW };
const verify = (token: string) => verifyLineIdToken(token, opts);

describe("verifyLineIdToken", () => {
  it("合法：回傳 sub 與小寫的 Email", () => {
    expect(verify(makeIdToken(claims(NOW, NONCE)))).toEqual({ ok: true, claims: { sub: TEST_SUB, email: "someone@example.com", name: "測試" } });
    expect(verify(makeIdToken(claims(NOW, NONCE, { name: 7 })))).toMatchObject({ ok: true, claims: { name: null } });
  });
  it("沒有 Email 或格式不對：email 是 null", () => {
    expect(verify(makeIdToken(claims(NOW, NONCE, { email: undefined })))).toEqual({ ok: true, claims: { sub: TEST_SUB, email: null, name: "測試" } });
    expect(verify(makeIdToken(claims(NOW, NONCE, { email: "not-an-email" })))).toMatchObject({ ok: true, claims: { email: null } });
    expect(verify(makeIdToken(claims(NOW, NONCE, { email: 42 })))).toMatchObject({ ok: true, claims: { email: null } });
  });
  it("簽章錯誤（別的密鑰）", () => {
    expect(verify(makeIdToken(claims(NOW, NONCE), { secret: "ffffffffffffffffffffffffffffffff" }))).toEqual({ ok: false, reason: "signature" });
  });
  it("內容被改過（簽章對不上）", () => {
    const [h, , s] = makeIdToken(claims(NOW, NONCE)).split(".");
    const forged = Buffer.from(JSON.stringify(claims(NOW, NONCE, { sub: "Uffffffffffffffffffffffffffffffff" }))).toString("base64url");
    expect(verify(`${h}.${forged}.${s}`)).toEqual({ ok: false, reason: "signature" });
  });
  it("alg none（沒有簽章）", () => {
    const head = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(claims(NOW, NONCE))).toString("base64url");
    expect(verify(`${head}.${body}.`)).toEqual({ ok: false, reason: "format" });
    expect(verify(`${head}.${body}.AAAA`)).toEqual({ ok: false, reason: "alg" });
  });
  it.each(["RS256", "ES256", "HS512", "hs256"])("不是 HS256（%s）", (alg) => {
    expect(verify(makeIdToken(claims(NOW, NONCE), { header: { alg } }))).toEqual({ ok: false, reason: "alg" });
  });
  it("iss 不對", () => {
    expect(verify(makeIdToken(claims(NOW, NONCE, { iss: "https://evil.example" })))).toEqual({ ok: false, reason: "iss" });
  });
  it("aud 不是這個頻道（別的頻道的 token）", () => {
    expect(verify(makeIdToken(claims(NOW, NONCE, { aud: "9999999999" })))).toEqual({ ok: false, reason: "aud" });
    expect(verify(makeIdToken(claims(NOW, NONCE, { aud: [TEST_CHANNEL_ID] })))).toEqual({ ok: false, reason: "aud" });
  });
  it("過期（超過 60 秒容許誤差）", () => {
    expect(verify(makeIdToken(claims(NOW, NONCE, { exp: NOW - 61 })))).toEqual({ ok: false, reason: "exp" });
    expect(verify(makeIdToken(claims(NOW, NONCE, { exp: NOW - 30 })))).toMatchObject({ ok: true });
    expect(verify(makeIdToken(claims(NOW, NONCE, { exp: "soon" })))).toEqual({ ok: false, reason: "exp" });
  });
  it("iat 在未來或太舊", () => {
    expect(verify(makeIdToken(claims(NOW, NONCE, { iat: NOW + 120 })))).toEqual({ ok: false, reason: "iat" });
    expect(verify(makeIdToken(claims(NOW, NONCE, { iat: NOW - 601 })))).toEqual({ ok: false, reason: "iat" });
  });
  it("nonce 不符或沒有", () => {
    expect(verify(makeIdToken(claims(NOW, "other")))).toEqual({ ok: false, reason: "nonce" });
    expect(verify(makeIdToken(claims(NOW, NONCE, { nonce: undefined })))).toEqual({ ok: false, reason: "nonce" });
  });
  it("sub 格式不對", () => {
    expect(verify(makeIdToken(claims(NOW, NONCE, { sub: "U123" })))).toEqual({ ok: false, reason: "sub" });
  });
  it("格式不對", () => {
    expect(verify("abc")).toEqual({ ok: false, reason: "format" });
    expect(verify("a.b.c.d")).toEqual({ ok: false, reason: "format" });
    expect(verify("e30.e30.***")).toEqual({ ok: false, reason: "format" });
    expect(verify("x".repeat(9000))).toEqual({ ok: false, reason: "format" });
  });
});
