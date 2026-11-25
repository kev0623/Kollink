import { describe, expect, it } from "vitest";
import { devMerchantTradeNo } from "./dev-payment";

describe("devMerchantTradeNo", () => {
  it("DEV + 17 位大寫十六進位，共 20 字", () => {
    expect(devMerchantTradeNo("1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d")).toBe("DEV1A2B3C4D5E6F4A1B8");
    expect(devMerchantTradeNo()).toMatch(/^DEV[0-9A-F]{17}$/);
  });
});
