import { describe, expect, it } from "vitest";
import { HERO_HEADLINE, SITE_NAME, SUPPORT_EMAIL, SUPPORT_LINE_URL, isPlaceholderEmail, isSupportPlaceholder, supportMailto } from "./site";

describe("site", () => {
  it("客服信箱是合法的 email；LINE 是 https 或 null", () => {
    expect(SUPPORT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
    if (SUPPORT_LINE_URL !== null) expect(SUPPORT_LINE_URL).toMatch(/^https:\/\//);
  });
  it("mailto 主旨加上產品名稱並編碼", () => {
    expect(supportMailto()).toBe(`mailto:${SUPPORT_EMAIL}`);
    expect(supportMailto("帳號暫停")).toBe(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[${SITE_NAME}] 帳號暫停`)}`);
  });
  it("首頁大標不含「→」", () => {
    expect(HERO_HEADLINE).not.toContain("→");
  });
  it("isPlaceholderEmail：example 保留網域為佔位，真實網域不是", () => {
    expect(isPlaceholderEmail("support@example.com")).toBe(true);
    expect(isPlaceholderEmail(" Support@Example.COM ")).toBe(true);
    expect(isPlaceholderEmail("help@example.org")).toBe(true);
    expect(isPlaceholderEmail("hello@kollink.tw")).toBe(false);
    expect(isPlaceholderEmail("a@notexample.com")).toBe(false);
  });
  it("isSupportPlaceholder 與目前的 SUPPORT_EMAIL 一致（上線前必須為 false，見 README「上線前檢查」）", () => {
    expect(isSupportPlaceholder()).toBe(isPlaceholderEmail(SUPPORT_EMAIL));
  });
});
