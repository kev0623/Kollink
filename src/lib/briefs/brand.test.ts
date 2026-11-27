import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from }) }));

import { loadApplicantsPage, loadMyBriefsPage, loadOwnBrief } from "./brand";

/** 模擬 supabase-js 的鏈式查詢：每個方法回傳自己，await 時得到 result。 */
function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "order", "range", "limit"]) q[m] = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => result);
  q.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

const row = {
  id: "b1", brand_id: "u1", title: "x", description: null, collab_types: null, categories: null, min_followers: null,
  region: null, budget_min_twd: null, budget_max_twd: null, includes_product: null, deadline: null, cover_path: null,
  status: "draft", published_at: null, created_at: "2026-11-24T00:00:00Z",
};

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

describe("loadMyBriefsPage", () => {
  const TODAY = "2026-11-27";
  /** from() 依呼叫順序回傳：這一頁、發佈中數、草稿數、已結束數 */
  function mockQueries(page: unknown, counts: [number, number, number] = [3, 1, 25]) {
    const qs = [chain(page), ...counts.map((count) => chain({ count, error: null }))];
    qs.forEach((q) => from.mockReturnValueOnce(q));
    return qs;
  }

  it("只讀自己的、依分頁條件與頁數取範圍，再查這一頁的人數", async () => {
    const [q] = mockQueries({ data: [row], error: null });
    rpc.mockResolvedValue({ data: [{ brief_id: "b1", applicant_count: 2, pending_count: 1 }], error: null });
    const res = await loadMyBriefsPage("u1", "ended", 2, TODAY);
    expect(from).toHaveBeenCalledWith("briefs");
    expect(q.eq).toHaveBeenCalledWith("brand_id", "u1");
    expect(q.or).toHaveBeenCalledWith("status.eq.closed,and(status.eq.open,deadline.lt.2026-11-27)");
    expect(q.range).toHaveBeenCalledWith(20, 39);
    expect(q.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: false });
    expect(q.order).toHaveBeenNthCalledWith(2, "id");
    expect(rpc).toHaveBeenCalledWith("brief_application_counts", { p_ids: ["b1"] });
    expect(res.items[0]).toMatchObject({ id: "b1", applicantCount: 2, pendingCount: 1 });
    expect(res.counts).toEqual({ open: 3, draft: 1, ended: 25 });
  });
  it("三個分頁的數量各用自己的條件，只數不取資料", async () => {
    const [, open, draft, ended] = mockQueries({ data: [], error: null });
    await loadMyBriefsPage("u1", "open", 1, TODAY);
    for (const q of [open, draft, ended]) expect(q.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(open.eq).toHaveBeenCalledWith("status", "open");
    expect(open.or).toHaveBeenCalledWith("deadline.is.null,deadline.gte.2026-11-27");
    expect(draft.eq).toHaveBeenCalledWith("status", "draft");
    expect(draft.or).not.toHaveBeenCalled();
    expect(ended.or).toHaveBeenCalledWith("status.eq.closed,and(status.eq.open,deadline.lt.2026-11-27)");
  });
  it("這一頁沒有招募時不查人數，仍回傳各分頁數量", async () => {
    mockQueries({ data: [], error: null }, [0, 0, 0]);
    expect(await loadMyBriefsPage("u1", "open", 1, TODAY)).toEqual({ items: [], counts: { open: 0, draft: 0, ended: 0 } });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("任何一個查詢出錯就丟出", async () => {
    mockQueries({ data: null, error: { message: "boom" } });
    await expect(loadMyBriefsPage("u1", "open", 1, TODAY)).rejects.toEqual({ message: "boom" });
    from.mockReset();
    [chain({ data: [], error: null }), chain({ count: 1, error: null }), chain({ count: null, error: { message: "count" } }), chain({ count: 1, error: null })]
      .forEach((q) => from.mockReturnValueOnce(q));
    await expect(loadMyBriefsPage("u1", "open", 1, TODAY)).rejects.toEqual({ message: "count" });
  });
  it("日期格式不對時不送查詢", async () => {
    from.mockReturnValue(chain({ data: [], error: null }));
    await expect(loadMyBriefsPage("u1", "open", 1, "today")).rejects.toThrow("invalid date");
  });
});

describe("loadOwnBrief", () => {
  it("找不到回傳 null；找到轉成 Brief", async () => {
    from.mockReturnValue(chain({ data: null, error: null }));
    expect(await loadOwnBrief("u1", "b1")).toBeNull();
    const q = chain({ data: row, error: null });
    from.mockReturnValue(q);
    expect(await loadOwnBrief("u1", "b1")).toMatchObject({ id: "b1", title: "x" });
    expect(q.eq).toHaveBeenCalledWith("brand_id", "u1");
  });
});

describe("loadApplicantsPage", () => {
  const applicant = { id: "a1", creator_id: "c1", handle: "mei", display_name: "小美", avatar_path: null,
    follower_count: 10, engagement_rate: null, region: null, message: null, proposed_price_twd: null, status: "applied",
    created_at: "t" };
  function mockRpc(list: unknown, counts: unknown) {
    rpc.mockImplementation(async (name: string) => (name === "list_brief_applicants_page" ? list : counts));
  }

  it("取這一頁與各狀態人數", async () => {
    mockRpc({ data: [applicant], error: null },
      { data: [{ all_count: "45", applied_count: 30, accepted_count: 5, rejected_count: 8 }], error: null });
    const res = await loadApplicantsPage("b1", "applied", 3);
    expect(rpc).toHaveBeenCalledWith("list_brief_applicants_page", { p_brief_id: "b1", p_status: "applied", p_limit: 20, p_offset: 40 });
    expect(rpc).toHaveBeenCalledWith("brief_applicant_status_counts", { p_brief_id: "b1" });
    expect(res.items).toMatchObject([{ id: "a1", status: "applied" }]);
    expect(res.counts).toEqual({ all: 45, applied: 30, accepted: 5, rejected: 8 });
  });
  it("「全部」不帶狀態", async () => {
    mockRpc({ data: [], error: null }, { data: [], error: null });
    const res = await loadApplicantsPage("b1", "all", 1);
    expect(rpc).toHaveBeenCalledWith("list_brief_applicants_page", { p_brief_id: "b1", p_status: undefined, p_limit: 20, p_offset: 0 });
    expect(res).toEqual({ items: [], counts: { all: 0, applied: 0, accepted: 0, rejected: 0 } });
  });
  it("任何一個出錯就丟出", async () => {
    mockRpc({ data: null, error: { message: "list" } }, { data: [], error: null });
    await expect(loadApplicantsPage("b1", "all", 1)).rejects.toEqual({ message: "list" });
    mockRpc({ data: [], error: null }, { data: null, error: { message: "counts" } });
    await expect(loadApplicantsPage("b1", "all", 1)).rejects.toEqual({ message: "counts" });
  });
});
