import { describe, expect, it } from "vitest";
import { randomToken, safeEqual, seal, unseal } from "./sealed-cookie";

const SECRET = "0123456789abcdef0123456789abcdef";
const NOW = 1_800_000_000;

describe("seal／unseal", () => {
  it("來回一致，內容看不到", () => {
    const v = seal("flow", { state: "s1", next: "/brand" }, SECRET, NOW + 600);
    expect(v).not.toContain("s1");
    expect(Buffer.from(v, "base64url").toString("utf8")).not.toContain("brand");
    expect(unseal(v, "flow", SECRET, NOW)).toMatchObject({ state: "s1", next: "/brand", p: "flow", exp: NOW + 600 });
  });
  it("每次加密結果不同（隨機 IV）", () => {
    expect(seal("flow", { a: 1 }, SECRET, NOW + 1)).not.toBe(seal("flow", { a: 1 }, SECRET, NOW + 1));
  });
  it("過期、用途不同、密鑰不同、被竄改：null", () => {
    const v = seal("flow", { state: "s1" }, SECRET, NOW + 600);
    expect(unseal(v, "flow", SECRET, NOW + 600)).toBeNull();
    expect(unseal(v, "link", SECRET, NOW)).toBeNull();
    expect(unseal(v, "flow", "ffffffffffffffffffffffffffffffff", NOW)).toBeNull();
    const raw = Buffer.from(v, "base64url");
    raw[raw.length - 1] ^= 1;
    expect(unseal(raw.toString("base64url"), "flow", SECRET, NOW)).toBeNull();
  });
  it("空值、亂碼、太長：null", () => {
    expect(unseal(undefined, "flow", SECRET, NOW)).toBeNull();
    expect(unseal("", "flow", SECRET, NOW)).toBeNull();
    expect(unseal("not base64!", "flow", SECRET, NOW)).toBeNull();
    expect(unseal("AAAA", "flow", SECRET, NOW)).toBeNull();
    expect(unseal("A".repeat(5000), "flow", SECRET, NOW)).toBeNull();
  });
});

describe("safeEqual／randomToken", () => {
  it("比較", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
  it("亂數 43 字元、不重複", () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });
});
