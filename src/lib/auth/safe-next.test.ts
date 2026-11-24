import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it.each(["/brand", "/creator/me?tab=1", "/c/mei.daily", "/brand/a.b/c..d"])("接受站內路徑 %s", (p) => {
    expect(safeNextPath(p)).toBe(p);
  });
  it.each([
    null, undefined, "", "brand", "//evil.com", "/\\evil.com", "https://evil.com",
    "javascript:alert(1)", "/brand\n", "/x\u0000", "/" + "a".repeat(512),
    "/brand/../creator", "/brand/./x", "/brand/%2e%2e/creator", "/brand/%2E%2E/creator",
    "/brand\\..\\creator", "/brand/..//evil.com", "/..", "/brand/..?x=1",
    "/auth/callback?x=1", "/auth", "/login", "/login?next=/brand", "/signup", "/signup/brand",
  ])("拒絕 %j", (p) => {
    expect(safeNextPath(p as string | null | undefined)).toBeNull();
  });
});
