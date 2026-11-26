import { describe, expect, it } from "vitest";
import { ADMIN_NOTE_MAX, amountMatches, cleanAdminNote, validateAdminNote } from "./notes";

describe("管理員的原因／說明", () => {
  it("清理：CRLF 轉 LF、去頭尾空白；不是字串回傳 null", () => {
    expect(cleanAdminNote("  已轉帳\r\n序號 1 ")).toBe("已轉帳\n序號 1");
    expect(cleanAdminNote(3)).toBeNull();
  });
  it("必填、最多 500 字、不能有雙向控制字元或 NUL", () => {
    expect(validateAdminNote("", "原因")).toBe("請填寫原因");
    expect(validateAdminNote("a".repeat(ADMIN_NOTE_MAX))).toBeNull();
    expect(validateAdminNote("a".repeat(ADMIN_NOTE_MAX + 1))).toBe("說明最多 500 字");
    expect(validateAdminNote("x‮y")).toBe("說明含有不允許的特殊字元");
    expect(validateAdminNote("x\u0000y")).toBe("說明含有不允許的特殊字元");
  });
});

describe("amountMatches（人工標記已付款要核對金額，QA m17）", () => {
  it("去掉千分位與空白後必須等於報價", () => {
    expect(amountMatches("12,000", 12000)).toBe(true);
    expect(amountMatches(" 12000 ", 12000)).toBe(true);
    expect(amountMatches("1200", 12000)).toBe(false);
    expect(amountMatches("", 12000)).toBe(false);
    expect(amountMatches("12000.5", 12000)).toBe(false);
  });
});
