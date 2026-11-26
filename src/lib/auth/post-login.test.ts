import { describe, expect, it } from "vitest";
import { homeFor, isRole, resolvePostLoginPath, withMfaStep } from "./post-login";

describe("resolvePostLoginPath", () => {
  it("沒有帳號、有選身分 → 對應的填資料頁", () => {
    expect(resolvePostLoginPath({ role: null, requestedRole: "brand", next: null })).toBe("/onboarding/brand");
    expect(resolvePostLoginPath({ role: null, requestedRole: "creator", next: "/creator" })).toBe("/onboarding/creator");
  });
  it("沒有帳號、沒有身分或身分不合法 → /onboarding", () => {
    expect(resolvePostLoginPath({ role: null, requestedRole: null, next: null })).toBe("/onboarding");
    expect(resolvePostLoginPath({ role: null, requestedRole: "admin", next: null })).toBe("/onboarding");
  });
  it("品牌 → next 在品牌區內才採用", () => {
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: null })).toBe("/brand");
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: "/brand/settings" })).toBe("/brand/settings");
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: "/creator/me" })).toBe("/brand");
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: "/brandx" })).toBe("/brand");
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: "//evil.com" })).toBe("/brand");
  });
  it("創作者 → next 在創作者區內才採用；requestedRole 被忽略", () => {
    expect(resolvePostLoginPath({ role: "creator", requestedRole: "brand", next: null })).toBe("/creator");
    expect(resolvePostLoginPath({ role: "creator", requestedRole: null, next: "/creator/me" })).toBe("/creator/me");
    expect(resolvePostLoginPath({ role: "creator", requestedRole: null, next: "/brand" })).toBe("/creator");
  });
});

describe("isRole / homeFor", () => {
  it("只接受 brand 與 creator", () => {
    expect(isRole("brand")).toBe(true);
    expect(isRole("creator")).toBe(true);
    expect(isRole("admin")).toBe(false);
    expect(isRole(null)).toBe(false);
  });
  it("任何身分登入後都可以回到創作者公開頁", () => {
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: "/c/mei.daily" })).toBe("/c/mei.daily");
    expect(resolvePostLoginPath({ role: "creator", requestedRole: null, next: "/c/mei" })).toBe("/c/mei");
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: "/c/mei/x" })).toBe("/brand");
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: "/c/" })).toBe("/brand");
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: "/c/Bad" })).toBe("/brand");
  });
  it("公開頁 next 帶 query、fragment、雙斜線或路徑跳脫 → 回首頁", () => {
    for (const next of ["/c/mei?y", "/c/mei#f", "//evil", "/c/%2e%2e", "/c/.."]) {
      expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next })).toBe("/brand");
      expect(resolvePostLoginPath({ role: "creator", requestedRole: null, next })).toBe("/creator");
    }
  });
  it("首頁路徑", () => {
    expect(homeFor("brand")).toBe("/brand");
    expect(homeFor("creator")).toBe("/creator");
  });
});

describe("管理員（計畫 9）", () => {
  it("沒有 profile 的管理員 → /admin（不進填資料頁）", () => {
    expect(resolvePostLoginPath({ role: null, requestedRole: "brand", next: null, isAdmin: true })).toBe("/admin");
  });
  it("next 在 /admin 底下才採用", () => {
    expect(resolvePostLoginPath({ role: null, requestedRole: null, next: "/admin/payments?view=refunds", isAdmin: true }))
      .toBe("/admin/payments?view=refunds");
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: "/admin", isAdmin: true })).toBe("/admin");
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: "/adminx", isAdmin: true })).toBe("/brand");
    expect(resolvePostLoginPath({ role: null, requestedRole: null, next: "//evil.com/admin", isAdmin: true })).toBe("/admin");
  });
  it("不是管理員：/admin 的 next 不採用", () => {
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: "/admin", isAdmin: false })).toBe("/brand");
    expect(resolvePostLoginPath({ role: null, requestedRole: null, next: "/admin" })).toBe("/onboarding");
  });
});

describe("withMfaStep", () => {
  it("已通過第二步驟或不是後台路徑：原樣", () => {
    expect(withMfaStep("/admin/collabs", false)).toBe("/admin/collabs");
    expect(withMfaStep("/brand", true)).toBe("/brand");
  });
  it("還沒通過第二步驟：去 /admin/mfa 並帶回原路徑", () => {
    expect(withMfaStep("/admin", true)).toBe("/admin/mfa");
    expect(withMfaStep("/admin/collabs?state=x", true)).toBe("/admin/mfa?next=%2Fadmin%2Fcollabs%3Fstate%3Dx");
    expect(withMfaStep("/admin/mfa", true)).toBe("/admin/mfa");
  });
});
