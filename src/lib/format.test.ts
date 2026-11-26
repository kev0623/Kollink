import { describe, expect, it } from "vitest";
import { formatNumber, formatPercent, formatTwd, initialOf } from "./format";

describe("format", () => {
  it("千分位與新台幣", () => {
    expect(formatNumber(12000)).toBe("12,000");
    expect(formatNumber(0)).toBe("0");
    expect(formatTwd(4500)).toBe("NT$4,500");
    expect(formatTwd(10_000_000)).toBe("NT$10,000,000");
  });
  it("互動率：沒填顯示 —，固定一位小數", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(3.5)).toBe("3.5%");
    expect(formatPercent(3.456)).toBe("3.5%");
    expect(formatPercent(0)).toBe("0.0%");
    expect(formatPercent(2)).toBe("2.0%");
    expect(formatPercent(6.667)).toBe("6.7%");
  });
  it("名字第一個字（以 code point 計算）", () => {
    expect(initialOf("小美")).toBe("小");
    expect(initialOf(" Mei")).toBe("M");
    expect(initialOf("😀小美")).toBe("😀");
    expect(initialOf("")).toBe("?");
  });
});
