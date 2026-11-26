import { describe, expect, it } from "vitest";
import { COLLAB_STALE_MESSAGE, collabErrorMessage, collabFieldError } from "./errors";

describe("collabErrorMessage", () => {
  it("已知錯誤", () => {
    expect(collabErrorMessage({ code: "23505", message: "already invited" })).toBe("你已經邀請過這位創作者，請等對方回覆");
    expect(collabErrorMessage({ code: "P0002", message: "creator not found" })).toBe("找不到這位創作者，或對方還沒通過審核");
  });
  it("狀態不允許的轉換視為狀態已更新", () => {
    expect(collabErrorMessage({ code: "22023", message: "invalid transition: approve from awaiting_publish by brand" })).toBe(COLLAB_STALE_MESSAGE);
    expect(collabErrorMessage({ code: "55000", message: "collaboration not awaiting submission" })).toBe(COLLAB_STALE_MESSAGE);
  });
  it("其他錯誤不洩漏內容", () => {
    expect(collabErrorMessage({ code: "XX000", message: "boom" })).toBe("發生錯誤，請稍後再試");
    expect(collabErrorMessage({})).toBe("發生錯誤，請稍後再試");
  });
});

describe("collabFieldError", () => {
  it("22023 invalid <欄位>", () => {
    expect(collabFieldError({ code: "22023", message: "invalid amount_twd" })).toEqual({ amount: "格式不正確" });
    expect(collabFieldError({ code: "22023", message: "invalid published_url" })).toBeNull();
    expect(collabErrorMessage({ code: "22023", message: "invalid published_url" })).toContain("貼文網址");
    expect(collabFieldError({ code: "22023", message: "invalid note" })).toEqual({ note: "格式不正確" });
    expect(collabFieldError({ code: "22023", message: "invalid file_paths" })).toEqual({ files: "格式不正確" });
    expect(collabFieldError({ code: "22023", message: "invalid transition: x" })).toBeNull();
    expect(collabFieldError({ code: "42501", message: "invalid title" })).toBeNull();
  });
});
