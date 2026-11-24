import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from }) }));

import { listOpportunities, loadMyApplications, loadOpportunity } from "./creator";

function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) q[m] = vi.fn(() => q);
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

describe("loadMyApplications", () => {
  it("只讀自己的報名", async () => {
    const q = chain({ data: [], error: null });
    from.mockReturnValue(q);
    expect(await loadMyApplications("c1")).toEqual([]);
    expect(from).toHaveBeenCalledWith("brief_applications");
    expect(q.eq).toHaveBeenCalledWith("creator_id", "c1");
  });
});
