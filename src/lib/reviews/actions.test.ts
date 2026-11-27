import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, getCurrentUser, revalidatePath } = vi.hoisted(() => ({ rpc: vi.fn(), getCurrentUser: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { submitReviewAction } from "./actions";

const ID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  rpc.mockReset();
  revalidatePath.mockReset();
  getCurrentUser.mockReset().mockResolvedValue({ id: "u1" });
});

describe("submitReviewAction", () => {
  it("沒有登入：不呼叫資料庫", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await submitReviewAction(ID, 5, "")).toEqual({ ok: false, error: "登入已逾時，請重新登入" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("格式不對：不呼叫資料庫", async () => {
    expect((await submitReviewAction("x", 5, "")).ok).toBe(false);
    expect((await submitReviewAction(ID, 5, 123)).ok).toBe(false);
    expect(await submitReviewAction(ID, 0, "")).toEqual({ ok: false, error: "請選擇星數" });
    expect(await submitReviewAction(ID, "5", "")).toEqual({ ok: false, error: "請選擇星數" });
    expect((await submitReviewAction(ID, 5, "找我 a@b.com")).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("沒有文字：不傳 p_comment", async () => {
    rpc.mockResolvedValue({ error: null });
    expect(await submitReviewAction(ID, 4, "   ")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("submit_collaboration_review", { p_collab_id: ID, p_rating: 4 });
    expect(revalidatePath).toHaveBeenCalledWith(`/brand/collabs/${ID}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/creator/collabs/${ID}`);
  });
  it("有文字：清理後傳入", async () => {
    rpc.mockResolvedValue({ error: null });
    await submitReviewAction(ID, 5, "  準時交稿\r\n很順利  ");
    expect(rpc).toHaveBeenCalledWith("submit_collaboration_review", { p_collab_id: ID, p_rating: 5, p_comment: "準時交稿\n很順利" });
  });
  it("資料庫錯誤轉成中文；已經寫過標成 stale 並重新整理", async () => {
    rpc.mockResolvedValue({ error: { code: "55000", message: "review window closed" } });
    const closed = await submitReviewAction(ID, 5, "");
    expect(closed).toEqual({ ok: false, error: expect.stringContaining("14") });
    expect(revalidatePath).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ error: { code: "55000", message: "already reviewed" } });
    expect(await submitReviewAction(ID, 5, "")).toEqual({ ok: false, error: "你已經評價過了", stale: true });
    expect(revalidatePath).toHaveBeenCalled();
  });
});
