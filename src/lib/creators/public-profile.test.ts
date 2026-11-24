import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from, anonRpc } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), anonRpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from }) }));
vi.mock("@/lib/supabase/anon", () => ({ createAnonClient: () => ({ rpc: anonRpc }) }));

import { loadApprovedCreatorAsGuest, loadIsFavorite, loadPortfolio, loadPublicCreator, loadRates } from "./public-profile";

/** 模擬 supabase-js 的鏈式查詢：每個方法回傳自己，await 時得到 result。 */
function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "maybeSingle", "single"]) q[m] = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

const row = {
  user_id: "u1", handle: "mei", display_name: "小美", avatar_path: null, region: "台北市", categories: ["美妝"],
  follower_count: 12000, engagement_rate: 3.5, audience_age: null, style_tags: [], collab_types: ["Reels", "IG 貼文"],
  bio: null, status: "approved", is_self: false,
};

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  anonRpc.mockReset();
});

describe("loadPublicCreator", () => {
  it("handle 格式不對時不查資料庫", async () => {
    expect(await loadPublicCreator("Bad Handle")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("查到時轉成 PublicCreator", async () => {
    rpc.mockReturnValue(chain({ data: row, error: null }));
    expect(await loadPublicCreator("mei")).toMatchObject({ userId: "u1", displayName: "小美", status: "approved", isSelf: false });
    expect(rpc).toHaveBeenCalledWith("get_public_creator", { p_handle: "mei" });
  });
  it("查不到回傳 null", async () => {
    rpc.mockReturnValue(chain({ data: null, error: null }));
    expect(await loadPublicCreator("nobody")).toBeNull();
  });
  it("資料庫錯誤時丟出", async () => {
    rpc.mockReturnValue(chain({ data: null, error: { message: "boom" } }));
    await expect(loadPublicCreator("mei")).rejects.toEqual({ message: "boom" });
  });
});

describe("loadApprovedCreatorAsGuest", () => {
  it("用訪客 client 查詢，不用使用者的 session", async () => {
    anonRpc.mockReturnValue(chain({ data: row, error: null }));
    expect(await loadApprovedCreatorAsGuest("mei")).toMatchObject({ handle: "mei" });
    expect(anonRpc).toHaveBeenCalledWith("get_public_creator", { p_handle: "mei" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("handle 格式不對時不查資料庫", async () => {
    expect(await loadApprovedCreatorAsGuest("../x")).toBeNull();
    expect(anonRpc).not.toHaveBeenCalled();
  });
});

describe("loadPortfolio", () => {
  it("依 position 排序並轉換欄位", async () => {
    const q = chain({ data: [{ image_path: "u1/portfolio-a.jpg", link_url: null }], error: null });
    from.mockReturnValue(q);
    expect(await loadPortfolio("u1")).toEqual([{ imagePath: "u1/portfolio-a.jpg", linkUrl: null }]);
    expect(from).toHaveBeenCalledWith("creator_portfolio_items");
    expect(q.eq).toHaveBeenCalledWith("creator_id", "u1");
    expect(q.order).toHaveBeenCalledWith("position");
  });
});

describe("loadRates", () => {
  it("依想接的合作順序排列", async () => {
    from.mockReturnValue(chain({
      data: [{ collab_type: "IG 貼文", price_twd: 4500 }, { collab_type: "Reels", price_twd: 8000 }], error: null,
    }));
    expect(await loadRates("u1", ["Reels", "IG 貼文"])).toEqual([
      { collabType: "Reels", priceTwd: 8000 }, { collabType: "IG 貼文", priceTwd: 4500 },
    ]);
    expect(from).toHaveBeenCalledWith("creator_rates");
  });
});

describe("loadIsFavorite", () => {
  it("查得到收藏是 true（RLS 只讓品牌看到自己的收藏）", async () => {
    const q = chain({ data: { creator_id: "u1" }, error: null });
    from.mockReturnValue(q);
    expect(await loadIsFavorite("u1")).toBe(true);
    expect(from).toHaveBeenCalledWith("creator_favorites");
    expect(q.eq).toHaveBeenCalledWith("creator_id", "u1");
  });
  it("查不到是 false", async () => {
    from.mockReturnValue(chain({ data: null, error: null }));
    expect(await loadIsFavorite("u1")).toBe(false);
  });
  it("資料庫錯誤時丟出", async () => {
    from.mockReturnValue(chain({ data: null, error: { message: "boom" } }));
    await expect(loadIsFavorite("u1")).rejects.toEqual({ message: "boom" });
  });
});
