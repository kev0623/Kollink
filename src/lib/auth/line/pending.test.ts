import { describe, expect, it } from "vitest";
import { checkBindUser, cleanLineName, parsePendingLink, pendingView } from "./pending";
import { TEST_SUB } from "./test-helpers";

const base = { sub: TEST_SUB, email: "me@example.com", uid: "u1", next: "/brand", role: "brand", p: "link", exp: 1 };

describe("parsePendingLink／pendingEmail", () => {
  it("合法內容", () => {
    expect(parsePendingLink({ ...base, name: " 小明 " })).toEqual({ sub: TEST_SUB, email: "me@example.com", name: "小明", uid: "u1", next: "/brand", role: "brand" });
    expect(pendingView({ ...base, name: "小明" })).toEqual({ email: "me@example.com", name: "小明" });
    expect(pendingView(base)).toEqual({ email: "me@example.com", name: null });
  });
  it("格式不對一律 null", () => {
    expect(parsePendingLink(null)).toBeNull();
    expect(parsePendingLink({ ...base, sub: "U1" })).toBeNull();
    expect(parsePendingLink({ ...base, email: "Me@Example.com" })).toBeNull();
    expect(parsePendingLink({ ...base, email: "nope" })).toBeNull();
    expect(pendingView({ ...base, email: 3 })).toBeNull();
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

describe("cleanLineName", () => {
  it("一般名稱、頭尾空白", () => {
    expect(cleanLineName("  王小明 ")).toBe("王小明");
    expect(cleanLineName("Amy🌸")).toBe("Amy🌸");
  });
  it("去掉控制字元與雙向控制字元、零寬字元", () => {
    expect(cleanLineName("a\u202Eevil\u0007b")).toBe("aevilb");
    expect(cleanLineName("\u200B小明\u200B")).toBe("小明");
  });
  it("最多 40 個字（以 code point 計）", () => {
    expect(Array.from(cleanLineName("🌸".repeat(60))!).length).toBe(40);
    expect(cleanLineName("x".repeat(5000))!.length).toBe(40);
  });
  it("不是字串、清完是空的：null", () => {
    expect(cleanLineName(undefined)).toBeNull();
    expect(cleanLineName(42)).toBeNull();
    expect(cleanLineName(" \u200B ")).toBeNull();
  });
  it("HTML 只是文字（畫面用 React 文字節點顯示，不當 HTML）", () => {
    expect(cleanLineName("<img src=x onerror=alert(1)>")).toBe("<img src=x onerror=alert(1)>");
  });
});
