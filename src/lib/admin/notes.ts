// 管理員寫的原因／說明（退回、停權、平台取消、轉帳說明、人工付款說明、退款、異常）。
// 規則與 SQL 的 admin_clean_note（20261128000100_admin_core.sql）相同：清理後 1–500 字、沒有雙向控制字元。
// resolve_payment_refund／resolve_payment_anomaly 也是 500 字。
import { hasBadChar } from "@/lib/validation/brief";
import { cleanLongText } from "@/lib/validation/collab";

export const ADMIN_NOTE_MAX = 500;

/** 清理（CRLF → LF、去頭尾空白）；不是字串回傳 null。 */
export function cleanAdminNote(v: unknown): string | null {
  return typeof v === "string" ? cleanLongText(v) : null;
}

/** 錯誤訊息或 null（通過）。 */
export function validateAdminNote(note: string, label = "說明"): string | null {
  if (note.length === 0) return `請填寫${label}`;
  if (hasBadChar(note)) return `${label}含有不允許的特殊字元`;
  if ([...note].length > ADMIN_NOTE_MAX) return `${label}最多 ${ADMIN_NOTE_MAX} 字`;
  return null;
}

/** 綠界交易編號（TS 的補登 Server Action 與補登表單共用；SQL 端是 admin_record_lost_payment 的 invalid provider_trade_no）。 */
export const PROVIDER_TRADE_NO_RE = /^[A-Za-z0-9]{1,20}$/;
