import { describe, expect, it } from "vitest";
import { nextPollDelay, POLL_MAX_ATTEMPTS } from "./poll";

describe("付款返回後的自動更新節奏", () => {
  it("每 5 秒，最多 36 次（3 分鐘）", () => {
    expect(nextPollDelay(0)).toBe(5000);
    expect(nextPollDelay(35)).toBe(5000);
    expect(nextPollDelay(POLL_MAX_ATTEMPTS)).toBeNull();
    expect(POLL_MAX_ATTEMPTS * 5000).toBe(180_000);
  });
});
