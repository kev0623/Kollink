"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/briefs/query";
import { adminErrorMessage, paymentResultNotice } from "@/lib/admin/errors";
import { cleanAdminNote, PROVIDER_TRADE_NO_RE, validateAdminNote } from "@/lib/admin/notes";
import { readEcpayConfig } from "@/lib/payments/config";
import { parseAmount } from "@/lib/validation/collab";

// 管理後台的寫入。每個 action：requireAdmin → 參數一律當 unknown 檢查 → 以管理員自己的 client 呼叫 definer 函式
// （資料庫用 admin_actor() 再檢查一次、寫 audit）。"use server" 檔案只能 export async 函式。

export type AdminActionResult = { ok: true; notice?: string } | { ok: false; error: string };

const BAD_INPUT = "資料格式不正確，請重新整理頁面";
const CREATOR_ACTIONS: readonly string[] = ["approve", "reject", "suspend", "unsuspend"];
const TRADE_NO_RE = /^KL[A-Za-z0-9]{1,18}$/;

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

function revalidateCollab(id: string) {
  revalidateAdmin();
  revalidatePath(`/brand/collabs/${id}`);
  revalidatePath(`/creator/collabs/${id}`);
  revalidatePath("/brand/collabs");
  revalidatePath("/creator/collabs");
}

function note(v: unknown, label: string): { ok: true; value: string } | { ok: false; error: string } {
  const n = cleanAdminNote(v);
  if (n === null) return { ok: false, error: BAD_INPUT };
  const err = validateAdminNote(n, label);
  return err ? { ok: false, error: err } : { ok: true, value: n };
}

/** 創作者審核：核准、退回（原因必填）、停權（原因必填）、解除停權。 */
export async function setCreatorStatusAction(userId: unknown, action: unknown, reason?: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  if (!isUuid(userId) || typeof action !== "string" || !CREATOR_ACTIONS.includes(action)) return { ok: false, error: BAD_INPUT };
  let cleanReason: string | null = null;
  if (action === "reject" || action === "suspend") {
    const r = note(reason, "原因");
    if (!r.ok) return r;
    cleanReason = r.value;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_creator_status", {
    p_user_id: userId, p_action: action, ...(cleanReason !== null ? { p_reason: cleanReason } : {}),
  });
  if (error) return { ok: false, error: adminErrorMessage(error) };
  revalidateAdmin();
  // 公開頁與廣場不快取（followups「公開頁不快取」），創作者自己的頁面在下次請求就會看到新狀態
  revalidatePath("/creator", "layout");
  return { ok: true };
}

/** 違規訊息：標記已檢視（重複標記不報錯）。 */
export async function markMessageReviewedAction(messageId: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  if (!isUuid(messageId)) return { ok: false, error: BAD_INPUT };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_message_reviewed", { p_message_id: messageId });
  if (error) return { ok: false, error: adminErrorMessage(error) };
  revalidateAdmin();
  return { ok: true };
}

/** 人工標記已付款：線下付款／超過線上付款上限（建 MAN 付款單 → record_payment_success）。 */
export async function recordOfflinePaymentAction(collabId: unknown, memo: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  if (!isUuid(collabId)) return { ok: false, error: BAD_INPUT };
  const n = note(memo, "說明");
  if (!n.ok) return n;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_record_offline_payment", { p_collab_id: collabId, p_note: n.value });
  if (error) return { ok: false, error: adminErrorMessage(error) };
  revalidateCollab(collabId);
  const r = paymentResultNotice(data);
  return r.ok ? { ok: true, ...(r.notice ? { notice: r.notice } : {}) } : { ok: false, error: r.notice ?? "發生錯誤，請稍後再試" };
}

/**
 * 綠界已扣款、但沒收到通知（已在綠界廠商後台確認）：用既有的 KL 付款單 → record_payment_success。
 * 環境用這個部署的 ECPAY_ENV（KL 單是這個部署建立的）；綠界未設定時拒絕（請用 README 備用 SQL）。
 */
export async function recordLostPaymentAction(
  collabId: unknown, merchantTradeNo: unknown, providerTradeNo: unknown, amount: unknown, memo: unknown,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!isUuid(collabId) || typeof merchantTradeNo !== "string" || !TRADE_NO_RE.test(merchantTradeNo)
      || typeof providerTradeNo !== "string" || typeof amount !== "string") {
    return { ok: false, error: BAD_INPUT };
  }
  const ptn = providerTradeNo.trim();
  if (!PROVIDER_TRADE_NO_RE.test(ptn)) return { ok: false, error: "綠界交易編號是 1–20 位英數字" };
  const amountTwd = parseAmount(amount);
  if (amountTwd === null) return { ok: false, error: "請填綠界後台顯示的金額（整數）" };
  const n = note(memo, "說明");
  if (!n.ok) return n;
  const env = readEcpayConfig()?.env ?? null;
  if (!env) return { ok: false, error: "綠界環境未設定，無法確認這張付款單；請用 README 的備用 SQL" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_record_lost_payment", {
    p_merchant_trade_no: merchantTradeNo, p_provider_trade_no: ptn, p_amount_twd: amountTwd, p_env: env, p_note: n.value,
  });
  if (error) return { ok: false, error: adminErrorMessage(error) };
  revalidateCollab(collabId);
  const r = paymentResultNotice(data);
  return r.ok ? { ok: true, ...(r.notice ? { notice: r.notice } : {}) } : { ok: false, error: r.notice ?? "發生錯誤，請稍後再試" };
}

/** 撥款：管理員已在平台外轉帳，標記 awaiting_payout → completed（轉帳說明必填）。 */
export async function markPayoutAction(collabId: unknown, memo: unknown, expectedLast4: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  // expectedLast4：管理員畫面上看到的帳號末四碼；資料庫在撥款時比對，創作者中途改了帳戶就拒絕
  if (!isUuid(collabId) || typeof expectedLast4 !== "string" || !/^[0-9]{4}$/.test(expectedLast4)) return { ok: false, error: BAD_INPUT };
  const n = note(memo, "轉帳說明");
  if (!n.ok) return n;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_mark_payout", { p_collab_id: collabId, p_note: n.value, p_expected_last4: expectedLast4 });
  if (error) return { ok: false, error: adminErrorMessage(error) };
  revalidateCollab(collabId);
  return { ok: true };
}

/** 平台取消（爭議處理）：原因必填、雙方看得到；已付款的款項自動標記需退款。 */
export async function adminCancelAction(collabId: unknown, reason: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  if (!isUuid(collabId)) return { ok: false, error: BAD_INPUT };
  const n = note(reason, "原因");
  if (!n.ok) return n;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_cancel_collaboration", { p_collab_id: collabId, p_reason: n.value });
  if (error) return { ok: false, error: adminErrorMessage(error) };
  revalidateCollab(collabId);
  const flagged = typeof data === "number" ? data : 0;
  return flagged > 0
    ? { ok: true, notice: `已取消。${flagged} 筆已付款的款項標記為需退款` }
    : { ok: true };
}

/** 退款完成（實際退款在綠界後台或另外轉帳）：清除需退款、記錄說明。 */
export async function resolveRefundAction(paymentId: unknown, memo: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  if (!isUuid(paymentId)) return { ok: false, error: BAD_INPUT };
  const n = note(memo, "退款說明");
  if (!n.ok) return n;
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_payment_refund", { p_payment_id: paymentId, p_note: n.value });
  if (error) return { ok: false, error: adminErrorMessage(error) };
  revalidateAdmin();
  return { ok: true };
}

/** 隱藏或恢復一則評價（原因必填，只有管理員看得到）。狀態沒變時也當成成功。 */
export async function setReviewHiddenAction(reviewId: unknown, hidden: unknown, memo: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  if (!isUuid(reviewId) || typeof hidden !== "boolean") return { ok: false, error: BAD_INPUT };
  const n = note(memo, "原因");
  if (!n.ok) return n;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_review_hidden", { p_review_id: reviewId, p_hidden: hidden, p_reason: n.value });
  if (error) return { ok: false, error: adminErrorMessage(error) };
  revalidateAdmin();
  return { ok: true };
}

/** 付款異常處理完成：記錄說明。 */
export async function resolveAnomalyAction(anomalyId: unknown, memo: unknown): Promise<AdminActionResult> {
  await requireAdmin();
  if (typeof anomalyId !== "number" || !Number.isSafeInteger(anomalyId) || anomalyId <= 0) return { ok: false, error: BAD_INPUT };
  const n = note(memo, "處理說明");
  if (!n.ok) return n;
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_payment_anomaly", { p_id: anomalyId, p_note: n.value });
  if (error) return { ok: false, error: adminErrorMessage(error) };
  revalidateAdmin();
  return { ok: true };
}
