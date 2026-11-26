// 聯絡方式偵測（送出前提醒用）。規則與 supabase/migrations/20261126000100_messaging_write.sql 的 has_contact_info
// 完全相同；改一邊就要改另一邊，並更新兩邊共用的測試案例（contact.test.ts、18_messaging_write.test.sql）。
// 先 NFKC 正規化再轉小寫，並去掉不可見字元（U+00AD、U+034F、U+200B–U+200F、U+2060–U+2064、U+FEFF）；
// 電話另外去掉空白、Tab、括號、點、連字號、底線、斜線。所有 regex 都加 u 旗標（astral 字元算一個字，與 Postgres 一致）。資料庫的 trigger 才是最後的判斷。

export type ContactKind = "phone" | "email" | "line" | "link";

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/u;
const LINK_RES = [
  /(https?:\/\/|www\.)/u,
  /[a-z0-9-]\.(com|net|org|tw|me|io|co|cc|ly|gl|app|link|page|site)([^a-z0-9]|$)/u,
];
const LINE_RES = [/(^|[^a-z])line[ \t]*(id|[:@])/u, /加[^\n]{0,2}(賴|line)/u, /賴[ \t]*(id|[:@])/u];
const INVISIBLE_RE = /[\u00ad\u034f\u200b-\u200f\u2060-\u2064\ufeff]/gu;
const PHONE_STRIP_RE = /[ \t().\-_/]/gu;
const PHONE_RES = [/(^|[^0-9])(\+?886|0)9[0-9]{8}([^0-9]|$)/u, /(^|[^0-9])0[2-8][0-9]{7,8}([^0-9]|$)/u];

export const CONTACT_LABEL: Record<ContactKind, string> = {
  phone: "電話",
  email: "Email",
  line: "LINE",
  link: "外部連結",
};

/** 訊息裡可能含有的聯絡方式（依電話、Email、LINE、外部連結的順序）；沒有回傳空陣列。 */
export function contactKinds(text: string): ContactKind[] {
  const v = text.normalize("NFKC").toLowerCase().replace(INVISIBLE_RE, "");
  const digits = v.replace(PHONE_STRIP_RE, "");
  const kinds: ContactKind[] = [];
  if (PHONE_RES.some((r) => r.test(digits))) kinds.push("phone");
  if (EMAIL_RE.test(v)) kinds.push("email");
  if (LINE_RES.some((r) => r.test(v))) kinds.push("line");
  if (LINK_RES.some((r) => r.test(v))) kinds.push("link");
  return kinds;
}

/** 送出前的提醒文字；沒有偵測到回傳 null。 */
export function contactWarning(kinds: ContactKind[]): string | null {
  if (kinds.length === 0) return null;
  const what = kinds.map((k) => CONTACT_LABEL[k]).join("、");
  return `這則訊息可能含有${what}。為了保障雙方權益，請在平台內溝通與付款；仍可送出，但平台會留存紀錄。`;
}
