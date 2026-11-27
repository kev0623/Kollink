import { describe, expect, it } from "vitest";
import { classifyOtpSendError, lineLinkSendErrorMessage, otpSendErrorMessage } from "./otp-send-error";

describe("classifyOtpSendError", () => {
  it("沒有錯誤", () => {
    expect(classifyOtpSendError(null)).toBeNull();
    expect(classifyOtpSendError(undefined)).toBeNull();
  });
  it("寄太頻繁", () => {
    expect(classifyOtpSendError({ status: 429 })).toBe("rate");
    expect(classifyOtpSendError({ status: 400, code: "over_email_send_rate_limit" })).toBe("rate");
  });
  it("寄信服務出錯（正式站實際收到的回應）", () => {
    expect(classifyOtpSendError({ status: 500, code: "unexpected_failure", message: "Error sending confirmation email" })).toBe("mail-down");
    expect(classifyOtpSendError({ status: 500, message: "Error sending magic link email" })).toBe("mail-down");
    expect(classifyOtpSendError({ status: 503 })).toBe("mail-down");
  });
  it("連不到伺服器", () => {
    expect(classifyOtpSendError({ name: "AuthRetryableFetchError", message: "Failed to fetch" })).toBe("network");
    expect(classifyOtpSendError({ status: 0 })).toBe("network");
  });
  it("其他是 Email 不被接受", () => {
    expect(classifyOtpSendError({ status: 400, code: "email_address_invalid" })).toBe("rejected");
    expect(classifyOtpSendError({ status: 422, code: "validation_failed" })).toBe("rejected");
  });
});

describe("otpSendErrorMessage", () => {
  it("寄信服務出錯：依開了哪些社群登入給出路", () => {
    expect(otpSendErrorMessage("mail-down", { google: true, line: true })).toContain("LINE 或 Google 登入");
    expect(otpSendErrorMessage("mail-down", { google: true, line: false })).toContain("上方的 Google 登入");
    expect(otpSendErrorMessage("mail-down", { google: false, line: true })).toContain("上方的 LINE 登入");
    const none = otpSendErrorMessage("mail-down", { google: false, line: false });
    expect(none).not.toMatch(/Google|LINE|上方/);
    expect(none).toContain("稍後再試");
  });
  it("寄信服務出錯時明講不是 Email 的問題；Email 被拒時才請使用者檢查", () => {
    expect(otpSendErrorMessage("mail-down", { google: true, line: true })).toContain("不是你的 Email 有問題");
    expect(otpSendErrorMessage("rejected", { google: true, line: true })).toContain("有沒有打錯");
  });
  it("每種情況都有文字", () => {
    for (const k of ["rate", "mail-down", "rejected", "network"] as const) {
      expect(otpSendErrorMessage(k, { google: false, line: false }).length).toBeGreaterThan(5);
    }
  });
});

describe("lineLinkSendErrorMessage", () => {
  it("有開 Google 才建議改用 Google", () => {
    expect(lineLinkSendErrorMessage("mail-down", true)).toContain("改用 Google");
    expect(lineLinkSendErrorMessage("mail-down", false)).not.toContain("Google");
  });
  it("其他情況", () => {
    expect(lineLinkSendErrorMessage("network", true)).toContain("網路");
    expect(lineLinkSendErrorMessage("rejected", true)).toContain("稍後再試");
  });
});
