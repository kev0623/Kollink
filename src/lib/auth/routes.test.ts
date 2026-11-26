import { describe, expect, it } from "vitest";
import { authPageRedirect, invalidCreatorPath, requiresAuth } from "./routes";

describe("requiresAuth", () => {
  it.each(["/brand", "/brand/settings", "/creator", "/creator/me", "/onboarding", "/onboarding/brand", "/admin", "/admin/payments"])(
    "%s 需要登入", (p) => expect(requiresAuth(p)).toBe(true));
  it.each(["/", "/login", "/signup", "/auth/callback", "/c/mei", "/brandx", "/administrator", "/api/payments/ecpay/notify"])(
    "%s 不需要登入", (p) => expect(requiresAuth(p)).toBe(false));
});

describe("authPageRedirect（已登入者造訪登入／註冊頁，QA m4）", () => {
  const p = (s: string) => new URLSearchParams(s);
  it("/login、/signup 導去 /auth/continue，保留 next 與註冊身分", () => {
    expect(authPageRedirect("/login", p(""))).toBe("/auth/continue");
    expect(authPageRedirect("/login", p("next=/brand/collabs"))).toBe("/auth/continue?next=%2Fbrand%2Fcollabs");
    expect(authPageRedirect("/signup", p("role=creator&next=/c/abc"))).toBe("/auth/continue?role=creator&next=%2Fc%2Fabc");
  });
  it("不認得的身分不帶；/login 的 role 不帶", () => {
    expect(authPageRedirect("/signup", p("role=admin"))).toBe("/auth/continue");
    expect(authPageRedirect("/login", p("role=brand"))).toBe("/auth/continue");
  });
  it("網址有 error 時不導（避免與 /auth/continue 的錯誤導向循環）；其他路徑不導", () => {
    expect(authPageRedirect("/login", p("error=profile"))).toBeNull();
    expect(authPageRedirect("/brand", p(""))).toBeNull();
    expect(authPageRedirect("/login/x", p(""))).toBeNull();
  });
});

describe("invalidCreatorPath（格式不合法的公開頁直接 404，QA m1 的一部分）", () => {
  it("/c/<不合法> 為 true；合法、多段、其他路徑為 false", () => {
    expect(invalidCreatorPath("/c/Bad!")).toBe(true);
    expect(invalidCreatorPath("/c/ab")).toBe(true);
    expect(invalidCreatorPath("/c/good_handle")).toBe(false);
    expect(invalidCreatorPath("/c/good_handle/opengraph-image")).toBe(false);
    expect(invalidCreatorPath("/brand")).toBe(false);
  });
});
