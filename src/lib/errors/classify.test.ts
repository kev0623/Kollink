import { describe, expect, it } from "vitest";
import { classifyError, digestOf, ERROR_COPY, supportSubject } from "./classify";

describe("classifyError", () => {
  it("離線優先於其他判斷", () => {
    expect(classifyError(new Error("ChunkLoadError"), false)).toBe("offline");
    expect(classifyError(null, false)).toBe("offline");
  });
  it("認得各瀏覽器的舊版程式檔錯誤", () => {
    const e = new Error("x");
    e.name = "ChunkLoadError";
    expect(classifyError(e, true)).toBe("stale-build");
    expect(classifyError(new Error("Loading chunk 123 failed."), true)).toBe("stale-build");
    expect(classifyError(new TypeError("Failed to fetch dynamically imported module: https://x/y.js"), true)).toBe("stale-build");
    expect(classifyError(new TypeError("error loading dynamically imported module"), true)).toBe("stale-build");
    expect(classifyError(new TypeError("Importing a module script failed."), true)).toBe("stale-build");
    expect(classifyError("Loading CSS chunk 4 failed", true)).toBe("stale-build");
  });
  it("其他一律是一般錯誤，包含不是 Error 的值", () => {
    expect(classifyError(new Error("boom"), true)).toBe("generic");
    expect(classifyError(undefined, true)).toBe("generic");
    expect(classifyError({ message: "ChunkLoadError" }, true)).toBe("generic");
    expect(classifyError(42, true)).toBe("generic");
  });
});

describe("digestOf", () => {
  it("取出 Next 的識別碼", () => {
    expect(digestOf(Object.assign(new Error("x"), { digest: "1234567890" }))).toBe("1234567890");
    expect(digestOf({ digest: "abc@E394" })).toBe("abc@E394");
  });
  it("沒有、型別不對或內容奇怪時回 null", () => {
    expect(digestOf(new Error("x"))).toBeNull();
    expect(digestOf(null)).toBeNull();
    expect(digestOf("digest")).toBeNull();
    expect(digestOf({ digest: 123 })).toBeNull();
    expect(digestOf({ digest: "" })).toBeNull();
    expect(digestOf({ digest: "<script>" })).toBeNull();
    expect(digestOf({ digest: "a".repeat(65) })).toBeNull();
  });
});

describe("文案", () => {
  it("每種情況都有標題、說明與主要動作，且不道歉", () => {
    for (const c of Object.values(ERROR_COPY)) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.body.length).toBeGreaterThan(0);
      expect(c.primary.length).toBeGreaterThan(0);
      expect(`${c.title}${c.body}`).not.toMatch(/抱歉|對不起|糟糕/);
    }
  });
  it("客服主旨帶代碼", () => {
    expect(supportSubject("abc123")).toBe("頁面打不開（代碼 abc123）");
    expect(supportSubject(null)).toBe("頁面打不開");
  });
});
