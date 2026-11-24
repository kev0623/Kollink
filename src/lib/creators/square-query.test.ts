import { describe, expect, it } from "vitest";
import {
  EMPTY_SQUARE_QUERY, activeFilterCount, clearFilters, emptyStateOf, parseSquareQuery, serializeSquareQuery,
  squareHref, toSearchArgs, toggleValue, type SquareQuery,
} from "./square-query";

describe("parseSquareQuery", () => {
  it("沒有參數時是預設值", () => {
    expect(parseSquareQuery({})).toEqual(EMPTY_SQUARE_QUERY);
    expect(parseSquareQuery(new URLSearchParams())).toEqual(EMPTY_SQUARE_QUERY);
  });

  it("讀取全部欄位（Next 的 searchParams 物件）", () => {
    expect(parseSquareQuery({
      q: "  小美 ", fav: "1", cat: ["美妝", "旅遊"], tag: "日系", followers: "1k-10k", er: "3",
      price: "lt5k", region: ["台北市"], collab: "Reels", sort: "followers",
    })).toEqual({
      q: "小美", fav: true, categories: ["美妝", "旅遊"], tags: ["日系"], followers: "1k-10k", engagement: "3",
      price: "lt5k", regions: ["台北市"], collabs: ["Reels"], sort: "followers",
    });
  });

  it("讀取 URLSearchParams（Server Action 收到的查詢字串）", () => {
    const q = parseSquareQuery(new URLSearchParams("cat=%E7%BE%8E%E5%A6%9D&cat=3C&sort=price"));
    expect(q).toMatchObject({ categories: ["美妝", "3C"], sort: "price" });
  });

  it("不認得的區間、排序、收藏值當成沒選", () => {
    expect(parseSquareQuery({ followers: "huge", er: "99", price: "free", sort: "drop table", fav: "yes" }))
      .toEqual(EMPTY_SQUARE_QUERY);
  });

  it("清單以外的多選值保留（資料庫比對不到就是沒有結果，不會報錯）", () => {
    expect(parseSquareQuery({ cat: "怪類別", region: "Narnia" })).toMatchObject({ categories: ["怪類別"], regions: ["Narnia"] });
  });

  it("多選值去掉空白、空字串、重複、含雙向控制字元、超過 30 字的；最多 20 個", () => {
    const many = Array.from({ length: 25 }, (_, i) => `t${i}`);
    expect(parseSquareQuery({ tag: [" a ", "", "a", "b‮", "x".repeat(31), ...many] }).tags)
      .toEqual(["a", ...many.slice(0, 19)]);
  });

  it("關鍵字最多 50 字；含雙向控制字元時當成沒填；陣列只取第一個", () => {
    expect(parseSquareQuery({ q: "字".repeat(80) }).q).toBe("字".repeat(50));
    expect(parseSquareQuery({ q: "a‮b" }).q).toBe("");
    expect(parseSquareQuery({ q: ["first", "second"] }).q).toBe("first");
  });
});

describe("serializeSquareQuery / squareHref", () => {
  const full: SquareQuery = {
    q: "小美", fav: true, categories: ["美妝", "旅遊"], tags: ["日系"], followers: "1k-10k", engagement: "3",
    price: "lt5k", regions: ["台北市"], collabs: ["Reels"], sort: "followers",
  };

  it("預設值輸出空字串，網址是 /brand", () => {
    expect(serializeSquareQuery(EMPTY_SQUARE_QUERY)).toBe("");
    expect(squareHref(EMPTY_SQUARE_QUERY)).toBe("/brand");
  });

  it("解析後再輸出會得到相同的查詢（可以分享、重新整理）", () => {
    const s = serializeSquareQuery(full);
    expect(parseSquareQuery(new URLSearchParams(s))).toEqual(full);
    expect(squareHref(full)).toBe(`/brand?${s}`);
  });

  it("排序是 newest 時不寫進網址；收藏寫成 fav=1", () => {
    expect(serializeSquareQuery({ ...EMPTY_SQUARE_QUERY, fav: true })).toBe("fav=1");
    expect(serializeSquareQuery({ ...EMPTY_SQUARE_QUERY, sort: "price" })).toBe("sort=price");
  });
});

describe("activeFilterCount / clearFilters / toggleValue / emptyStateOf", () => {
  it("計算有幾個欄位在篩選（排序不算）", () => {
    expect(activeFilterCount(EMPTY_SQUARE_QUERY)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_SQUARE_QUERY, sort: "price" })).toBe(0);
    expect(activeFilterCount({ ...EMPTY_SQUARE_QUERY, q: "a", fav: true, categories: ["美妝", "旅遊"], price: "lt5k" })).toBe(4);
  });

  it("清除篩選保留排序", () => {
    expect(clearFilters({ ...EMPTY_SQUARE_QUERY, q: "a", regions: ["台北市"], sort: "engagement" }))
      .toEqual({ ...EMPTY_SQUARE_QUERY, sort: "engagement" });
  });

  it("toggleValue 加入或移除", () => {
    expect(toggleValue(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
  });

  it("只開了「只看收藏」時是 no-favorites，其他都是 no-results", () => {
    expect(emptyStateOf({ ...EMPTY_SQUARE_QUERY, fav: true })).toBe("no-favorites");
    expect(emptyStateOf({ ...EMPTY_SQUARE_QUERY, fav: true, sort: "price" })).toBe("no-favorites");
    expect(emptyStateOf({ ...EMPTY_SQUARE_QUERY, fav: true, q: "a" })).toBe("no-results");
    expect(emptyStateOf(EMPTY_SQUARE_QUERY)).toBe("no-results");
  });
});

describe("toSearchArgs", () => {
  it("沒有篩選時只帶排序與分頁", () => {
    expect(toSearchArgs(EMPTY_SQUARE_QUERY, 0)).toEqual({ p_sort: "newest", p_limit: 24, p_offset: 0 });
  });

  it("區間轉成含下限、不含上限的數字", () => {
    expect(toSearchArgs({ ...EMPTY_SQUARE_QUERY, followers: "lt1k", price: "gte20k" }, 24)).toEqual({
      p_sort: "newest", p_limit: 24, p_offset: 24, p_follower_max: 1000, p_price_min: 20000,
    });
    expect(toSearchArgs({ ...EMPTY_SQUARE_QUERY, followers: "10k-100k", price: "5k-20k", engagement: "5" }, 0)).toMatchObject({
      p_follower_min: 10000, p_follower_max: 100000, p_price_min: 5000, p_price_max: 20000, p_engagement_min: 5,
    });
  });

  it("全部欄位", () => {
    expect(toSearchArgs({
      q: "mei", fav: true, categories: ["美妝"], tags: ["日系"], followers: null, engagement: null, price: null,
      regions: ["台北市"], collabs: ["Reels"], sort: "price",
    }, 48, 12)).toEqual({
      p_sort: "price", p_limit: 12, p_offset: 48, p_keyword: "mei", p_favorites_only: true, p_categories: ["美妝"],
      p_style_tags: ["日系"], p_regions: ["台北市"], p_collab_types: ["Reels"],
    });
  });
});
