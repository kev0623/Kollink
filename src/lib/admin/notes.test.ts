import { describe, expect, it } from "vitest";
import { ADMIN_NOTE_MAX, cleanAdminNote, validateAdminNote } from "./notes";

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
