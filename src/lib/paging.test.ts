import { describe, expect, it } from "vitest";
import { MAX_PAGE, PAGE_SIZE, pageCount, pageHref, pageItems, pageOverflow, pageRange, pageSpan, parsePage } from "./paging";

const nums = (page: number, pages: number) => pageItems(page, pages).map((i) => (i.kind === "page" ? i.page : "…"));

describe("parsePage", () => {
  it("正整數才採用", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2", "9"])).toBe(2);
  });
  it("其他值一律第 1 頁", () => {
    for (const v of [undefined, "", "0", "-1", "1.5", "abc", "1e3", " 2", "12345678"]) expect(parsePage(v)).toBe(1);
  });
  it("超過上限就是上限", () => {
    expect(parsePage("999999")).toBe(MAX_PAGE);
  });
});

describe("pageCount / pageRange / pageOverflow / pageSpan", () => {
  it("總頁數至少 1", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(-5)).toBe(1);
    expect(pageCount(PAGE_SIZE)).toBe(1);
    expect(pageCount(PAGE_SIZE + 1)).toBe(2);
    expect(pageCount(101, 50)).toBe(3);
  });
  it("資料庫範圍含頭尾", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: PAGE_SIZE - 1 });
    expect(pageRange(3)).toEqual({ from: 2 * PAGE_SIZE, to: 3 * PAGE_SIZE - 1 });
    expect(pageRange(0)).toEqual({ from: 0, to: PAGE_SIZE - 1 });
    expect(pageRange(2, 5)).toEqual({ from: 5, to: 9 });
  });
  it("超過最後一頁時回最後一頁", () => {
    expect(pageOverflow(1, 0)).toBeNull();
    expect(pageOverflow(2, 0)).toBe(1);
    expect(pageOverflow(3, 41)).toBeNull();
    expect(pageOverflow(4, 41)).toBe(3);
  });
  it("顯示範圍", () => {
    expect(pageSpan(1, 0)).toBeNull();
    expect(pageSpan(1, 7)).toEqual({ first: 1, last: 7 });
    expect(pageSpan(2, 57)).toEqual({ first: 21, last: 40 });
    expect(pageSpan(3, 57)).toEqual({ first: 41, last: 57 });
    expect(pageSpan(9, 57)).toEqual({ first: 41, last: 57 });
  });
});

describe("pageItems", () => {
  it("7 頁以內全部列出", () => {
    expect(nums(1, 1)).toEqual([1]);
    expect(nums(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("中間省略", () => {
    expect(nums(6, 20)).toEqual([1, "…", 5, 6, 7, "…", 20]);
  });
  it("靠近兩端時項目數不變", () => {
    expect(nums(1, 20)).toEqual([1, 2, 3, 4, 5, "…", 20]);
    expect(nums(4, 20)).toEqual([1, 2, 3, 4, 5, "…", 20]);
    expect(nums(5, 20)).toEqual([1, "…", 4, 5, 6, "…", 20]);
    expect(nums(17, 20)).toEqual([1, "…", 16, 17, 18, 19, 20]);
    expect(nums(20, 20)).toEqual([1, "…", 16, 17, 18, 19, 20]);
    for (let p = 1; p <= 20; p++) expect(nums(p, 20)).toHaveLength(7);
  });
  it("頁數超出範圍時當成邊界", () => {
    expect(nums(99, 8)).toEqual(nums(8, 8));
    expect(nums(0, 8)).toEqual(nums(1, 8));
  });
  it("gap 的 key 不重複", () => {
    const keys = pageItems(10, 30).filter((i) => i.kind === "gap").map((i) => (i.kind === "gap" ? i.key : ""));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("pageHref", () => {
  it("第 1 頁不帶 page，保留其他參數", () => {
    expect(pageHref("/creator", { tab: "applied" }, 1)).toBe("/creator?tab=applied");
    expect(pageHref("/creator", { tab: "applied" }, 3)).toBe("/creator?tab=applied&page=3");
    expect(pageHref("/brand/briefs", { tab: undefined }, 1)).toBe("/brand/briefs");
    expect(pageHref("/brand/briefs", {}, 2)).toBe("/brand/briefs?page=2");
  });
  it("可以帶 hash", () => {
    expect(pageHref("/brand/briefs/x", { applicants: "applied" }, 2, "#applicants")).toBe("/brand/briefs/x?applicants=applied&page=2#applicants");
  });
});
