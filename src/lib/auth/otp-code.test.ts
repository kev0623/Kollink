import { describe, expect, it } from "vitest";
import { isValidOtpCode, toOtpCode } from "./otp-code";

describe("toOtpCode", () => {
  it("全形轉半形、去掉非數字、最多 8 碼", () => {
    expect(toOtpCode("１２３ ４５６")).toBe("123456");
    expect(toOtpCode("12-34-56-78-90")).toBe("12345678");
    expect(toOtpCode("abc")).toBe("");
  });
  it("可指定上限（TOTP 6 碼）", () => {
    expect(toOtpCode("1234567", 6)).toBe("123456");
  });
});

describe("isValidOtpCode", () => {
  it("接受 6 到 8 位數", () => {
    expect(isValidOtpCode("123456")).toBe(true);
    expect(isValidOtpCode("1234567")).toBe(true);
    expect(isValidOtpCode("12345678")).toBe(true);
  });
  it("拒絕太短、太長與非數字", () => {
    expect(isValidOtpCode("12345")).toBe(false);
    expect(isValidOtpCode("123456789")).toBe(false);
    expect(isValidOtpCode("12345a")).toBe(false);
  });
  it("TOTP 只接受 6 位", () => {
    expect(isValidOtpCode("123456", 6, 6)).toBe(true);
    expect(isValidOtpCode("1234567", 6, 6)).toBe(false);
  });
});
