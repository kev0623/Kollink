import { describe, expect, it } from "vitest";
import {
  appendUnique, cardTags, postPriceLabel, startingPriceLabel, toSquareCreator, toSquarePage,
  type SquareCreator, type SquareCreatorRow,
} from "./square-view";

const row: SquareCreatorRow = {
  user_id: "u1", handle: "mei", display_name: "小美", avatar_path: null, region: "台北市", categories: ["美妝"],
  style_tags: null, collab_types: ["IG 貼文"], follower_count: 12000, engagement_rate: "3.50", min_price: 4500,
  post_price: null, portfolio_paths: null, is_favorite: null, created_at: "2026-11-24T00:00:00Z", total_count: 30,
};

const creator = (over: Partial<SquareCreator> = {}): SquareCreator => ({ ...toSquareCreator(row), ...over });

describe("toSquareCreator", () => {
  it("轉成駝峰欄位；null 陣列變空陣列；numeric 字串轉數字；is_favorite 只有 true 才算", () => {
    expect(toSquareCreator(row)).toEqual({
      userId: "u1", handle: "mei", displayName: "小美", avatarPath: null, region: "台北市", categories: ["美妝"],
      styleTags: [], collabTypes: ["IG 貼文"], followerCount: 12000, engagementRate: 3.5, minPrice: 4500,
      postPrice: null, portfolioPaths: [], isFavorite: false,
    });
  });
  it("粉絲數是 null 時當 0", () => {
    expect(toSquareCreator({ ...row, follower_count: null }).followerCount).toBe(0);
  });
});

describe("toSquarePage", () => {
  it("total 取第一列的 total_count；還有下一批時 hasMore 是 true", () => {
    const page = toSquarePage([row, { ...row, user_id: "u2" }], 0);
    expect(page.total).toBe(30);
    expect(page.items.map((c) => c.userId)).toEqual(["u1", "u2"]);
    expect(page.hasMore).toBe(true);
  });
  it("最後一批 hasMore 是 false", () => {
    expect(toSquarePage([{ ...row, total_count: "26" }, row], 24).hasMore).toBe(false);
  });
  it("沒有資料時 total 是 0、沒有下一批", () => {
    expect(toSquarePage([], 0)).toEqual({ items: [], total: 0, hasMore: false });
  });
});

describe("卡片顯示", () => {
  it("標籤最多 3 個，風格標籤優先，不夠再用合作類型補，不重複", () => {
    expect(cardTags(creator({ styleTags: ["日系"], collabTypes: ["IG 貼文", "Reels", "限時動態"] })))
      .toEqual(["日系", "IG 貼文", "Reels"]);
    expect(cardTags(creator({ styleTags: ["a", "b", "c", "d"], collabTypes: ["IG 貼文"] }))).toEqual(["a", "b", "c"]);
    expect(cardTags(creator({ styleTags: ["Reels"], collabTypes: ["Reels"] }))).toEqual(["Reels"]);
  });
  it("起價：沒有報價顯示「洽談」", () => {
    expect(startingPriceLabel(null)).toBe("洽談");
    expect(startingPriceLabel(4500)).toBe("NT$4,500");
    expect(startingPriceLabel(0)).toBe("NT$0");
  });
  it("貼文報價：沒有顯示「—」", () => {
    expect(postPriceLabel(null)).toBe("—");
    expect(postPriceLabel(12000)).toBe("NT$12,000");
  });
});

describe("appendUnique", () => {
  it("接在後面並去掉已經顯示過的人", () => {
    const a = creator({ userId: "a" });
    const b = creator({ userId: "b" });
    const c = creator({ userId: "c" });
    expect(appendUnique([a, b], [b, c]).map((x) => x.userId)).toEqual(["a", "b", "c"]);
  });
});
