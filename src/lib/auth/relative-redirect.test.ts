import { describe, expect, it } from "vitest";
import { relativeRedirect } from "./relative-redirect";

const loc = (p: string) => relativeRedirect(p).headers.get("Location");

describe("relativeRedirect", () => {
  it("回 307", () => expect(relativeRedirect("/brand").status).toBe(307));
  it("可指定狀態碼", () => expect(relativeRedirect("/brand", 303).status).toBe(303));
  it("中文路徑會編碼", () => expect(loc("/brand/活動")).toBe("/brand/%E6%B4%BB%E5%8B%95"));
  it("中文 query 會編碼", () => expect(loc("/brand?q=美妝")).toBe("/brand?q=%E7%BE%8E%E5%A6%9D"));
  it("空白會編碼", () => expect(loc("/brand/a b")).toBe("/brand/a%20b"));
  it("引號會編碼", () => expect(loc('/brand/a"b?x="1"')).toBe("/brand/a%22b?x=%221%22"));
  it("結果只含 ASCII", () => expect(loc("/c/美妝?x=好#頁")).toMatch(/^[\x21-\x7e]+$/));
  it.each(["/.//evil.com", "/a/..//evil.com", "//evil.com", "/\\evil.com"])("%s 不會產生 // 開頭的導向", (p) => {
    const l = loc(p)!;
    expect(l.startsWith("//")).toBe(false);
    expect(l.startsWith("/")).toBe(true);
  });
  it("/.//evil.com 退回首頁", () => expect(loc("/.//evil.com")).toBe("/"));
});
