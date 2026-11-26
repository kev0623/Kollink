import { describe, expect, it } from "vitest";
import { canJumpToStep, isBlankBrief } from "./wizard";

describe("canJumpToStep（步驟可點，QA m15）", () => {
  it("可以回到任何到過的步驟；不能跳過還沒到的", () => {
    expect(canJumpToStep(1, 3, 3)).toBe(true);
    expect(canJumpToStep(3, 1, 3)).toBe(true);
    expect(canJumpToStep(4, 2, 3)).toBe(false);
    expect(canJumpToStep(2, 2, 2)).toBe(false); // 目前這一步不用跳
  });
});

describe("isBlankBrief（全空時不能存草稿）", () => {
  it("案名空白就是空白草稿", () => {
    expect(isBlankBrief({ title: "  " })).toBe(true);
    expect(isBlankBrief({ title: "夏季新品" })).toBe(false);
  });
});
