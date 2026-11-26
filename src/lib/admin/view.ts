// 管理後台：資料庫 Row → 顯示用物件、狀態文字、可以做哪些動作。
// 產生的型別把 RETURNS TABLE 的欄位都標成非 null，實際上可能是 null，所以 Row 型別自己定義。
import { toCollabStatus, type CollabStatus } from "@/lib/collabs/view";

const DAY_MS = 86_400_000;

// ── 創作者審核 ──

export type AdminCreatorStatus = "pending" | "approved" | "suspended" | "rejected";
export const CREATOR_STATUS_LABEL: Record<AdminCreatorStatus, string> = {
  pending: "待審核",
  approved: "已審核",
  suspended: "已停權",
  rejected: "已退回",
};

function toCreatorStatus(v: unknown): AdminCreatorStatus {
  return v === "approved" || v === "suspended" || v === "rejected" ? v : "pending";
}

export type AdminCreatorRow = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  ig_username: string | null;
  follower_count: number | null;
  region: string | null;
  categories: string[] | null;
  status: string | null;
  review_note: string | null;
  verification_code: string | null;
  created_at: string | null;
  total_count: number | string | null;
};

export type AdminCreator = {
  userId: string;
  handle: string;
  displayName: string;
  igUsername: string;
  followerCount: number;
  region: string | null;
  categories: string[];
  status: AdminCreatorStatus;
  reviewNote: string | null;
  verificationCode: string | null;
  createdAt: string;
};

export function toAdminCreator(r: AdminCreatorRow): AdminCreator {
  return {
    userId: r.user_id,
    handle: r.handle ?? "",
    displayName: r.display_name ?? "",
    igUsername: r.ig_username ?? "",
    followerCount: r.follower_count ?? 0,
    region: r.region ?? null,
    categories: r.categories ?? [],
    status: toCreatorStatus(r.status),
    reviewNote: r.review_note ?? null,
    verificationCode: r.verification_code ?? null,
    createdAt: r.created_at ?? "",
  };
}

export type CreatorReviewAction = "approve" | "reject" | "suspend" | "unsuspend";

/** 每個狀態可以做的動作（與 set_creator_status 的規則相同）。 */
export function creatorActions(s: AdminCreatorStatus): CreatorReviewAction[] {
  switch (s) {
    case "pending":
      return ["approve", "reject"];
    case "rejected":
      return ["approve"];
    case "approved":
      return ["suspend"];
    case "suspended":
      return ["unsuspend"];
  }
}

/** IG 個人頁（審核時打開確認驗證碼）。 */
export function igUrl(username: string): string {
  return `https://www.instagram.com/${encodeURIComponent(username)}/`;
}

// ── 列表共用 ──

/** total_count 在每一列都一樣（window 函式）；PostgREST 把 bigint 轉成數字或字串，兩種都接受。 */
export function totalOf(rows: { total_count: number | string | null }[]): number {
  const n = Number(rows[0]?.total_count ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// ── 合作案 ──

export type AdminCollabRow = {
  id: string;
  title: string | null;
  amount_twd: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  brand_name: string | null;
  creator_handle: string | null;
  creator_name: string | null;
  paid: boolean | null;
  test_paid: boolean | null;
  refund_pending: boolean | null;
  total_count: number | string | null;
};

export type AdminCollab = {
  id: string;
  title: string;
  amount: number;
  status: CollabStatus;
  updatedAt: string;
  brandName: string;
  creatorHandle: string;
  creatorName: string;
  paid: boolean;
  testPaid: boolean;
  refundPending: boolean;
};

export function toAdminCollab(r: AdminCollabRow): AdminCollab {
  return {
    id: r.id,
    title: r.title ?? "",
    amount: r.amount_twd ?? 0,
    status: toCollabStatus(r.status),
    updatedAt: r.updated_at ?? "",
    brandName: r.brand_name ?? "",
    creatorHandle: r.creator_handle ?? "",
    creatorName: r.creator_name ?? "",
    paid: r.paid === true,
    testPaid: r.test_paid === true,
    refundPending: r.refund_pending === true,
  };
}

const CLOSED: readonly CollabStatus[] = ["completed", "declined", "cancelled"];

export type AdminCollabActions = { offlinePayment: boolean; lostPayment: boolean; payout: boolean; cancel: boolean };

/** 合作案詳情的管理員動作：等待付款 → 人工標記已付款；待撥款 → 撥款；未結束 → 平台取消。 */
export function adminCollabActions(s: CollabStatus): AdminCollabActions {
  return {
    offlinePayment: s === "awaiting_payment",
    lostPayment: s === "awaiting_payment" || s === "cancelled",
    payout: s === "awaiting_payout",
    cancel: !CLOSED.includes(s),
  };
}

// ── 付款單 ──

export type AdminPaymentRow = {
  id: string;
  collaboration_id: string;
  merchant_trade_no: string | null;
  provider_trade_no: string | null;
  amount_twd: number | null;
  status: string | null;
  payment_method: string | null;
  provider_env: string | null;
  paid_at: string | null;
  created_at: string | null;
  refund_required: boolean | null;
  refunded_at: string | null;
  refund_note: string | null;
  admin_note: string | null;
  collab_title: string | null;
  collab_status: string | null;
  brand_name: string | null;
  creator_handle: string | null;
  total_count: number | string | null;
};

export type AdminPayment = {
  id: string;
  collabId: string;
  merchantTradeNo: string;
  providerTradeNo: string | null;
  amount: number;
  status: "pending" | "paid" | "failed";
  method: string | null;
  env: string | null;
  paidAt: string | null;
  createdAt: string;
  refundRequired: boolean;
  refundedAt: string | null;
  refundNote: string | null;
  adminNote: string | null;
  collabTitle: string;
  collabStatus: CollabStatus;
  brandName: string;
  creatorHandle: string;
};

export function toAdminPayment(r: AdminPaymentRow): AdminPayment {
  return {
    id: r.id,
    collabId: r.collaboration_id,
    merchantTradeNo: r.merchant_trade_no ?? "",
    providerTradeNo: r.provider_trade_no ?? null,
    amount: r.amount_twd ?? 0,
    status: r.status === "paid" || r.status === "failed" ? r.status : "pending",
    method: r.payment_method ?? null,
    env: r.provider_env ?? null,
    paidAt: r.paid_at ?? null,
    createdAt: r.created_at ?? "",
    refundRequired: r.refund_required === true,
    refundedAt: r.refunded_at ?? null,
    refundNote: r.refund_note ?? null,
    adminNote: r.admin_note ?? null,
    collabTitle: r.collab_title ?? "",
    collabStatus: toCollabStatus(r.collab_status),
    brandName: r.brand_name ?? "",
    creatorHandle: r.creator_handle ?? "",
  };
}

export const PAYMENT_STATUS_LABEL: Record<AdminPayment["status"], string> = {
  pending: "未付款",
  paid: "已付款",
  failed: "失敗",
};

/** 付款單的來源：MAN = 人工（線下）；其他是綠界（信用卡／ATM）。 */
export function paymentSourceLabel(p: Pick<AdminPayment, "merchantTradeNo" | "method">): string {
  if (p.merchantTradeNo.startsWith("MAN")) return "人工標記";
  if (p.method === "credit") return "綠界信用卡";
  if (p.method === "atm") return "綠界 ATM";
  return "綠界";
}

/** 「綠界已扣款、但沒收到通知」可以處理的單：KL 開頭、還沒付款。 */
export function lostPaymentCandidates(payments: AdminPayment[]): AdminPayment[] {
  return payments.filter((p) => p.merchantTradeNo.startsWith("KL") && p.status !== "paid");
}

// ── 撥款 ──

export type AdminPayoutRow = {
  id: string;
  title: string | null;
  amount_twd: number | null;
  updated_at: string | null;
  brand_name: string | null;
  creator_id: string | null;
  creator_handle: string | null;
  creator_name: string | null;
  bank_code: string | null;
  account_last4: string | null;
  account_updated_at: string | null;
  test_paid: boolean | null;
  refund_pending: boolean | null;
  total_count: number | string | null;
};

export type AdminPayout = {
  id: string;
  title: string;
  amount: number;
  waitingSince: string;
  brandName: string;
  creatorHandle: string;
  creatorName: string;
  bankCode: string | null;
  accountLast4: string | null;
  accountUpdatedAt: string | null;
  testPaid: boolean;
  refundPending: boolean;
};

export function toAdminPayout(r: AdminPayoutRow): AdminPayout {
  return {
    id: r.id,
    title: r.title ?? "",
    amount: r.amount_twd ?? 0,
    waitingSince: r.updated_at ?? "",
    brandName: r.brand_name ?? "",
    creatorHandle: r.creator_handle ?? "",
    creatorName: r.creator_name ?? "",
    bankCode: r.bank_code ?? null,
    accountLast4: r.account_last4 ?? null,
    accountUpdatedAt: r.account_updated_at ?? null,
    testPaid: r.test_paid === true,
    refundPending: r.refund_pending === true,
  };
}

/** 不能撥款的原因（與 admin_mark_payout 的檢查相同）；可以撥款回傳 null。 */
export function payoutBlocker(p: { testPaid: boolean; refundPending: boolean; hasAccount: boolean }): string | null {
  if (p.testPaid) return "測試付款（未實際收款），不能撥款";
  if (p.refundPending) return "有待退款的款項，請先處理退款";
  if (!p.hasAccount) return "創作者還沒填收款帳戶";
  return null;
}

/** 收款帳戶 7 天內改過：撥款前提醒管理員跟創作者確認（帳號被盜改帳戶的風險）。 */
export function accountChangedRecently(updatedAt: string | null, nowMs: number): boolean {
  if (!updatedAt) return false;
  const t = Date.parse(updatedAt);
  return !Number.isNaN(t) && nowMs - t < 7 * DAY_MS;
}

export type PayoutAccountFull = {
  bankCode: string;
  branchCode: string | null;
  accountNumber: string;
  accountName: string;
  updatedAt: string;
};

export type PayoutAccountRow = {
  bank_code: string | null;
  branch_code: string | null;
  account_number: string | null;
  account_name: string | null;
  updated_at: string | null;
};

export function toPayoutAccountFull(r: PayoutAccountRow | undefined): PayoutAccountFull | null {
  if (!r?.bank_code || !r.account_number || !r.account_name) return null;
  return {
    bankCode: r.bank_code,
    branchCode: r.branch_code ?? null,
    accountNumber: r.account_number,
    accountName: r.account_name,
    updatedAt: r.updated_at ?? "",
  };
}

/** 撥款紀錄（collaboration_payouts）。 */
export type PayoutRecord = {
  amount: number;
  bankCode: string;
  accountLast4: string;
  accountName: string;
  transferNote: string;
  createdAt: string;
};

// ── 付款異常 ──

const ANOMALY_KIND_LABEL: Record<string, string> = {
  unknown_trade_no: "找不到付款單",
  amount_mismatch: "金額與付款單不符",
  price_mismatch: "付款單與報價不符",
};

const ANOMALY_SOURCE_LABEL: Record<string, string> = {
  notify: "付款通知",
  payment_info: "ATM 取號通知",
  admin: "管理員補登",
};

/** 標籤查表：用 Object.hasOwn（不吃到 toString 之類的原型屬性），沒有對應就照原文，空值顯示「未知」。 */
function labelOf(map: Record<string, string>, key: string | null): string {
  if (!key) return "未知";
  return Object.hasOwn(map, key) ? map[key] : key;
}

export const anomalyKindLabel = (k: string | null): string => labelOf(ANOMALY_KIND_LABEL, k);
export const anomalySourceLabel = (s: string | null): string => labelOf(ANOMALY_SOURCE_LABEL, s);

export type AnomalyRow = {
  id: number;
  created_at: string | null;
  source: string | null;
  kind: string | null;
  merchant_trade_no: string | null;
  provider_trade_no: string | null;
  expected_amount_twd: number | null;
  received_amount_twd: number | null;
  collaboration_id: string | null;
  resolved_at: string | null;
  resolved_note: string | null;
};

export type Anomaly = {
  id: number;
  createdAt: string;
  source: string;
  kind: string;
  merchantTradeNo: string;
  providerTradeNo: string;
  expected: number | null;
  received: number | null;
  collabId: string | null;
  resolvedAt: string | null;
  resolvedNote: string | null;
};

export function toAnomaly(r: AnomalyRow): Anomaly {
  return {
    id: r.id,
    createdAt: r.created_at ?? "",
    source: anomalySourceLabel(r.source),
    kind: anomalyKindLabel(r.kind),
    merchantTradeNo: r.merchant_trade_no ?? "",
    providerTradeNo: r.provider_trade_no ?? "",
    expected: r.expected_amount_twd ?? null,
    received: r.received_amount_twd ?? null,
    collabId: r.collaboration_id ?? null,
    resolvedAt: r.resolved_at ?? null,
    resolvedNote: r.resolved_note ?? null,
  };
}

// ── 違規訊息 ──

export type FlaggedMessageRow = {
  id: string;
  conversation_id: string | null;
  body: string | null;
  created_at: string | null;
  sender_side: string | null;
  brand_id: string | null;
  brand_name: string | null;
  creator_id: string | null;
  creator_handle: string | null;
  creator_name: string | null;
  reviewed_at: string | null;
  total_count: number | string | null;
};

export type FlaggedMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderSide: "brand" | "creator";
  brandName: string;
  creatorId: string | null;
  creatorHandle: string;
  creatorName: string;
  reviewedAt: string | null;
};

export function toFlaggedMessage(r: FlaggedMessageRow): FlaggedMessage {
  return {
    id: r.id,
    body: r.body ?? "",
    createdAt: r.created_at ?? "",
    senderSide: r.sender_side === "brand" ? "brand" : "creator",
    brandName: r.brand_name ?? "",
    creatorId: r.creator_id ?? null,
    creatorHandle: r.creator_handle ?? "",
    creatorName: r.creator_name ?? "",
    reviewedAt: r.reviewed_at ?? null,
  };
}

// ── 總覽 ──

export type Overview = {
  pendingCreators: number;
  awaitingPayment: number;
  awaitingPayout: number;
  refundRequired: number;
  openAnomalies: number;
  openFlaggedMessages: number;
};

export type OverviewRow = {
  pending_creators: number | string | null;
  awaiting_payment: number | string | null;
  awaiting_payout: number | string | null;
  refund_required: number | string | null;
  open_anomalies: number | string | null;
  open_flagged_messages: number | string | null;
};

function n(v: number | string | null | undefined): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export function toOverview(r: OverviewRow | undefined): Overview {
  return {
    pendingCreators: n(r?.pending_creators),
    awaitingPayment: n(r?.awaiting_payment),
    awaitingPayout: n(r?.awaiting_payout),
    refundRequired: n(r?.refund_required),
    openAnomalies: n(r?.open_anomalies),
    openFlaggedMessages: n(r?.open_flagged_messages),
  };
}
