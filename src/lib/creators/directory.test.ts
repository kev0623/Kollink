import { describe, expect, it } from "vitest";
import {
  directorySortsFor, DIRECTORY_QUERY_MAX, directoryHeading, directoryHref, hasDirectoryFilter, parseDirectoryQuery, toDirectory, type DirectoryRow,
} from "./directory";

const row = (over: Partial<DirectoryRow> = {}): DirectoryRow => ({
  handle: "mei", display_name: "小美", avatar_path: null, cover_path: null, region: "台北市", categories: ["美妝"],
  follower_count: 1200, engagement_rate: "3.5", avg_rating: "4.8", review_count: 3, min_price: 3000, total_count: "27", ...over,
});

describe("parseDirectoryQuery", () => {
  it("沒有參數時是預設值", () => {
    expect(parseDirectoryQuery({})).toEqual({ q: "", category: null, region: null, sort: "newest", page: 1 });
  });
  it("接受清單內的值", () => {
    expect(parseDirectoryQuery({ q: " 小美 ", category: "美妝", region: "台北市", sort: "rating", page: "3" }))
      .toEqual({ q: "小美", category: "美妝", region: "台北市", sort: "rating", page: 3 });
  });
  it("不認得的值退回預設，不報錯", () => {
    expect(parseDirectoryQuery({ category: "", region: "火星", sort: "cheapest", page: "abc" }))
      .toEqual({ q: "", category: null, region: null, sort: "newest", page: 1 });
    expect(parseDirectoryQuery({ category: ["美食", "美妝"], q: ["a", "b"] })).toMatchObject({ category: "美食", q: "a" });
  });
  it("關鍵字截到上限（以字為單位）", () => {
    expect([...parseDirectoryQuery({ q: "好".repeat(80) }).q]).toHaveLength(DIRECTORY_QUERY_MAX);
  });
});

describe("directoryHref", () => {
  it("預設值不寫進網址", () => {
    expect(directoryHref({})).toBe("/creators");
    expect(directoryHref({ q: "", category: null, region: null, sort: "newest", page: 1 })).toBe("/creators");
  });
  it("帶參數並編碼", () => {
    expect(directoryHref({ q: "小美 a&b", category: "美妝", sort: "followers", page: 2 }))
      .toBe("/creators?q=%E5%B0%8F%E7%BE%8E+a%26b&category=%E7%BE%8E%E5%A6%9D&sort=followers&page=2");
  });
  it("和 parseDirectoryQuery 可以來回", () => {
    const q = { q: "mei", category: "旅遊", region: "高雄市", sort: "rating" as const, page: 4 };
    const sp = Object.fromEntries(new URL(directoryHref(q), "http://x").searchParams);
    expect(parseDirectoryQuery(sp)).toEqual(q);
  });
});

describe("toDirectory", () => {
  it("轉換欄位，numeric 字串轉成數字", () => {
    expect(toDirectory([row()])).toEqual({
      total: 27,
      items: [{
        handle: "mei", displayName: "小美", avatarPath: null, coverPath: null, region: "台北市", categories: ["美妝"],
        followerCount: 1200, engagementRate: 3.5, rating: 4.8, reviewCount: 3, minPrice: 3000,
      }],
    });
  });
  it("沒有評價時 rating 是 null；缺名字用 handle；略過沒有 handle 的列", () => {
    const { items } = toDirectory([row({ review_count: 0, avg_rating: null, display_name: null, categories: null }), row({ handle: null })]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ rating: null, reviewCount: 0, displayName: "mei", categories: [] });
    expect(toDirectory([row({ min_price: null })]).items[0].minPrice).toBeNull();
    expect(toDirectory([row({ min_price: undefined })]).items[0].minPrice).toBeNull();
  });
  it("訪客拿到的粉絲數是 null（不是 0）", () => {
    expect(toDirectory([row({ follower_count: null })]).items[0].followerCount).toBeNull();
  });
  it("訪客沒有「粉絲數多」的排序", () => {
    expect(directorySortsFor(false).map((s) => s.value)).toEqual(["newest", "rating", "price"]);
    expect(directorySortsFor(true).map((s) => s.value)).toEqual(["newest", "followers", "rating", "price"]);
  });
  it("沒有列時 total 是 0", () => {
    expect(toDirectory([])).toEqual({ items: [], total: 0 });
  });
});

describe("標題與篩選", () => {
  const base = { q: "", category: null, region: null, sort: "newest" as const, page: 1 };
  it("directoryHeading", () => {
    expect(directoryHeading(base)).toEqual({ zh: "所有創作者", en: "All creators" });
    expect(directoryHeading({ ...base, category: "美妝", region: "台北市" })).toEqual({ zh: "美妝・台北市的創作者", en: "Beauty, Taipei creators" });
    expect(directoryHeading({ ...base, q: "小美", category: "美妝" }).zh).toBe("「小美」的搜尋結果");
  });
  it("hasDirectoryFilter：排序與頁數不算篩選", () => {
    expect(hasDirectoryFilter({ ...base, sort: "rating", page: 3 })).toBe(false);
    expect(hasDirectoryFilter({ ...base, region: "台北市" })).toBe(true);
  });
});
