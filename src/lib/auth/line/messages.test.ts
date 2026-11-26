import { describe, expect, it } from "vitest";
import { isLineLinkError, isLineVerifyState, lineErrorMessage, lineVerifyNotice } from "./messages";

describe("LINE 錯誤代碼白名單", () => {
  it("認得的代碼回中文", () => {
    expect(lineErrorMessage("line_no_email")).toBe("LINE 沒有提供 Email。請在 LINE 的授權畫面允許提供 Email，或改用 Email 驗證碼登入。");
    expect(lineErrorMessage("line_cancelled")).toContain("取消");
  });
  it("其他值一律 null（網址參數不會直接顯示在畫面上）", () => {
    for (const v of ["line_", "toString", "__proto__", "<script>", undefined, ["line_failed"], 1]) expect(lineErrorMessage(v)).toBeNull();
  });
  it("驗證碼畫面只接受 line=verify", () => {
    expect(isLineVerifyState("verify")).toBe(true);
    expect(isLineVerifyState("existing")).toBe(false);
    expect(isLineVerifyState(undefined)).toBe(false);
  });
  it("新帳號與既有帳號同一段中性文字，含使用者自己的 Email", () => {
    const t = lineVerifyNotice("me@example.com");
    expect(t).toBe("我們寄了一組驗證碼到 LINE 提供的 Email（me@example.com）。輸入後就完成登入，並把 LINE 綁定到這個帳號。");
    expect(t).not.toContain("已經有");
  });
  it("綁定錯誤代碼白名單", () => {
    expect(isLineLinkError("mismatch")).toBe(true);
    expect(isLineLinkError("constructor")).toBe(false);
  });
});
