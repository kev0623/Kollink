import { describe, expect, it } from "vitest";
import { requiresAuth } from "./routes";

describe("requiresAuth", () => {
  it.each(["/brand", "/brand/settings", "/creator", "/creator/me", "/onboarding", "/onboarding/brand", "/admin", "/admin/payments"])(
    "%s 需要登入", (p) => expect(requiresAuth(p)).toBe(true));
  it.each(["/", "/login", "/signup", "/auth/callback", "/c/mei", "/brandx", "/administrator", "/api/payments/ecpay/notify"])(
    "%s 不需要登入", (p) => expect(requiresAuth(p)).toBe(false));
});
