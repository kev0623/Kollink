import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it.each(["/brand", "/creator/me?tab=1", "/c/mei.daily"])("接受站內路徑 %s", (p) => {
    expect(safeNextPath(p)).toBe(p);
  });
  it.each([
    null, undefined, "", "brand", "//evil.com", "/\\evil.com", "https://evil.com",
    "javascript:alert(1)", "/brand\n", "/x\u0000", "/" + "a".repeat(512),
  ])("拒絕 %j", (p) => {
    expect(safeNextPath(p as string | null | undefined)).toBeNull();
  });
});
