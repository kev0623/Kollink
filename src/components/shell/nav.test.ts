import { describe, expect, it } from "vitest";
import { isActive } from "./nav";

describe("isActive", () => {
  it("首頁只比對完全相同", () => {
    expect(isActive("/brand", "/brand")).toBe(true);
    expect(isActive("/brand", "/brand/settings")).toBe(false);
    expect(isActive("/creator", "/creator/me")).toBe(false);
  });
  it("其他項目含子路徑", () => {
    expect(isActive("/brand/settings", "/brand/settings")).toBe(true);
    expect(isActive("/creator/me", "/creator/me/x")).toBe(true);
    expect(isActive("/creator/me", "/creator/mex")).toBe(false);
  });
});
