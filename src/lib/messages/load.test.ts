import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from }) }));

import { loadMyConversations, loadOlderMessages, loadThread } from "./load";

const ID = "00000000-0000-0000-0000-00000008c001";

function collabsQuery(data: unknown[]) {
  const q = { select: () => q, eq: () => q, order: async () => ({ data, error: null }) };
  return q;
}
const row = (n: number) => ({
  id: `m${n}`, sender_id: "u", body: `第 ${n} 則`, flagged_contact: false,
  created_at: new Date(Date.UTC(2026, 10, 26, 0, n)).toISOString(),
});

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

describe("loadMyConversations", () => {
  it("呼叫 list_my_conversations 並轉成顯示物件", async () => {
    rpc.mockResolvedValue({ data: [{ id: "c1", my_side: "creator", counterpart_name: "花粉", unread_count: 2 }], error: null });
    const items = await loadMyConversations();
    expect(rpc).toHaveBeenCalledWith("list_my_conversations");
    expect(items[0]).toMatchObject({ id: "c1", side: "creator", counterpartName: "花粉", unread: 2 });
  });
  it("錯誤往上丟", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(loadMyConversations()).rejects.toThrow("boom");
  });
});

describe("loadThread", () => {
  it("看不到時回傳 null，不再查其他資料", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await loadThread(ID)).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });
  it("第一頁多拿一則判斷 hasMore，回傳由舊到新；帶出合作案", async () => {
    // list_messages 由新到舊回傳 51 則（m51 … m1）
    const rows = Array.from({ length: 51 }, (_, i) => row(51 - i));
    rpc.mockImplementation(async (fn: string) => fn === "get_conversation"
      ? { data: [{ id: ID, my_side: "brand", creator_name: "小美", closed: false }], error: null }
      : { data: rows, error: null });
    from.mockReturnValue(collabsQuery([{ id: "k1", title: "春季開箱", status: "in_review" }]));
    const d = await loadThread(ID);
    expect(rpc).toHaveBeenCalledWith("list_messages", { p_conversation_id: ID, p_limit: 51 });
    expect(from).toHaveBeenCalledWith("collaborations");
    expect(d?.conversation).toMatchObject({ id: ID, side: "brand", creatorName: "小美" });
    expect(d?.hasMore).toBe(true);
    expect(d?.messages).toHaveLength(50);
    expect(d?.messages[0].id).toBe("m2");
    expect(d?.messages[49].id).toBe("m51");
    expect(d?.collabs).toEqual([{ id: "k1", title: "春季開箱", status: "in_review" }]);
  });
});

describe("loadOlderMessages", () => {
  it("帶游標呼叫、不足一頁時 hasMore 為 false", async () => {
    rpc.mockResolvedValue({ data: [row(2), row(1)], error: null });
    const page = await loadOlderMessages(ID, "2026-11-26T00:03:00.000Z", "m3");
    expect(rpc).toHaveBeenCalledWith("list_messages", {
      p_conversation_id: ID, p_limit: 51, p_before_at: "2026-11-26T00:03:00.000Z", p_before_id: "m3",
    });
    expect(page).toEqual({ hasMore: false, messages: [expect.objectContaining({ id: "m1" }), expect.objectContaining({ id: "m2" })] });
  });
});
