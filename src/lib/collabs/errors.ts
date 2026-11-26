// 合作案相關 definer 函式的錯誤（20261125000100～000300、transition_collaboration）→ 畫面文字。
type DbError = { code?: string; message?: string };

/** 狀態已經變了（連點、另一個分頁、對方剛操作）：畫面重新整理即可，不當成錯誤。 */
export const COLLAB_STALE_MESSAGE = "合作案的狀態已經更新";

const MESSAGES: Record<string, string> = {
  "not authenticated": "登入已逾時，請重新登入",
  "not a brand": "這個帳號不是品牌，無法執行此操作",
  "not collaboration creator": "只有這個合作案的創作者可以交稿",
  "creator not found": "找不到這位創作者，或對方還沒通過審核",
  "already invited": "你已經邀請過這位創作者，請等對方回覆",
  "application not found": "找不到這筆報名",
  "application not pending": "這筆報名已經處理過了",
  "collaboration exists": "這筆報名已經建立過合作案",
  "collaboration not found": "找不到這個合作案",
  "collaboration not awaiting submission": COLLAB_STALE_MESSAGE,
  "empty submission": "請上傳檔案或附上連結",
  "invalid note": "說明含有不允許的字元或超過 1000 字",
  "invalid published_url": "請貼上完整的貼文網址（https:// 開頭、含路徑，最多 500 字）",
  // 計畫 8：create_payment_order
  "not collaboration brand": "只有這個合作案的品牌可以付款",
  "collaboration not awaiting payment": COLLAB_STALE_MESSAGE,
  "invalid payment method": "請選擇付款方式",
  "amount exceeds online payment limit": "金額超過線上付款上限（NT$200,000），請聯絡平台協助付款",
  "too many payment orders": "付款嘗試次數太多，請一小時後再試",
};

const FIELD_BY_DB: Record<string, string> = {
  title: "title",
  deliverables: "deliverables",
  amount_twd: "amount",
  note: "note",
  links: "links",
  file_paths: "files",
};

export function collabErrorMessage(error: DbError): string {
  const m = error.message ?? "";
  // transition_collaboration：invalid transition: <動作> from <狀態> by <身分>
  if (m.startsWith("invalid transition")) return COLLAB_STALE_MESSAGE;
  return Object.hasOwn(MESSAGES, m) ? MESSAGES[m] : "發生錯誤，請稍後再試";
}

/** 22023 invalid <欄位> → 表單欄位錯誤；其他錯誤回傳 null。 */
export function collabFieldError(error: DbError): Record<string, string> | null {
  if (error.code !== "22023") return null;
  const key = (error.message ?? "").replace(/^invalid /, "");
  if (!Object.hasOwn(FIELD_BY_DB, key)) return null;
  return { [FIELD_BY_DB[key]]: "格式不正確" };
}
