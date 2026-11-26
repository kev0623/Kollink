import { describe, expect, it } from "vitest";
import { cleanMessageBody, MESSAGE_BODY_MAX, validateMessageBody } from "./message";

describe("cleanMessageBody", () => {
  it("CRLF 與 CR 換成 LF、去掉前後空白與零寬字元，保留中間的換行", () => {
    expect(cleanMessageBody("  第一行\r\n第二行\r第三行​  ")).toBe("第一行\n第二行\n第三行");
  });
  it("超長輸入直接截斷（之後的長度檢查一定會擋）", () => {
    const out = cleanMessageBody("字".repeat(10_000));
    expect(validateMessageBody(out)).toBe(`訊息最多 ${MESSAGE_BODY_MAX} 字`);
  });
});

describe("validateMessageBody", () => {
  it("空白", () => {
    expect(validateMessageBody(cleanMessageBody(" \t\n"))).toBe("請輸入訊息");
  });
  it("剛好 2000 字可以、2001 字不行（以 code point 計）", () => {
    expect(validateMessageBody("字".repeat(2000))).toBeNull();
    expect(validateMessageBody("😀".repeat(2000))).toBeNull();
    expect(validateMessageBody("字".repeat(2001))).toBe("訊息最多 2000 字");
  });
  it("雙向控制字元與 NUL", () => {
    expect(validateMessageBody("abc‮")).toBe("含有不允許的特殊字元");
    expect(validateMessageBody("a\u0000b")).toBe("含有不允許的特殊字元");
  });
});
