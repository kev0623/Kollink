import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { loadPopularStyleTags, searchSquare } from "./square";
import { EMPTY_SQUARE_QUERY } from "./square-query";

const row = {
  user_id: "u1", handle: "mei", display_name: "小美", avatar_path: null, region: "台北市", categories: ["美妝"],
  style_tags: [], collab_types: [], follower_count: 100, engagement_rate: null, min_price: null, post_price: null,
  portfolio_paths: [], is_favorite: true, created_at: "2026-11-24T00:00:00Z", total_count: 1,
};

beforeEach(() => rpc.mockReset());

describe("searchSquare", () => {
  it("把查詢轉成 search_creators 參數並轉換結果", async () => {
    rpc.mockResolvedValue({ data: [row], error: null });
    const page = await searchSquare({ ...EMPTY_SQUARE_QUERY, categories: ["美妝"] }, 24);
    expect(rpc).toHaveBeenCalledWith("search_creators", { p_sort: "newest", p_limit: 24, p_offset: 24, p_categories: ["美妝"] });
    expect(page.items[0]).toMatchObject({ userId: "u1", isFavorite: true });
  });
  it("預設 offset 是 0；沒有資料時是空的", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await searchSquare(EMPTY_SQUARE_QUERY)).toEqual({ items: [], total: 0, hasMore: false });
    expect(rpc).toHaveBeenCalledWith("search_creators", { p_sort: "newest", p_limit: 24, p_offset: 0 });
  });
  it("資料庫錯誤時丟出", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(searchSquare(EMPTY_SQUARE_QUERY)).rejects.toEqual({ message: "boom" });
  });
});

describe("loadPopularStyleTags", () => {
  it("回傳標籤文字，去掉 null", async () => {
    rpc.mockResolvedValue({ data: [{ tag: "日系", uses: 3 }, { tag: null, uses: 1 }], error: null });
    expect(await loadPopularStyleTags()).toEqual(["日系"]);
    expect(rpc).toHaveBeenCalledWith("popular_style_tags");
  });
  it("資料庫錯誤時丟出", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(loadPopularStyleTags()).rejects.toEqual({ message: "boom" });
  });
});
