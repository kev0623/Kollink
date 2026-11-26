import { describe, expect, it } from "vitest";
import { checkBindUser, parsePendingLink, pendingEmail } from "./pending";
import { TEST_SUB } from "./test-helpers";

const base = { sub: TEST_SUB, email: "me@example.com", uid: "u1", next: "/brand", role: "brand", p: "link", exp: 1 };

describe("parsePendingLink／pendingEmail", () => {
  it("合法內容", () => {
    expect(parsePendingLink(base)).toEqual({ sub: TEST_SUB, email: "me@example.com", uid: "u1", next: "/brand", role: "brand" });
    expect(pendingEmail(base)).toBe("me@example.com");
  });
  it("格式不對一律 null", () => {
    expect(parsePendingLink(null)).toBeNull();
    expect(parsePendingLink({ ...base, sub: "U1" })).toBeNull();
    expect(parsePendingLink({ ...base, email: "Me@Example.com" })).toBeNull();
    expect(parsePendingLink({ ...base, email: "nope" })).toBeNull();
    expect(pendingEmail({ ...base, email: 3 })).toBeNull();
  });
  it("uid／next／role 不是字串時是 null", () => {
    expect(parsePendingLink({ ...base, uid: 1, next: null, role: undefined })).toMatchObject({ uid: null, next: null, role: null });
  });
});

describe("checkBindUser", () => {
  const link = parsePendingLink(base)!;
  it("同一個 Email（不分大小寫）且是查詢當下的帳號", () => {
    expect(checkBindUser({ id: "u1", email: "ME@example.com" }, link)).toEqual({ ok: true });
  });
  it("Email 不同、沒有 Email、uid 不符：mismatch", () => {
    expect(checkBindUser({ id: "u1", email: "other@example.com" }, link)).toEqual({ ok: false, reason: "mismatch" });
    expect(checkBindUser({ id: "u1", email: null }, link)).toEqual({ ok: false, reason: "mismatch" });
    expect(checkBindUser({ id: "u2", email: "me@example.com" }, link)).toEqual({ ok: false, reason: "mismatch" });
  });
  it("新帳號（沒有 uid）：只比對 Email", () => {
    expect(checkBindUser({ id: "anything", email: "me@example.com" }, { ...link, uid: null })).toEqual({ ok: true });
  });
});
