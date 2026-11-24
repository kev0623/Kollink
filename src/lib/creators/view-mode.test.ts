import { describe, expect, it } from "vitest";
import { VIEW_MODE_KEY, readViewMode, writeViewMode } from "./view-mode";

describe("readViewMode", () => {
  it("存的是 list 才是列表，其他都是卡片", () => {
    expect(readViewMode({ getItem: () => "list" })).toBe("list");
    expect(readViewMode({ getItem: () => "card" })).toBe("card");
    expect(readViewMode({ getItem: () => "weird" })).toBe("card");
    expect(readViewMode({ getItem: () => null })).toBe("card");
    expect(readViewMode(null)).toBe("card");
  });
  it("讀取丟錯時是卡片", () => {
    expect(readViewMode({ getItem: () => { throw new Error("SecurityError"); } })).toBe("card");
  });
});

describe("writeViewMode", () => {
  it("寫入固定的 key", () => {
    const saved: Record<string, string> = {};
    writeViewMode({ setItem: (k, v) => { saved[k] = v; } }, "list");
    expect(saved).toEqual({ [VIEW_MODE_KEY]: "list" });
  });
  it("寫入丟錯或沒有 storage 時不丟出", () => {
    expect(() => writeViewMode({ setItem: () => { throw new Error("QuotaExceededError"); } }, "list")).not.toThrow();
    expect(() => writeViewMode(null, "card")).not.toThrow();
  });
});
