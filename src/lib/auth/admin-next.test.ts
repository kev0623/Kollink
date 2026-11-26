import { describe, expect, it } from "vitest";
import { adminNextPath, mfaRedirectPath, requestPath } from "./admin-next";

describe("requestPath", () => {
  it("pathname + search，去掉 _rsc", () => {
    expect(requestPath(new URL("http://x/admin/collabs?status=paid&_rsc=abc"))).toBe("/admin/collabs?status=paid");
    expect(requestPath(new URL("http://x/admin/collabs?_rsc=abc"))).toBe("/admin/collabs");
    expect(requestPath(new URL("http://x/admin"))).toBe("/admin");
  });
});

describe("adminNextPath", () => {
  it("接受 /admin 底下的站內路徑", () => {
    expect(adminNextPath("/admin")).toBe("/admin");
    expect(adminNextPath("/admin/collabs/123?tab=pay")).toBe("/admin/collabs/123?tab=pay");
    expect(adminNextPath("/admin?q=1")).toBe("/admin?q=1");
  });
  it("拒絕 /admin 以外、/admin/mfa 本身與不安全的路徑", () => {
    for (const p of [
      null, undefined, "", "/brand", "/administrator", "/admin-x", "/admin/mfa", "/admin/mfa?next=/admin",
      "//evil.com/admin", "https://evil.com/admin", "/admin/../brand", "/admin/%2e%2e/brand", "/\\evil.com", "/admin/x.png", "/admin/collabs/1.JPEG?a=1",
    ]) {
      expect(adminNextPath(p)).toBeNull();
    }
  });
});

describe("mfaRedirectPath", () => {
  it("帶上原本要去的後台頁面", () => {
    expect(mfaRedirectPath("/admin/collabs/123")).toBe("/admin/mfa?next=%2Fadmin%2Fcollabs%2F123");
    expect(mfaRedirectPath("/admin/creators?status=pending")).toBe("/admin/mfa?next=%2Fadmin%2Fcreators%3Fstatus%3Dpending");
  });
  it("/admin、沒有或不合法的路徑：不帶 next", () => {
    expect(mfaRedirectPath("/admin")).toBe("/admin/mfa");
    expect(mfaRedirectPath(null)).toBe("/admin/mfa");
    expect(mfaRedirectPath("//evil.com")).toBe("/admin/mfa");
    expect(mfaRedirectPath("/brand/collabs")).toBe("/admin/mfa");
  });
});
