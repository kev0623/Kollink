import { describe, expect, it } from "vitest";
import {
  accountChangedRecently, adminCollabActions, creatorActions, igUrl, lostPaymentCandidates, paymentSourceLabel,
  payoutBlocker, toAdminCollab, toAdminCreator, toAdminPayment, toAnomaly, toFlaggedMessage, toOverview,
  toPayoutAccountFull, totalOf, type AdminPaymentRow,
} from "./view";

const DAY = 86_400_000;

describe("創作者審核", () => {
  it("每個狀態可以做的動作（與 set_creator_status 相同）", () => {
    expect(creatorActions("pending")).toEqual(["approve", "reject"]);
    expect(creatorActions("rejected")).toEqual(["approve"]);
    expect(creatorActions("approved")).toEqual(["suspend"]);
    expect(creatorActions("suspended")).toEqual(["unsuspend"]);
  });
  it("Row → 顯示用：null 補預設、不認得的狀態當待審核", () => {
    const c = toAdminCreator({
      user_id: "u", handle: null, display_name: null, ig_username: "mei", follower_count: null, region: null,
      categories: null, status: "weird", review_note: null, verification_code: null, created_at: null, total_count: "3",
    });
    expect(c).toMatchObject({ handle: "", followerCount: 0, categories: [], status: "pending" });
    expect(totalOf([{ total_count: "3" }])).toBe(3);
    expect(totalOf([])).toBe(0);
  });
  it("IG 網址會編碼", () => {
    expect(igUrl("mei.daily")).toBe("https://www.instagram.com/mei.daily/");
  });
});

describe("合作案的管理員動作", () => {
  it("等待付款：人工標記；待撥款：撥款；未結束：平台取消", () => {
    expect(adminCollabActions("awaiting_payment")).toEqual({ offlinePayment: true, lostPayment: true, payout: false, cancel: true });
    expect(adminCollabActions("awaiting_payout")).toEqual({ offlinePayment: false, lostPayment: false, payout: true, cancel: true });
    expect(adminCollabActions("completed")).toEqual({ offlinePayment: false, lostPayment: false, payout: false, cancel: false });
    expect(adminCollabActions("cancelled").lostPayment).toBe(true);
  });
  it("列表 Row", () => {
    expect(toAdminCollab({
      id: "c", title: null, amount_twd: null, status: "in_review", created_at: null, updated_at: null, brand_name: null,
      creator_handle: null, creator_name: null, paid: null, test_paid: true, refund_pending: null, total_count: 1,
    })).toMatchObject({ status: "in_review", testPaid: true, refundPending: false, paid: false });
  });
});

const PAY: AdminPaymentRow = {
  id: "p", collaboration_id: "c", merchant_trade_no: "KL2611270000000000AB", provider_trade_no: null, amount_twd: 3000,
  status: "pending", payment_method: "credit", provider_env: null, paid_at: null, created_at: "2026-11-27T00:00:00Z",
  refund_required: false, refunded_at: null, refund_note: null, admin_note: null, collab_title: "x",
  collab_status: "awaiting_payment", brand_name: "b", creator_handle: "mei", total_count: 1,
};

describe("付款單", () => {
  it("來源文字", () => {
    expect(paymentSourceLabel({ merchantTradeNo: "MANABC", method: null })).toBe("人工標記");
    expect(paymentSourceLabel({ merchantTradeNo: "KL1", method: "atm" })).toBe("綠界 ATM");
    expect(paymentSourceLabel({ merchantTradeNo: "KL1", method: "credit" })).toBe("綠界信用卡");
  });
  it("通知遺失可以補登的單：KL 開頭、還沒付款", () => {
    const rows = [
      toAdminPayment(PAY),
      toAdminPayment({ ...PAY, id: "q", status: "paid" }),
      toAdminPayment({ ...PAY, id: "r", merchant_trade_no: "MANX" }),
      toAdminPayment({ ...PAY, id: "s", status: "weird" }),
    ];
    expect(lostPaymentCandidates(rows).map((p) => p.id)).toEqual(["p", "s"]);
    expect(rows[3].status).toBe("pending");
  });
});

describe("撥款", () => {
  it("不能撥款的原因（與 admin_mark_payout 相同順序）", () => {
    expect(payoutBlocker({ testPaid: true, refundPending: true, hasAccount: false })).toContain("測試付款");
    expect(payoutBlocker({ testPaid: false, refundPending: true, hasAccount: false })).toContain("退款");
    expect(payoutBlocker({ testPaid: false, refundPending: false, hasAccount: false })).toBe("創作者還沒填收款帳戶");
    expect(payoutBlocker({ testPaid: false, refundPending: false, hasAccount: true })).toBeNull();
  });
  it("收款帳戶 7 天內改過要提醒", () => {
    const now = Date.parse("2026-11-27T00:00:00Z");
    expect(accountChangedRecently(new Date(now - 6 * DAY).toISOString(), now)).toBe(true);
    expect(accountChangedRecently(new Date(now - 8 * DAY).toISOString(), now)).toBe(false);
    expect(accountChangedRecently(null, now)).toBe(false);
    expect(accountChangedRecently("bad", now)).toBe(false);
  });
  it("完整帳戶：缺必要欄位視為沒有", () => {
    expect(toPayoutAccountFull(undefined)).toBeNull();
    expect(toPayoutAccountFull({ bank_code: "812", branch_code: null, account_number: null, account_name: "x", updated_at: null })).toBeNull();
    expect(toPayoutAccountFull({ bank_code: "812", branch_code: null, account_number: "12345678", account_name: "x", updated_at: null }))
      .toEqual({ bankCode: "812", branchCode: null, accountNumber: "12345678", accountName: "x", updatedAt: "" });
  });
});

describe("其他 Row", () => {
  it("付款異常的類型與來源轉中文；不認得的照原文", () => {
    const a = toAnomaly({
      id: 1, created_at: "t", source: "notify", kind: "amount_mismatch", merchant_trade_no: "KL", provider_trade_no: "",
      expected_amount_twd: 3000, received_amount_twd: 3001, collaboration_id: null, resolved_at: null, resolved_note: null,
    });
    expect(a).toMatchObject({ source: "付款通知", kind: "金額與付款單不符", expected: 3000, received: 3001 });
    expect(toAnomaly({ ...{ id: 2, created_at: "t", source: "x", kind: "y", merchant_trade_no: "", provider_trade_no: "",
      expected_amount_twd: null, received_amount_twd: null, collaboration_id: null, resolved_at: null, resolved_note: null } }).kind).toBe("y");
  });
  it("違規訊息與總覽", () => {
    expect(toFlaggedMessage({
      id: "m", conversation_id: null, body: null, created_at: null, sender_side: "creator", brand_id: null, brand_name: null,
      creator_id: null, creator_handle: null, creator_name: null, reviewed_at: null, total_count: 1,
    })).toMatchObject({ body: "", senderSide: "creator", reviewedAt: null });
    expect(toOverview(undefined).pendingCreators).toBe(0);
    expect(toOverview({ pending_creators: "2", awaiting_payment: 1, awaiting_payout: null, refund_required: 0,
      open_anomalies: 0, open_flagged_messages: 5 })).toMatchObject({ pendingCreators: 2, awaitingPayout: 0, openFlaggedMessages: 5 });
  });
});
