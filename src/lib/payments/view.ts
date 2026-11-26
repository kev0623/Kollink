// 付款單 → 畫面要的摘要（使用者自己的 client 讀 payments；RLS 只給參與者與管理員）。
import { todayTw } from "@/lib/briefs/dates";
import { RECENT_ORDER_MS } from "./limits";

/** payments 的可讀欄位（authenticated 讀不到 raw_notify、created_by、refund_note）。 */
export const PAYMENT_COLUMNS =
  "status, payment_method, provider_env, amount_twd, atm_bank_code, atm_v_account, atm_expire_date, refund_required, created_at";

export type PaymentRow = {
  status: string | null;
  payment_method: string | null;
  provider_env: string | null;
  amount_twd: number | null;
  atm_bank_code: string | null;
  atm_v_account: string | null;
  atm_expire_date: string | null;
  refund_required: boolean | null;
  created_at: string | null;
};

export type AtmPending = { bankCode: string; vAccount: string; expireDate: string; amount: number };

export type PaymentSummary = {
  /** 已付款的單裡有測試環境（stage）的：畫面標「測試付款」，管理員不能撥款 */
  testPaid: boolean;
  /** 最新一張單是還沒到期的 ATM 待繳單：顯示轉帳資訊，不再顯示「前往付款」 */
  atm: AtmPending | null;
  /** 最新一張單是 30 分鐘內建立的信用卡待付款單：顯示「確認中」提示 */
  recentCreditPending: boolean;
  /** 有需要退款、還沒處理的款項 */
  refundPending: boolean;
};

export const EMPTY_PAYMENT_SUMMARY: PaymentSummary = {
  testPaid: false, atm: null, recentCreditPending: false, refundPending: false,
};

/** rows 由新到舊。nowMs 由伺服器在 requireRole 之後算好傳進來。 */
export function summarizePayments(rows: PaymentRow[], nowMs: number): PaymentSummary {
  const today = todayTw(new Date(nowMs));
  const latest = rows[0];
  let atm: AtmPending | null = null;
  if (latest && latest.status === "pending" && latest.payment_method === "atm"
      && latest.atm_bank_code && latest.atm_v_account && latest.atm_expire_date
      && latest.atm_expire_date >= today && latest.amount_twd) {
    atm = { bankCode: latest.atm_bank_code, vAccount: latest.atm_v_account, expireDate: latest.atm_expire_date, amount: latest.amount_twd };
  }
  const created = latest?.created_at ? Date.parse(latest.created_at) : NaN;
  return {
    testPaid: rows.some((r) => r.status === "paid" && r.provider_env === "stage"),
    atm,
    recentCreditPending: !!latest && latest.status === "pending" && latest.payment_method === "credit"
      && !Number.isNaN(created) && nowMs - created < RECENT_ORDER_MS,
    refundPending: rows.some((r) => r.refund_required === true),
  };
}

/** 虛擬帳號每 4 碼空一格，方便抄寫。 */
export function formatVAccount(v: string): string {
  return v.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** 「2026/11/30 23:59 前」（綠界 ATM 到期日當天 23:59 截止）。 */
export function atmDeadlineLabel(date: string): string {
  return `${date.replaceAll("-", "/")} 23:59 前`;
}
