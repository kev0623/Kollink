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
    from.mockReturnValue(subsQuery([
      { id: "s1", round: 1, note: null, links: [], file_paths: [FILE], created_at: "2026-11-25T01:00:00Z" },
    ]));
    createSignedUrls.mockResolvedValue({ data: [{ path: FILE, signedUrl: "https://signed/x", error: null }], error: null });
    const d = await loadCollabDetail(ID);
    expect(createSignedUrls).toHaveBeenCalledWith([FILE], 3600);
    expect(d?.collab).toMatchObject({ id: ID, side: "brand", amount: 4500 });
    expect(d?.submissions[0]).toMatchObject({
      round: 1, revisionNotes: ["亮一點"], files: [{ path: FILE, kind: "pdf", label: "PDF 1", url: "https://signed/x" }],
    });
  });
  it("沒有檔案時不簽 URL", async () => {
    rpc.mockImplementation(async (fn: string) => fn === "get_collaboration"
      ? { data: [{ id: ID, status: "awaiting_submission", my_side: "creator" }], error: null }
      : { data: [], error: null });
    from.mockReturnValue(subsQuery([]));
    const d = await loadCollabDetail(ID);
    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(d?.submissions).toEqual([]);
  });
});
