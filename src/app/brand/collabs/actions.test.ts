import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, rpc, revalidatePath, redirect } = vi.hoisted(() => ({
  requireRole: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/current-user", () => ({ requireRole }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { brandCollabAction, inviteCreatorAction } from "./actions";

const CREATOR = "00000000-0000-0000-0000-000000000712";
const COLLAB = "00000000-0000-0000-0000-0000000007e1";

function form(o: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
  return f;
}

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: "brand-1" });
  rpc.mockReset();
  revalidatePath.mockReset();
  redirect.mockClear();
});

describe("inviteCreatorAction", () => {
  it("先檢查是品牌；id 格式不對不碰資料庫", async () => {
    expect(await inviteCreatorAction({}, form({ creatorId: "x" }))).toEqual({ formError: "資料格式不正確，請重新整理頁面" });
    expect(requireRole).toHaveBeenCalledWith("brand");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("欄位錯誤在伺服器再擋一次", async () => {
    expect(await inviteCreatorAction({}, form({ creatorId: CREATOR, title: "", deliverables: "x", amount: "0" })))
      .toEqual({ fieldErrors: { title: "請填寫案名", amount: "請填 1 到 10,000,000 的整數" } });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("成功後導到合作案", async () => {
    rpc.mockResolvedValue({ data: COLLAB, error: null });
    await expect(inviteCreatorAction({}, form({ creatorId: CREATOR, title: " 夏季邀約 ", deliverables: "Reels 1 支", amount: "3,000" })))
      .rejects.toThrow(`REDIRECT /brand/collabs/${COLLAB}`);
    expect(rpc).toHaveBeenCalledWith("invite_creator", {
      p_creator_id: CREATOR, p_title: "夏季邀約", p_deliverables: "Reels 1 支", p_amount_twd: 3000,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/brand/collabs");
  });
  it("資料庫錯誤", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "already invited" } });
    expect(await inviteCreatorAction({}, form({ creatorId: CREATOR, title: "x", deliverables: "x", amount: "1" })))
      .toEqual({ formError: "你已經邀請過這位創作者，請等對方回覆" });
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "invalid deliverables" } });
    expect(await inviteCreatorAction({}, form({ creatorId: CREATOR, title: "x", deliverables: "x", amount: "1" })))
      .toEqual({ fieldErrors: { deliverables: "格式不正確" } });
  });
});

describe("brandCollabAction", () => {
  it("只接受品牌的三個動作", async () => {
    expect(await brandCollabAction(COLLAB, "payout")).toEqual({ ok: false, error: "資料格式不正確，請重新整理頁面" });
    expect(await brandCollabAction("x", "cancel")).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("要求修改：說明必填", async () => {
    expect(await brandCollabAction(COLLAB, "request_changes", "  ")).toEqual({ ok: false, error: "請寫下要修改的地方" });
    expect(await brandCollabAction(COLLAB, "request_changes", 3)).toMatchObject({ ok: false });
    rpc.mockResolvedValue({ data: "awaiting_submission", error: null });
    expect(await brandCollabAction(COLLAB, "request_changes", " 第二張亮一點\r\n謝謝 ")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("transition_collaboration", {
      p_collab_id: COLLAB, p_action: "request_changes", p_note: "第二張亮一點\n謝謝",
    });
  });
  it("通過與取消用使用者自己的 client 呼叫 transition_collaboration", async () => {
    rpc.mockResolvedValue({ data: "awaiting_publish", error: null });
    expect(await brandCollabAction(COLLAB, "approve")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("transition_collaboration", { p_collab_id: COLLAB, p_action: "approve" });
    expect(revalidatePath).toHaveBeenCalledWith(`/creator/collabs/${COLLAB}`);
  });
  it("狀態已變", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "invalid transition: approve from awaiting_publish by brand" } });
    expect(await brandCollabAction(COLLAB, "approve")).toEqual({ ok: false, error: "合作案的狀態已經更新" });
  });
});
