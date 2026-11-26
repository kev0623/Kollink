import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, rpc, redirect } = vi.hoisted(() => ({
  requireRole: vi.fn(), rpc: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/current-user", () => ({ requireRole }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { startConversationAction } from "./actions";

const CREATOR = "00000000-0000-0000-0000-000000000811";
const CONV = "00000000-0000-0000-0000-00000008c001";

function form(o: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
  return f;
}

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: "brand-1" });
  rpc.mockReset();
  redirect.mockClear();
});

describe("startConversationAction", () => {
  it("開啟對話後導到對話頁", async () => {
    rpc.mockResolvedValue({ data: CONV, error: null });
    await expect(startConversationAction({}, form({ creatorId: CREATOR }))).rejects.toThrow(`REDIRECT /brand/messages/${CONV}`);
    expect(requireRole).toHaveBeenCalledWith("brand");
    expect(rpc).toHaveBeenCalledWith("start_conversation", { p_creator_id: CREATOR });
  });
  it("creatorId 不是 UUID 不呼叫資料庫", async () => {
    expect(await startConversationAction({}, form({ creatorId: "x" }))).toEqual({ error: "資料格式不正確，請重新整理頁面" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("資料庫錯誤轉成中文", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "creator not found" } });
    expect(await startConversationAction({}, form({ creatorId: CREATOR }))).toEqual({ error: "找不到這位創作者，或對方還沒通過審核" });
    expect(redirect).not.toHaveBeenCalled();
  });
});
