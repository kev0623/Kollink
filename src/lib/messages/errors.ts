// 訊息相關 definer 函式（20261126000100、000200）的錯誤 → 畫面文字。
type DbError = { code?: string; message?: string };

const MESSAGES: Record<string, string> = {
  "not authenticated": "登入已逾時，請重新登入",
  "not a brand": "只有品牌可以主動傳訊息",
  "creator not found": "找不到這位創作者，或對方還沒通過審核",
  "conversation not found": "找不到這個對話",
  "conversation closed": "對話已暫停，無法傳送訊息",
  "text too long": "內容太長，請縮短後再送出",
  "invalid body": "訊息不能空白、最多 2000 字，也不能含特殊控制字元",
  "too many messages": "傳送太頻繁，請稍候一分鐘再試",
  "too many conversations": "今天開啟的新對話已達上限，請明天再試",
};

export function messageErrorMessage(error: DbError): string {
  const m = error.message ?? "";
  return Object.hasOwn(MESSAGES, m) ? MESSAGES[m] : "發生錯誤，請稍後再試";
}
