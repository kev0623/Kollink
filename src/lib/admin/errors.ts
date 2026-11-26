// 管理後台 definer 函式（20261128000100、000200）與 resolve_payment_*（計畫 8）的錯誤 → 畫面文字。
import { COLLAB_STALE_MESSAGE } from "@/lib/collabs/errors";

type DbError = { code?: string; message?: string };

/** 資料已經被處理過（連點、另一位管理員、另一個分頁）：畫面重新整理即可，不當成錯誤。 */
export const ADMIN_STALE_MESSAGE = "資料已經更新";

const MESSAGES: Record<string, string> = {
  "not authenticated": "登入已逾時，請重新登入",
  "not admin": "這個帳號不是管理員",
  "admin is participant": "你是這個合作案的參與者，不能用管理員身分處理",
  "invalid note": "說明必填，最多 500 字，不能有特殊字元",
  "invalid reason": "原因必填，最多 500 字，不能有特殊字元",
  "creator not found": "找不到這位創作者",
  "creator status changed": ADMIN_STALE_MESSAGE,
  "message not found": "找不到這則訊息",
  "message not flagged": "這則訊息沒有被標記",
  "collaboration not found": "找不到這個合作案",
  "collaboration not awaiting payment": COLLAB_STALE_MESSAGE,
  "collaboration not awaiting payout": COLLAB_STALE_MESSAGE,
  "collaboration already closed": COLLAB_STALE_MESSAGE,
  "test payment cannot be paid out": "這筆是綠界測試環境的付款（沒有實際收款），不能撥款",
  "no paid payment": "這個合作案沒有已付款的款項，不能撥款",
  "refund pending": "這個合作案有待退款的款項，請先處理退款",
  "payout account missing": "創作者還沒填收款帳戶，請先聯絡創作者",
  "invalid env": "綠界環境未設定，無法確認這張付款單；請用 README 的備用 SQL",
  "invalid provider_trade_no": "綠界交易編號是 1–20 位英數字",
  "invalid amount": "請填綠界後台顯示的金額",
  "payment not found": "找不到這張付款單",
  "not an online payment": "只有 KL 開頭的綠界付款單可以用這個方式",
  "refund not required": ADMIN_STALE_MESSAGE,
  "anomaly not found": "找不到這筆付款異常",
  "anomaly already resolved": ADMIN_STALE_MESSAGE,
};

export function adminErrorMessage(error: DbError): string {
  const m = error.message ?? "";
  // transition_collaboration：invalid transition: <動作> from <狀態> by <身分>
  if (m.startsWith("invalid transition")) return COLLAB_STALE_MESSAGE;
  return Object.hasOwn(MESSAGES, m) ? MESSAGES[m] : "發生錯誤，請稍後再試";
}

/** record_payment_success 的結果 → 給管理員的說明。paid 是正常結果（null = 不用另外提示）。 */
export function paymentResultNotice(result: unknown): { ok: boolean; notice: string | null } {
  switch (result) {
    case "paid":
      return { ok: true, notice: null };
    case "already_paid":
      return { ok: true, notice: "這張付款單本來就是已付款，沒有改變任何狀態" };
    case "paid_refund_required":
      return { ok: true, notice: "已記錄付款，但合作案已經不在等待付款：這筆款項標記為需退款" };
    case "anomaly":
      return { ok: false, notice: "金額與付款單不符，已記錄為付款異常（款項 → 付款異常）；合作案狀態沒有改變" };
    default:
      return { ok: false, notice: "發生錯誤，請稍後再試" };
  }
}
