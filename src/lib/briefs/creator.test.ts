import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from }) }));

import { listOpportunities, loadMyApplicationsPage, loadOpportunity } from "./creator";

function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "range", "limit"]) q[m] = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

describe("listOpportunities", () => {
  it("把查詢轉成參數", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await listOpportunities({ tab: "category", category: "美妝" }, 20)).toEqual({ items: [], total: 0, hasMore: false });
    expect(rpc).toHaveBeenCalledWith("list_opportunities", { p_filter: "category", p_category: "美妝", p_limit: 20, p_offset: 20 });
  });
  it("offset 超過結尾（0 列、沒有 total_count）：沒有更多", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await listOpportunities({ tab: "all", category: null }, 400)).toEqual({ items: [], total: 0, hasMore: false });
  });
  it("錯誤時丟出", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(listOpportunities({ tab: "match", category: null })).rejects.toEqual({ message: "boom" });
  });
});

describe("loadOpportunity", () => {
  it("沒有列時回傳 null", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await loadOpportunity("b1")).toBeNull();
    expect(rpc).toHaveBeenCalledWith("get_opportunity", { p_id: "b1" });
  });
});

describe("loadMyApplicationsPage", () => {
  it("只讀自己的報名，依頁數取範圍並回傳總筆數", async () => {
    const q = chain({ data: [], error: null, count: 57 });
    from.mockReturnValue(q);
    expect(await loadMyApplicationsPage("c1", 3)).toEqual({ items: [], total: 57 });
    expect(from).toHaveBeenCalledWith("brief_applications");
    expect(q.select).toHaveBeenCalledWith(expect.any(String), { count: "exact" });
    expect(q.eq).toHaveBeenCalledWith("creator_id", "c1");
    expect(q.range).toHaveBeenCalledWith(40, 59);
    expect(q.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: false });
    expect(q.order).toHaveBeenNthCalledWith(2, "id");
  });
  it("頁數超過最後一頁（PostgREST 回 PGRST103）：改成只數筆數，回傳空的這一頁", async () => {
    from.mockReturnValueOnce(chain({ data: null, error: { code: "PGRST103", message: "Requested range not satisfiable" }, count: null }));
    const head = chain({ count: 40, error: null });
    from.mockReturnValueOnce(head);
    expect(await loadMyApplicationsPage("c1", 7)).toEqual({ items: [], total: 40 });
    expect(head.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(head.eq).toHaveBeenCalledWith("creator_id", "c1");
  });
  it("沒有總筆數時當成 0；錯誤時丟出", async () => {
    from.mockReturnValue(chain({ data: [], error: null, count: null }));
    expect(await loadMyApplicationsPage("c1", 1)).toEqual({ items: [], total: 0 });
    from.mockReturnValue(chain({ data: null, error: { message: "boom" }, count: null }));
    await expect(loadMyApplicationsPage("c1", 1)).rejects.toEqual({ message: "boom" });
  });
});
