import { describe, expect, it } from "vitest";
import { isAuthorizedCron } from "./auth";

describe("isAuthorizedCron", () => {
  it("Bearer + 正確的 secret", () => {
    expect(isAuthorizedCron("Bearer s3cret-value", "s3cret-value")).toBe(true);
  });
  it("錯的、沒帶、少了 Bearer、大小寫不同都不通過", () => {
    expect(isAuthorizedCron("Bearer wrong", "s3cret-value")).toBe(false);
    expect(isAuthorizedCron(null, "s3cret-value")).toBe(false);
    expect(isAuthorizedCron("s3cret-value", "s3cret-value")).toBe(false);
    expect(isAuthorizedCron("bearer s3cret-value", "s3cret-value")).toBe(false);
    expect(isAuthorizedCron("Bearer s3cret-value ", "s3cret-value")).toBe(false);
  });
  it("secret 沒設定時一律不通過", () => {
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
    expect(isAuthorizedCron("Bearer undefined", undefined)).toBe(false);
  });
});
