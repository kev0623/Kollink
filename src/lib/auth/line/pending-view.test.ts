import { describe, expect, it } from "vitest";
import { parsePendingResponse } from "./pending-view";
import { lineAccountLabel } from "./messages";

describe("parsePendingResponse", () => {
  it("Email＋名稱", () => {
    expect(parsePendingResponse({ email: "me@example.com", name: "小明" })).toEqual({ email: "me@example.com", name: "小明" });
    expect(parsePendingResponse({ email: "me@example.com" })).toEqual({ email: "me@example.com", name: null });
    expect(parsePendingResponse({ email: "me@example.com", name: "  " })).toEqual({ email: "me@example.com", name: null });
  });
  it("過期或格式不對：null（畫面顯示「確認時間已過」）", () => {
    expect(parsePendingResponse({ error: "expired" })).toBeNull();
    expect(parsePendingResponse(null)).toBeNull();
    expect(parsePendingResponse({ email: 1 })).toBeNull();
    expect(parsePendingResponse({ email: "no-at" })).toBeNull();
  });
  it("名稱最多 40 個字", () => {
    expect(Array.from(parsePendingResponse({ email: "a@b.co", name: "字".repeat(80) })!.name!).length).toBe(40);
  });
});

describe("lineAccountLabel", () => {
  it("有名稱才顯示", () => {
    expect(lineAccountLabel("小明")).toBe("要綁定的 LINE 帳號：小明");
    expect(lineAccountLabel(null)).toBeNull();
  });
});
