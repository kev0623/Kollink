import { describe, expect, it } from "vitest";
import { briefErrorMessage, briefFieldError } from "./errors";

describe("briefErrorMessage", () => {
  it("已知的錯誤轉成中文", () => {
    expect(briefErrorMessage({ code: "42501", message: "creator not approved" })).toBe("審核通過後即可報名");
    expect(briefErrorMessage({ code: "23505", message: "already applied" })).toBe("你已經報名過這則招募");
    expect(briefErrorMessage({ code: "55000", message: "brief closed" })).toBe("這則招募已結束，無法報名");
  });
  it("不認得的錯誤（含原型鏈上的名稱）是通用訊息", () => {
    expect(briefErrorMessage({ code: "XX000", message: "boom" })).toBe("發生錯誤，請稍後再試");
    expect(briefErrorMessage({ message: "constructor" })).toBe("發生錯誤，請稍後再試");
    expect(briefErrorMessage({})).toBe("發生錯誤，請稍後再試");
  });
});

describe("briefFieldError", () => {
  it("22023 對應到表單欄位", () => {
    expect(briefFieldError({ code: "22023", message: "invalid collab_types" })).toEqual({ collabTypes: "格式不正確" });
    expect(briefFieldError({ code: "22023", message: "invalid deadline" })).toEqual({ deadline: "截止日要在今天到 90 天內" });
    expect(briefFieldError({ code: "22023", message: "invalid reward" })).toEqual({ reward: "預算和產品至少要有一項" });
    expect(briefFieldError({ code: "22023", message: "invalid proposed_price_twd" })).toEqual({ proposedPrice: "格式不正確" });
  });
  it("其他錯誤回傳 null", () => {
    expect(briefFieldError({ code: "22023", message: "invalid accept" })).toBeNull();
    expect(briefFieldError({ code: "42501", message: "invalid title" })).toBeNull();
  });
});
