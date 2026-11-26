import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, rpc, revalidatePath, readEcpayConfig } = vi.hoisted(() => ({
  requireAdmin: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn(), readEcpayConfig: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/current-user", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
vi.mock("@/lib/payments/config", () => ({ readEcpayConfig }));

import {
  adminCancelAction, markMessageReviewedAction, markPayoutAction, recordLostPaymentAction, recordOfflinePaymentAction,
  resolveAnomalyAction, resolveRefundAction, setCreatorStatusAction,
} from "./actions";

const UID = "00000000-0000-0000-0000-000000000a11";
const COLLAB = "00000000-0000-0000-0000-000000000ac1";
const BAD = { ok: false, error: "資料格式不正確，請重新整理頁面" };

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue({ id: "admin-1" });
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  revalidatePath.mockReset();
  readEcpayConfig.mockReset().mockReturnValue({ env: "stage" });
});

describe("setCreatorStatusAction", () => {
  it("先檢查管理員；參數不對不碰資料庫", async () => {
    expect(await setCreatorStatusAction("x", "approve")).toEqual(BAD);
    expect(await setCreatorStatusAction(UID, "delete")).toEqual(BAD);
    expect(requireAdmin).toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("退回與停權要寫原因", async () => {
    expect(await setCreatorStatusAction(UID, "reject", "  ")).toEqual({ ok: false, error: "請填寫原因" });
    expect(await setCreatorStatusAction(UID, "suspend", 3)).toEqual(BAD);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("核准不帶原因；退回帶清理過的原因", async () => {
    expect(await setCreatorStatusAction(UID, "approve")).toEqual({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith("set_creator_status", { p_user_id: UID, p_action: "approve" });
    await setCreatorStatusAction(UID, "reject", " 找不到驗證碼 ");
    expect(rpc).toHaveBeenLastCalledWith("set_creator_status", { p_user_id: UID, p_action: "reject", p_reason: "找不到驗證碼" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });
  it("資料庫錯誤轉中文", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "creator status changed" } });
    expect(await setCreatorStatusAction(UID, "approve")).toEqual({ ok: false, error: "資料已經更新" });
  });
});

describe("markMessageReviewedAction", () => {
  it("id 不對不碰資料庫；成功", async () => {
    expect(await markMessageReviewedAction(1)).toEqual(BAD);
    expect(await markMessageReviewedAction(UID)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("mark_message_reviewed", { p_message_id: UID });
  });
});

describe("recordOfflinePaymentAction", () => {
  it("說明必填", async () => {
    expect(await recordOfflinePaymentAction(COLLAB, "")).toEqual({ ok: false, error: "請填寫說明" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("paid：成功、通知雙方的頁面重新整理", async () => {
    rpc.mockResolvedValue({ data: "paid", error: null });
    expect(await recordOfflinePaymentAction(COLLAB, "匯款末五碼 12345")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("admin_record_offline_payment", { p_collab_id: COLLAB, p_note: "匯款末五碼 12345" });
    expect(revalidatePath).toHaveBeenCalledWith(`/creator/collabs/${COLLAB}`);
  });
  it("狀態已變：回傳重新整理訊息", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "collaboration not awaiting payment" } });
    expect(await recordOfflinePaymentAction(COLLAB, "x")).toEqual({ ok: false, error: "合作案的狀態已經更新" });
  });
});

describe("recordLostPaymentAction", () => {
  const args = [COLLAB, "KL2611270123456789AB", " 2411270000000001 ", "3,000", "綠界後台確認"] as const;
  it("格式檢查", async () => {
    expect(await recordLostPaymentAction(COLLAB, "MAN123", "1", "1", "x")).toEqual(BAD);
    expect(await recordLostPaymentAction(COLLAB, "KL1", "有空 白", "1", "x")).toEqual({ ok: false, error: "綠界交易編號是 1–20 位英數字" });
    expect(await recordLostPaymentAction(COLLAB, "KL1", "1", "abc", "x")).toEqual({ ok: false, error: "請填綠界後台顯示的金額（整數）" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("環境用這個部署的 ECPAY_ENV；未設定時拒絕", async () => {
    readEcpayConfig.mockReturnValue(null);
    expect(await recordLostPaymentAction(...args)).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
    readEcpayConfig.mockReturnValue({ env: "prod" });
    rpc.mockResolvedValue({ data: "paid", error: null });
    expect(await recordLostPaymentAction(...args)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("admin_record_lost_payment", {
      p_merchant_trade_no: "KL2611270123456789AB", p_provider_trade_no: "2411270000000001", p_amount_twd: 3000,
      p_env: "prod", p_note: "綠界後台確認",
    });
  });
  it("金額不符：記錄為異常，回報失敗", async () => {
    rpc.mockResolvedValue({ data: "anomaly", error: null });
    const res = await recordLostPaymentAction(...args);
    expect(res.ok).toBe(false);
    rpc.mockResolvedValue({ data: "paid_refund_required", error: null });
    expect(await recordLostPaymentAction(...args)).toMatchObject({ ok: true, notice: expect.stringContaining("需退款") });
  });
});

describe("撥款、平台取消、退款、異常", () => {
  it("撥款：轉帳說明必填；測試付款被拒", async () => {
    expect(await markPayoutAction(COLLAB, " ")).toEqual({ ok: false, error: "請填寫轉帳說明" });
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "test payment cannot be paid out" } });
    expect(await markPayoutAction(COLLAB, "已轉帳")).toMatchObject({ ok: false, error: expect.stringContaining("測試環境") });
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await markPayoutAction(COLLAB, "已轉帳")).toEqual({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith("admin_mark_payout", { p_collab_id: COLLAB, p_note: "已轉帳" });
  });
  it("平台取消：有已付款的款項時提示需退款", async () => {
    rpc.mockResolvedValue({ data: 1, error: null });
    expect(await adminCancelAction(COLLAB, "雙方同意")).toMatchObject({ ok: true, notice: expect.stringContaining("1 筆") });
    rpc.mockResolvedValue({ data: 0, error: null });
    expect(await adminCancelAction(COLLAB, "雙方同意")).toEqual({ ok: true });
    expect(await adminCancelAction(COLLAB, "")).toEqual({ ok: false, error: "請填寫原因" });
  });
  it("退款與異常", async () => {
    expect(await resolveRefundAction("x", "已刷退")).toEqual(BAD);
    expect(await resolveRefundAction(COLLAB, "已刷退")).toEqual({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith("resolve_payment_refund", { p_payment_id: COLLAB, p_note: "已刷退" });
    expect(await resolveAnomalyAction("1", "x")).toEqual(BAD);
    expect(await resolveAnomalyAction(1.5, "x")).toEqual(BAD);
    expect(await resolveAnomalyAction(7, "已確認")).toEqual({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith("resolve_payment_anomaly", { p_id: 7, p_note: "已確認" });
  });
});
