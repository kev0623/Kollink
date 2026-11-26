import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, rpc, loadOlderMessages } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), rpc: vi.fn(), loadOlderMessages: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
vi.mock("./load", () => ({ loadOlderMessages }));

import { loadOlderMessagesAction, markReadAction, sendMessageAction } from "./actions";

const CONV = "00000000-0000-0000-0000-00000008c001";
const MSG = "00000000-0000-0000-0000-00000008a001";

beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue({ id: "u1", profile: { role: "creator", displayName: "小美" } });
  rpc.mockReset();
  loadOlderMessages.mockReset();
});

describe("sendMessageAction", () => {
  it("清理內文後呼叫 send_message，回傳資料庫寫入的訊息", async () => {
    rpc.mockResolvedValue({
      data: [{ id: MSG, conversation_id: CONV, sender_id: "u1", body: "第一行\n第二行", flagged_contact: false, created_at: "2026-11-26T01:00:00Z" }],
      error: null,
    });
    const res = await sendMessageAction(CONV, "  第一行\r\n第二行  ");
    expect(rpc).toHaveBeenCalledWith("send_message", { p_conversation_id: CONV, p_body: "第一行\n第二行" });
    expect(res).toEqual({ ok: true, message: { id: MSG, senderId: "u1", body: "第一行\n第二行", flagged: false, createdAt: "2026-11-26T01:00:00Z" } });
  });
  it("沒有登入或不是品牌／創作者", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await sendMessageAction(CONV, "嗨")).toEqual({ ok: false, error: "登入已逾時，請重新登入" });
    getCurrentUser.mockResolvedValue({ id: "a", profile: null });
    expect(await sendMessageAction(CONV, "嗨")).toEqual({ ok: false, error: "登入已逾時，請重新登入" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("參數型別不對、內文空白或太長：不呼叫資料庫", async () => {
    expect(await sendMessageAction("not-a-uuid", "嗨")).toMatchObject({ ok: false, error: "資料格式不正確，請重新整理頁面" });
    expect(await sendMessageAction(CONV, 123)).toMatchObject({ ok: false });
    expect(await sendMessageAction(CONV, " \n ")).toEqual({ ok: false, error: "請輸入訊息" });
    expect(await sendMessageAction(CONV, "字".repeat(2001))).toEqual({ ok: false, error: "訊息最多 2000 字" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("資料庫錯誤轉成中文", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "54000", message: "too many messages" } });
    expect(await sendMessageAction(CONV, "嗨")).toEqual({ ok: false, error: "傳送太頻繁，請稍候一分鐘再試" });
  });
});

describe("markReadAction", () => {
  it("呼叫 mark_conversation_read", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await markReadAction(CONV)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("mark_conversation_read", { p_conversation_id: CONV });
  });
  it("id 不對不呼叫；資料庫錯誤轉成中文", async () => {
    expect(await markReadAction("x")).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "conversation not found" } });
    expect(await markReadAction(CONV)).toEqual({ ok: false, error: "找不到這個對話" });
  });
});

describe("loadOlderMessagesAction", () => {
  it("檢查游標後讀取", async () => {
    loadOlderMessages.mockResolvedValue({ messages: [], hasMore: false });
    expect(await loadOlderMessagesAction(CONV, "2026-11-26T01:00:00Z", MSG)).toEqual({ ok: true, messages: [], hasMore: false });
    expect(loadOlderMessages).toHaveBeenCalledWith(CONV, "2026-11-26T01:00:00Z", MSG);
  });
  it("游標格式不對不讀取", async () => {
    expect(await loadOlderMessagesAction(CONV, "昨天", MSG)).toMatchObject({ ok: false });
    expect(await loadOlderMessagesAction(CONV, "2026-11-26T01:00:00Z", "m1")).toMatchObject({ ok: false });
    expect(loadOlderMessages).not.toHaveBeenCalled();
  });
  it("讀取失敗回傳通用訊息", async () => {
    loadOlderMessages.mockRejectedValue(new Error("boom"));
    expect(await loadOlderMessagesAction(CONV, "2026-11-26T01:00:00Z", MSG)).toEqual({ ok: false, error: "發生錯誤，請稍後再試" });
  });
});
