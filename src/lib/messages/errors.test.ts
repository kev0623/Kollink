import { describe, expect, it } from "vitest";
import { messageErrorMessage } from "./errors";

describe("messageErrorMessage", () => {
  it("認得的錯誤轉成中文", () => {
    expect(messageErrorMessage({ code: "54000", message: "too many messages" })).toBe("傳送太頻繁，請稍候一分鐘再試");
    expect(messageErrorMessage({ code: "55000", message: "conversation closed" })).toBe("對話已暫停，無法傳送訊息");
    expect(messageErrorMessage({ code: "P0002", message: "creator not found" })).toContain("找不到這位創作者");
  });
  it("其他錯誤（含原型鏈上的鍵）一律是通用訊息", () => {
    expect(messageErrorMessage({ message: "boom" })).toBe("發生錯誤，請稍後再試");
    expect(messageErrorMessage({ message: "toString" })).toBe("發生錯誤，請稍後再試");
    expect(messageErrorMessage({})).toBe("發生錯誤，請稍後再試");
  });
});
