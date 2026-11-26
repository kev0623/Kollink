import { describe, expect, it } from "vitest";
import { isLineLinkKind, lineErrorMessage } from "./messages";

describe("LINE 錯誤代碼白名單", () => {
  it("認得的代碼回中文", () => {
    expect(lineErrorMessage("line_no_email")).toBe("LINE 沒有提供 Email。請在 LINE 的授權畫面允許提供 Email，或改用 Email 驗證碼登入。");
    expect(lineErrorMessage("line_cancelled")).toContain("取消");
  });
  it("其他值一律 null（網址參數不會直接顯示在畫面上）", () => {
    for (const v of ["line_", "toString", "__proto__", "<script>", undefined, ["line_failed"], 1]) expect(lineErrorMessage(v)).toBeNull();
  });
  it("綁定畫面只接受 existing／new", () => {
    expect(isLineLinkKind("existing")).toBe(true);
    expect(isLineLinkKind("new")).toBe(true);
    expect(isLineLinkKind("other")).toBe(false);
  });
});
