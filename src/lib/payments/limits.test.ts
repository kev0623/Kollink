import { describe, expect, it } from "vitest";
import { PAYMENT_MAX_TWD, requiresOfflinePayment } from "./limits";

describe("requiresOfflinePayment", () => {
  it("剛好等於上限仍可線上付款，超過才線下", () => {
    expect(requiresOfflinePayment(PAYMENT_MAX_TWD)).toBe(false);
    expect(requiresOfflinePayment(PAYMENT_MAX_TWD + 1)).toBe(true);
    expect(requiresOfflinePayment(4500)).toBe(false);
  });
});
