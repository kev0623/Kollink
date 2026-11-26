import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from, createSignedUrls } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), createSignedUrls: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc, from, storage: { from: () => ({ createSignedUrls }) } }),
}));

import { loadCollabDetail, loadMyCollabs } from "./load";

const ID = "00000000-0000-0000-0000-0000000007d1";
const FILE = `${ID}/u1/11111111-1111-4111-8111-111111111111.pdf`;

function subsQuery(data: unknown[]) {
  const q = { select: () => q, eq: () => q, order: async () => ({ data, error: null }) };
  return q;
}

/** from(table)：只剩 collaboration_submissions（付款改走 rpc get_my_payment_details，資料庫不再授權直接讀 ATM 欄位） */
function tables(subs: unknown[]) {
  return (table: string) => {
    if (table === "payments") throw new Error("不可直接讀 payments");
    return subsQuery(subs);
  };
}

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  createSignedUrls.mockReset();
});

describe("loadMyCollabs", () => {
  it("呼叫 list_my_collaborations 並轉成顯示物件", async () => {
    rpc.mockResolvedValue({ data: [{ id: "c1", title: "案", amount_twd: 100, status: "invited", my_side: "brand", my_turn: false }], error: null });
    const items = await loadMyCollabs("active");
    expect(rpc).toHaveBeenCalledWith("list_my_collaborations", { p_tab: "active" });
    expect(items[0]).toMatchObject({ id: "c1", status: "invited", side: "brand", myTurn: false });
  });
  it("錯誤往上丟", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(loadMyCollabs("active")).rejects.toThrow("boom");
  });
});

describe("loadCollabDetail", () => {
  it("看不到時回傳 null，不再查其他資料", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await loadCollabDetail(ID)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
  it("交稿檔案附 signed URL、修改說明掛到對應的那一輪", async () => {
    rpc.mockImplementation(async (fn: string) => fn === "get_collaboration"
      ? { data: [{ id: ID, title: "案", status: "in_review", my_side: "brand", amount_twd: 4500 }], error: null }
      : { data: [{ id: 1, action: "request_changes", actor_kind: "brand", actor_name: "花粉", note: "亮一點", created_at: "2026-11-25T02:00:00Z" }], error: null });
    from.mockImplementation(tables([
      { id: "s1", round: 1, note: null, links: [], file_paths: [FILE], created_at: "2026-11-25T01:00:00Z" },
    ]));
    createSignedUrls.mockResolvedValue({ data: [{ path: FILE, signedUrl: "https://signed/x", error: null }], error: null });
    const d = await loadCollabDetail(ID);
    expect(createSignedUrls).toHaveBeenCalledWith([FILE], 3600);
    expect(d?.collab).toMatchObject({ id: ID, side: "brand", amount: 4500 });
    expect(d?.submissions[0]).toMatchObject({
      round: 1, revisionNotes: ["亮一點"], files: [{ path: FILE, kind: "pdf", label: "第 1 次交稿・PDF 1", url: "https://signed/x" }],
    });
  });
  it("沒有檔案時不簽 URL", async () => {
    rpc.mockImplementation(async (fn: string) => fn === "get_collaboration"
      ? { data: [{ id: ID, status: "awaiting_submission", my_side: "creator" }], error: null }
      : { data: [], error: null });
    from.mockImplementation(tables([]));
    const d = await loadCollabDetail(ID);
    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(d?.submissions).toEqual([]);
  });
  it("付款單經由 get_my_payment_details 讀取（不直接讀 payments 表）", async () => {
    const pay = { status: "pending", payment_method: "atm", atm_v_account: "9103522850" };
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "get_collaboration") return { data: [{ id: ID, status: "awaiting_payment", my_side: "brand" }], error: null };
      if (fn === "get_my_payment_details") return { data: [pay], error: null };
      return { data: [], error: null };
    });
    from.mockImplementation(tables([]));
    const d = await loadCollabDetail(ID);
    expect(rpc).toHaveBeenCalledWith("get_my_payment_details", { p_collab_id: ID });
    expect(d?.payments).toEqual([pay]);
  });
  it("創作者拿到的付款單 ATM 欄位是 null，原樣帶回（摘要不會有轉帳資訊）", async () => {
    const pay = { status: "pending", payment_method: "atm", atm_bank_code: null, atm_v_account: null, atm_expire_date: null };
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "get_collaboration") return { data: [{ id: ID, status: "awaiting_payment", my_side: "creator" }], error: null };
      if (fn === "get_my_payment_details") return { data: [pay], error: null };
      return { data: [], error: null };
    });
    from.mockImplementation(tables([]));
    expect((await loadCollabDetail(ID))?.payments[0]).toMatchObject({ atm_v_account: null });
  });
  it("付款單讀取失敗往上丟", async () => {
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "get_collaboration") return { data: [{ id: ID, status: "awaiting_payment", my_side: "brand" }], error: null };
      if (fn === "get_my_payment_details") return { data: null, error: new Error("denied") };
      return { data: [], error: null };
    });
    from.mockImplementation(tables([]));
    await expect(loadCollabDetail(ID)).rejects.toThrow("denied");
  });
});

describe("loadMyCollabsForTotals", () => {
  it("合併進行中與已完成兩個分頁；滿 200 筆時標記可能被截斷", async () => {
    const { loadMyCollabsForTotals } = await import("./load");
    const row = (i: number, status: string) => ({ id: `id-${i}`, title: "t", amount_twd: 1, status, updated_at: "2026-11-01T00:00:00Z", my_side: "creator" });
    rpc.mockImplementation(async (_n: string, a: { p_tab: string }) => ({
      data: a.p_tab === "completed" ? Array.from({ length: 200 }, (_, i) => row(i, "completed")) : [row(999, "invited")], error: null,
    }));
    const r = await loadMyCollabsForTotals();
    expect(r.items).toHaveLength(201);
    expect(r.maybeTruncated).toBe(true);
    rpc.mockImplementation(async () => ({ data: [], error: null }));
    expect((await loadMyCollabsForTotals()).maybeTruncated).toBe(false);
  });
});
