import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, rpc, listOpportunities, revalidatePath } = vi.hoisted(() => ({
  requireRole: vi.fn(), rpc: vi.fn(), listOpportunities: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/current-user", () => ({ requireRole }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
vi.mock("@/lib/briefs/creator", () => ({ listOpportunities }));

import { applyToBriefAction, loadMoreOpportunitiesAction, withdrawApplicationAction } from "./actions";

const BRIEF = "00000000-0000-0000-0000-00000006f001";
const APP = "00000000-0000-0000-0000-00000006a001";

function form(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: "c1", creator: { status: "approved" } });
  rpc.mockReset();
  listOpportunities.mockReset();
  revalidatePath.mockReset();
});

describe("loadMoreOpportunitiesAction", () => {
  it("在伺服器重新解析查詢字串", async () => {
    listOpportunities.mockResolvedValue({ items: [{ id: "o1" }], total: 30, hasMore: true });
    expect(await loadMoreOpportunitiesAction("cat=%E7%BE%8E%E5%A6%9D&bogus=1", 20)).toEqual({ ok: true, items: [{ id: "o1" }], hasMore: true });
    expect(requireRole).toHaveBeenCalledWith("creator");
    expect(listOpportunities).toHaveBeenCalledWith({ tab: "category", category: "美妝" }, 20);
  });
  it("空的一頁視為沒有更多", async () => {
    listOpportunities.mockResolvedValue({ items: [], total: 0, hasMore: false });
    expect(await loadMoreOpportunitiesAction("", 400)).toEqual({ ok: true, items: [], hasMore: false });
  });
  it("參數格式不對、或是「我的報名」時不查詢", async () => {
    expect(await loadMoreOpportunitiesAction(123, 20)).toMatchObject({ ok: false });
    expect(await loadMoreOpportunitiesAction("", -1)).toMatchObject({ ok: false });
    expect(await loadMoreOpportunitiesAction("", 1.5)).toMatchObject({ ok: false });
    expect(await loadMoreOpportunitiesAction("x".repeat(501), 0)).toMatchObject({ ok: false });
    expect(await loadMoreOpportunitiesAction("tab=applied", 20)).toMatchObject({ ok: false });
    expect(listOpportunities).not.toHaveBeenCalled();
  });
  it("資料庫錯誤時回傳錯誤訊息", async () => {
    listOpportunities.mockRejectedValue(new Error("boom"));
    expect(await loadMoreOpportunitiesAction("", 20)).toEqual({ ok: false, error: "載入失敗，請稍後再試" });
  });
});

describe("applyToBriefAction", () => {
  it("未審核先擋，不碰資料庫", async () => {
    requireRole.mockResolvedValue({ id: "c1", creator: { status: "pending" } });
    expect(await applyToBriefAction({}, form({ briefId: BRIEF }))).toEqual({ formError: "審核通過後即可報名" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("格式不對", async () => {
    expect(await applyToBriefAction({}, form({ briefId: "x" }))).toEqual({ formError: "資料格式不正確，請重新整理頁面" });
    expect(await applyToBriefAction({}, form({ briefId: BRIEF, proposedPrice: "abc" })))
      .toEqual({ fieldErrors: { proposedPrice: "請填 0 到 10,000,000 的整數" } });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("報名：沒填報價時不送 p_proposed_price", async () => {
    rpc.mockResolvedValue({ data: APP, error: null });
    expect(await applyToBriefAction({}, form({ briefId: BRIEF, message: " 你好 ", proposedPrice: "" }))).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("apply_to_brief", { p_brief_id: BRIEF, p_message: "你好" });
    expect(revalidatePath).toHaveBeenCalledWith(`/creator/briefs/${BRIEF}`);
  });
  it("帶報價", async () => {
    rpc.mockResolvedValue({ data: APP, error: null });
    await applyToBriefAction({}, form({ briefId: BRIEF, proposedPrice: "8,000" }));
    expect(rpc).toHaveBeenCalledWith("apply_to_brief", { p_brief_id: BRIEF, p_message: "", p_proposed_price: 8000 });
  });
  it("資料庫錯誤", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "already applied" } });
    expect(await applyToBriefAction({}, form({ briefId: BRIEF }))).toEqual({ formError: "你已經報名過這則招募" });
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "invalid message" } });
    expect(await applyToBriefAction({}, form({ briefId: BRIEF }))).toEqual({ fieldErrors: { message: "格式不正確" } });
  });
});

describe("withdrawApplicationAction", () => {
  it("格式不對時不碰資料庫", async () => {
    expect(await withdrawApplicationAction("x", BRIEF)).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("撤回", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await withdrawApplicationAction(APP, BRIEF)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("withdraw_application", { p_id: APP });
  });
  it("已處理過", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "application not pending" } });
    expect(await withdrawApplicationAction(APP, BRIEF)).toEqual({ ok: false, error: "這筆報名已經處理過了" });
  });
});
