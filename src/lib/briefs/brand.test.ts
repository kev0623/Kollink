import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from }) }));

import { loadApplicants, loadMyBriefs, loadOwnBrief } from "./brand";

/** 模擬 supabase-js 的鏈式查詢：每個方法回傳自己，await 時得到 result。 */
function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) q[m] = vi.fn(() => q);
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

describe("loadMyBriefs", () => {
  it("只讀自己的，再查人數", async () => {
    const q = chain({ data: [row], error: null });
    from.mockReturnValue(q);
    rpc.mockResolvedValue({ data: [{ brief_id: "b1", applicant_count: 2, pending_count: 1 }], error: null });
    const list = await loadMyBriefs("u1");
    expect(from).toHaveBeenCalledWith("briefs");
    expect(q.eq).toHaveBeenCalledWith("brand_id", "u1");
    expect(rpc).toHaveBeenCalledWith("brief_application_counts", { p_ids: ["b1"] });
    expect(list[0]).toMatchObject({ id: "b1", applicantCount: 2, pendingCount: 1 });
  });
  it("沒有招募時不查人數", async () => {
    from.mockReturnValue(chain({ data: [], error: null }));
    expect(await loadMyBriefs("u1")).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("錯誤時丟出", async () => {
    from.mockReturnValue(chain({ data: null, error: { message: "boom" } }));
    await expect(loadMyBriefs("u1")).rejects.toEqual({ message: "boom" });
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

describe("loadApplicants", () => {
  it("呼叫 list_brief_applicants", async () => {
    rpc.mockResolvedValue({ data: [{ id: "a1", creator_id: "c1", handle: "mei", display_name: "小美", avatar_path: null,
      follower_count: 10, engagement_rate: null, region: null, message: null, proposed_price_twd: null, status: "applied",
      created_at: "t" }], error: null });
    expect(await loadApplicants("b1")).toMatchObject([{ id: "a1", status: "applied" }]);
    expect(rpc).toHaveBeenCalledWith("list_brief_applicants", { p_brief_id: "b1" });
  });
});
