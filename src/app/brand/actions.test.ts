import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, from, searchSquare } = vi.hoisted(() => ({
  requireRole: vi.fn(), from: vi.fn(), searchSquare: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/current-user", () => ({ requireRole }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from }) }));
vi.mock("@/lib/creators/square", () => ({ searchSquare }));

import { loadMoreCreatorsAction, setFavoriteAction } from "./actions";
import { EMPTY_SQUARE_QUERY } from "@/lib/creators/square-query";

const CREATOR = "00000000-0000-0000-0000-0000000000c1";

/** 模擬 supabase-js 的鏈式查詢：每個方法回傳自己，await 時得到 result。 */
function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["insert", "delete", "eq"]) q[m] = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: "brand-1" });
  from.mockReset();
  searchSquare.mockReset();
});

describe("setFavoriteAction", () => {
  it("一定先檢查是品牌", async () => {
    from.mockReturnValue(chain({ error: null }));
    await setFavoriteAction(CREATOR, true);
    expect(requireRole).toHaveBeenCalledWith("brand");
  });
  it("參數格式不對時不碰資料庫", async () => {
    expect(await setFavoriteAction("not-a-uuid", true)).toEqual({ ok: false, error: "資料格式不正確，請重新整理頁面" });
    expect(await setFavoriteAction(CREATOR, "yes")).toMatchObject({ ok: false });
    expect(await setFavoriteAction(123, true)).toMatchObject({ ok: false });
    expect(from).not.toHaveBeenCalled();
  });
  it("收藏：以自己的身分新增", async () => {
    const q = chain({ error: null });
    from.mockReturnValue(q);
    expect(await setFavoriteAction(CREATOR, true)).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("creator_favorites");
    expect(q.insert).toHaveBeenCalledWith({ brand_id: "brand-1", creator_id: CREATOR });
  });
  it("已經收藏過（23505）視為成功", async () => {
    from.mockReturnValue(chain({ error: { code: "23505", message: "duplicate" } }));
    expect(await setFavoriteAction(CREATOR, true)).toEqual({ ok: true });
  });
  it("其他錯誤回傳錯誤訊息", async () => {
    from.mockReturnValue(chain({ error: { code: "23503", message: "fk" } }));
    expect(await setFavoriteAction(CREATOR, true)).toEqual({ ok: false, error: "收藏失敗，請稍後再試" });
  });
  it("取消收藏：只刪自己的那一筆", async () => {
    const q = chain({ error: null });
    from.mockReturnValue(q);
    expect(await setFavoriteAction(CREATOR, false)).toEqual({ ok: true });
    expect(q.delete).toHaveBeenCalled();
    expect(q.eq).toHaveBeenCalledWith("brand_id", "brand-1");
    expect(q.eq).toHaveBeenCalledWith("creator_id", CREATOR);
  });
  it("取消收藏失敗回傳錯誤訊息", async () => {
    from.mockReturnValue(chain({ error: { code: "XX000", message: "boom" } }));
    expect(await setFavoriteAction(CREATOR, false)).toEqual({ ok: false, error: "取消收藏失敗，請稍後再試" });
  });
});

describe("loadMoreCreatorsAction", () => {
  it("在伺服器重新解析查詢字串，回傳下一批", async () => {
    const item = { userId: "u1" };
    searchSquare.mockResolvedValue({ items: [item], total: 30, hasMore: true });
    expect(await loadMoreCreatorsAction("cat=%E7%BE%8E%E5%A6%9D&sort=price&bogus=1", 24))
      .toEqual({ ok: true, items: [item], hasMore: true });
    expect(requireRole).toHaveBeenCalledWith("brand");
    expect(searchSquare).toHaveBeenCalledWith({ ...EMPTY_SQUARE_QUERY, categories: ["美妝"], sort: "price" }, 24);
  });
  it("參數格式不對時不查詢", async () => {
    for (const [q, o] of [[1, 0], ["", -1], ["", 1.5], ["", "24"], ["", 10001], ["x".repeat(4001), 0]] as const) {
      expect(await loadMoreCreatorsAction(q, o)).toEqual({ ok: false, error: "資料格式不正確，請重新整理頁面" });
    }
    expect(searchSquare).not.toHaveBeenCalled();
  });
  it("查詢失敗回傳錯誤訊息，不丟出", async () => {
    searchSquare.mockRejectedValue(new Error("boom"));
    expect(await loadMoreCreatorsAction("", 24)).toEqual({ ok: false, error: "載入失敗，請稍後再試" });
  });
});
