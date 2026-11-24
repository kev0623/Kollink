import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, rpc, remove, revalidatePath, redirect } = vi.hoisted(() => ({
  requireRole: vi.fn(), rpc: vi.fn(), remove: vi.fn(), revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/current-user", () => ({ requireRole }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc, storage: { from: () => ({ remove }) } }),
}));

import { closeBriefAction, decideApplicationAction, deleteBriefAction, saveBriefAction } from "./actions";
import { todayTw } from "@/lib/briefs/dates";

const ID = "00000000-0000-0000-0000-00000006f001";
const APP = "00000000-0000-0000-0000-00000006a001";

function form(entries: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const x of [v].flat()) f.append(k, x);
  return f;
}

const full = {
  title: "春季保養開箱", description: "說明", collabTypes: "IG 貼文", includesProduct: "on", deadline: todayTw(),
};

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: "brand-1" });
  rpc.mockReset();
  remove.mockReset().mockResolvedValue({ data: [], error: null });
  revalidatePath.mockReset();
  redirect.mockClear();
});

describe("saveBriefAction", () => {
  it("一定先檢查是品牌", async () => {
    await saveBriefAction({}, form({ intent: "bogus" }));
    expect(requireRole).toHaveBeenCalledWith("brand");
  });
  it("id 或 intent 格式不對時不碰資料庫", async () => {
    expect(await saveBriefAction({}, form({ intent: "draft", id: "x" }))).toEqual({ formError: "資料格式不正確，請重新整理頁面" });
    expect(await saveBriefAction({}, form({ intent: "post" }))).toEqual({ formError: "資料格式不正確，請重新整理頁面" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("發佈時伺服器再完整驗證一次", async () => {
    const res = await saveBriefAction({}, form({ intent: "publish", title: "x" }));
    expect(res.fieldErrors).toMatchObject({ description: "請填寫合作說明", reward: "預算和產品至少要有一項" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("存草稿：新增後導到編輯頁同一步", async () => {
    rpc.mockResolvedValue({ data: ID, error: null });
    await expect(saveBriefAction({}, form({ intent: "draft", step: "2", title: "只有案名" })))
      .rejects.toThrow(`REDIRECT /brand/briefs/${ID}/edit?step=2&saved=1`);
    expect(rpc).toHaveBeenCalledWith("save_brief", expect.objectContaining({ p_id: undefined, p_title: "只有案名", p_publish: false }));
    expect(revalidatePath).toHaveBeenCalledWith("/brand/briefs");
  });
  it("存既有的草稿：留在原頁、回傳 saved", async () => {
    rpc.mockResolvedValue({ data: ID, error: null });
    expect(await saveBriefAction({}, form({ intent: "draft", id: ID, step: "3", title: "改案名" }))).toEqual({ saved: true });
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith(`/brand/briefs/${ID}`);
  });
  it("發佈：導到招募詳情", async () => {
    rpc.mockResolvedValue({ data: ID, error: null });
    await expect(saveBriefAction({}, form({ intent: "publish", id: ID, ...full })))
      .rejects.toThrow(`REDIRECT /brand/briefs/${ID}`);
    expect(rpc).toHaveBeenCalledWith("save_brief", expect.objectContaining({ p_id: ID, p_publish: true, p_includes_product: true }));
  });
  it("資料庫的欄位錯誤與其他錯誤", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "invalid deadline" } });
    expect(await saveBriefAction({}, form({ intent: "publish", ...full })))
      .toEqual({ fieldErrors: { deadline: "截止日要在今天到 90 天內" } });
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "brief not editable" } });
    expect(await saveBriefAction({}, form({ intent: "draft", id: ID, title: "x" })))
      .toEqual({ formError: "這則招募已結束，不能再修改" });
  });
});

describe("closeBriefAction", () => {
  it("格式不對時不碰資料庫", async () => {
    expect(await closeBriefAction("x")).toEqual({ ok: false, error: "資料格式不正確，請重新整理頁面" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("關閉並重新整理列表與詳情", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await closeBriefAction(ID)).toEqual({ ok: true });
    expect(requireRole).toHaveBeenCalledWith("brand");
    expect(rpc).toHaveBeenCalledWith("close_brief", { p_id: ID });
    expect(revalidatePath).toHaveBeenCalledWith(`/brand/briefs/${ID}`);
  });
  it("錯誤訊息", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "brief not open" } });
    expect(await closeBriefAction(ID)).toEqual({ ok: false, error: "這則招募已經不是發佈中" });
  });
});

describe("deleteBriefAction", () => {
  it("刪除草稿、刪封面檔、回到草稿列表", async () => {
    rpc.mockResolvedValue({ data: "brand-1/cover-a.jpg", error: null });
    await expect(deleteBriefAction(ID)).rejects.toThrow("REDIRECT /brand/briefs?tab=draft");
    expect(rpc).toHaveBeenCalledWith("delete_brief", { p_id: ID });
    expect(remove).toHaveBeenCalledWith(["brand-1/cover-a.jpg"]);
  });
  it("沒有封面時不刪檔；刪檔失敗也不影響", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(deleteBriefAction(ID)).rejects.toThrow("REDIRECT");
    expect(remove).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: "brand-1/cover-a.jpg", error: null });
    remove.mockRejectedValue(new Error("network"));
    await expect(deleteBriefAction(ID)).rejects.toThrow("REDIRECT");
  });
  it("不是草稿", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "brief not draft" } });
    expect(await deleteBriefAction(ID)).toEqual({ ok: false, error: "只有草稿可以刪除" });
  });
});

describe("decideApplicationAction", () => {
  it("參數格式不對時不碰資料庫", async () => {
    expect(await decideApplicationAction(APP, ID, "yes")).toMatchObject({ ok: false });
    expect(await decideApplicationAction("x", ID, true)).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("錄取並重新整理詳情", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await decideApplicationAction(APP, ID, true)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("decide_application", { p_id: APP, p_accept: true });
    expect(revalidatePath).toHaveBeenCalledWith(`/brand/briefs/${ID}`);
  });
  it("已處理過", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "application not pending" } });
    expect(await decideApplicationAction(APP, ID, false)).toEqual({ ok: false, error: "這筆報名已經處理過了" });
  });
});
