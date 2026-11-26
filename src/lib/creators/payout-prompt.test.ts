import { describe, expect, it } from "vitest";
import { anyNeedsPayoutPrompt, needsPayoutPrompt } from "./payout-prompt";

describe("needsPayoutPrompt", () => {
  it("已付款到撥款前、沒有帳戶時提醒", () => {
    for (const s of ["awaiting_submission", "in_review", "awaiting_publish", "awaiting_payout"] as const) {
      expect(needsPayoutPrompt(s, false)).toBe(true);
      expect(needsPayoutPrompt(s, true)).toBe(false);
    }
  });
  it("付款前與結束後不提醒", () => {
    for (const s of ["invited", "awaiting_payment", "completed", "declined", "cancelled"] as const) expect(needsPayoutPrompt(s, false)).toBe(false);
  });
  it("任何一個合作案需要就提醒", () => {
    expect(anyNeedsPayoutPrompt(["invited", "in_review"], false)).toBe(true);
    expect(anyNeedsPayoutPrompt(["invited"], false)).toBe(false);
  });
});
