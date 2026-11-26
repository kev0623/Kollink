// 訊息內文的清理與驗證。規則與資料庫的 send_message（20261126000100_messaging_write.sql）一致：
// CRLF／CR → LF、clean_text、不可有 bidi（JS 另外擋 NUL）、1–2000 字（以 code point 計）。資料庫是最後防線。
import { hasBadChar, textLength } from "./brief";
import { cleanTextWithin } from "./onboarding";

export const MESSAGE_BODY_MAX = 2000;
// 清理前的截斷長度：至少要是上限的兩倍以上（cleanTextWithin 的規則）
const RAW_LIMIT = 4800;

export function cleanMessageBody(v: string): string {
  return cleanTextWithin(v.replace(/\r\n?/g, "\n"), RAW_LIMIT);
}

/** 已清理的內文；錯誤時回傳畫面文字，沒問題回傳 null。 */
export function validateMessageBody(body: string): string | null {
  if (body === "") return "請輸入訊息";
  if (hasBadChar(body)) return "含有不允許的特殊字元";
  if (textLength(body) > MESSAGE_BODY_MAX) return `訊息最多 ${MESSAGE_BODY_MAX} 字`;
  return null;
}
