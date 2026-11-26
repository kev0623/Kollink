import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_PAGE_SIZE, offsetOf, type CollabFilter, type CreatorFilter, type MessageFilter } from "./query";
import {
  toAdminCollab, toAdminCreator, toAdminPayment, toAdminPayout, toAnomaly, toFlaggedMessage, toOverview,
  toPayoutAccountFull, totalOf,
  type AdminCollab, type AdminCollabRow, type AdminCreator, type AdminCreatorRow, type AdminPayment, type AdminPaymentRow,
  type AdminPayout, type AdminPayoutRow, type Anomaly, type AnomalyRow, type FlaggedMessage, type FlaggedMessageRow,
  type Overview, type OverviewRow, type PayoutAccountFull, type PayoutAccountRow, type PayoutRecord,
} from "./view";

// 管理後台的伺服器端讀取。全部用管理員自己的 client（definer 函式用 admin_actor() 檢查、資料表靠 RLS 的 is_admin()）。
// 會讀 cookie：只能在 requireAdmin 之後呼叫。不快取。

export type Page<T> = { items: T[]; total: number };

export async function loadOverview(): Promise<Overview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_overview");
  if (error) throw error;
  return toOverview(((data ?? []) as unknown as OverviewRow[])[0]);
}

export async function loadCreators(status: CreatorFilter, q: string, page: number): Promise<Page<AdminCreator>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_creators", {
    p_status: status, p_query: q, p_limit: ADMIN_PAGE_SIZE, p_offset: offsetOf(page),
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown as AdminCreatorRow[];
  return { items: rows.map(toAdminCreator), total: totalOf(rows) };
}

export async function loadFlaggedMessages(view: MessageFilter, page: number): Promise<Page<FlaggedMessage>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_flagged_messages", {
    p_view: view, p_limit: ADMIN_PAGE_SIZE, p_offset: offsetOf(page),
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown as FlaggedMessageRow[];
  return { items: rows.map(toFlaggedMessage), total: totalOf(rows) };
}

export async function loadAdminCollabs(status: CollabFilter, q: string, page: number): Promise<Page<AdminCollab>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_collaborations", {
    p_status: status, p_query: q, p_limit: ADMIN_PAGE_SIZE, p_offset: offsetOf(page),
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown as AdminCollabRow[];
  return { items: rows.map(toAdminCollab), total: totalOf(rows) };
}

type PaymentView = "all" | "pending" | "paid" | "refund";

/** 付款單列表；collabId 有值時只列這個合作案（合作案詳情用，最多 100 張）。 */
export async function loadAdminPayments(view: PaymentView, page: number, collabId: string | null = null): Promise<Page<AdminPayment>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_payments", {
    p_view: view,
    p_limit: collabId ? 100 : ADMIN_PAGE_SIZE,
    p_offset: collabId ? 0 : offsetOf(page),
    ...(collabId ? { p_collab_id: collabId } : {}),
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown as AdminPaymentRow[];
  return { items: rows.map(toAdminPayment), total: totalOf(rows) };
}

export async function loadPayouts(page: number): Promise<Page<AdminPayout>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_payouts", { p_limit: ADMIN_PAGE_SIZE, p_offset: offsetOf(page) });
  if (error) throw error;
  const rows = (data ?? []) as unknown as AdminPayoutRow[];
  return { items: rows.map(toAdminPayout), total: totalOf(rows) };
}

const ANOMALY_COLUMNS =
  "id, created_at, source, kind, merchant_trade_no, provider_trade_no, expected_amount_twd, received_amount_twd, collaboration_id, resolved_at, resolved_note";

/** 付款異常（payment_anomalies 只有管理員讀得到）；open = 未處理，由舊到新；已處理由新到舊。 */
export async function loadAnomalies(open: boolean, page: number): Promise<Page<Anomaly>> {
  const supabase = await createClient();
  const base = supabase.from("payment_anomalies").select(ANOMALY_COLUMNS, { count: "exact" });
  const from = offsetOf(page);
  const { data, error, count } = await (open ? base.is("resolved_at", null) : base.not("resolved_at", "is", null))
    .order("created_at", { ascending: open })
    .order("id", { ascending: true })
    .range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error) throw error;
  return { items: ((data ?? []) as unknown as AnomalyRow[]).map(toAnomaly), total: count ?? 0 };
}

/** 撥款畫面的完整收款帳戶（資料庫寫一筆 payout_account_viewed audit）；不是待撥款或沒有帳戶回傳 null。 */
export async function loadPayoutAccount(collabId: string): Promise<PayoutAccountFull | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_payout_account", { p_collab_id: collabId });
  if (error) throw error;
  return toPayoutAccountFull(((data ?? []) as unknown as PayoutAccountRow[])[0]);
}

/** 已撥款的合作案：撥款紀錄（帳戶末四碼、轉帳說明）。 */
export async function loadPayoutRecord(collabId: string): Promise<PayoutRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("collaboration_payouts")
    .select("amount_twd, bank_code, account_last4, account_name, transfer_note, created_at")
    .eq("collaboration_id", collabId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    amount: data.amount_twd, bankCode: data.bank_code, accountLast4: data.account_last4,
    accountName: data.account_name, transferNote: data.transfer_note, createdAt: data.created_at,
  };
}
