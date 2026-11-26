// 合作案表單的解析與驗證。規則與資料庫一致，資料庫是最後防線：
// check_collab_offer（20261125000100_collab_create.sql）、submit_deliverables（20261125000200_deliverables.sql）、
// transition_collaboration 的貼文連結 regex（20261122000300_collaborations.sql）。
import { isOwnDeliverablePath, MAX_DELIVERABLE_FILES } from "@/lib/deliverables";
import { hasBadChar, textLength } from "./brief";
import { cleanText, cleanTextWithin } from "./onboarding";

export const TITLE_MAX = 60;
export const DELIVERABLES_MAX = 1000;
export const NOTE_MAX = 1000;
export const LINKS_MAX = 5;
export const LINK_MAX_LEN = 500;
// 貼文網址上限；與 transition_collaboration 的 char_length(v_url) > 500（20261125000500_collab_text_guards.sql）一致
export const POST_URL_MAX = 500;
export const AMOUNT_MAX = 10_000_000;
// 清理前的截斷長度：至少要是上限的兩倍以上（cleanTextWithin 的規則）
const LONG_RAW_LIMIT = 2400;
const BAD_CHAR_MESSAGE = "含有不允許的特殊字元";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

/** 多行文字：CRLF → LF 後清理。 */
export function cleanLongText(v: string): string {
  return cleanTextWithin(v.replace(/\r\n?/g, "\n"), LONG_RAW_LIMIT);
}

/** 金額：去掉千分位逗號與空白，必須是 1..10,000,000 的整數；否則 null。 */
export function parseAmount(v: string): number | null {
  const d = cleanText(v).replace(/[,，\s]/g, "");
  if (!/^\d{1,8}$/.test(d)) return null;
  const n = Number(d);
  return n >= 1 && n <= AMOUNT_MAX ? n : null;
}

export type OfferInput = { title: string; deliverables: string; amount: string };

export function parseOfferForm(fd: FormData): OfferInput {
  return {
    title: cleanText(str(fd, "title")),
    deliverables: cleanLongText(str(fd, "deliverables")),
    amount: str(fd, "amount"),
  };
}

/** withTitle：直接邀請要填案名；錄取時案名 = 招募名稱，不檢查。 */
export function validateOffer(i: OfferInput, withTitle: boolean): Record<string, string> | null {
  const e: Record<string, string> = {};
  if (withTitle) {
    if (hasBadChar(i.title)) e.title = BAD_CHAR_MESSAGE;
    else if (i.title === "") e.title = "請填寫案名";
    else if (textLength(i.title) > TITLE_MAX) e.title = `最多 ${TITLE_MAX} 字`;
  }
  if (hasBadChar(i.deliverables)) e.deliverables = BAD_CHAR_MESSAGE;
  else if (i.deliverables === "") e.deliverables = "請填寫交付內容";
  else if (textLength(i.deliverables) > DELIVERABLES_MAX) e.deliverables = `最多 ${DELIVERABLES_MAX} 字`;
  if (parseAmount(i.amount) === null) e.amount = "請填 1 到 10,000,000 的整數";
  return Object.keys(e).length ? e : null;
}

/** 要求修改的說明：必填、最多 1000 字。回傳錯誤文字或 null。 */
export function validateRevisionNote(note: string): string | null {
  if (hasBadChar(note)) return BAD_CHAR_MESSAGE;
  if (note === "") return "請寫下要修改的地方";
  if (textLength(note) > NOTE_MAX) return `最多 ${NOTE_MAX} 字`;
  return null;
}

// 與資料庫相同的 regex：資料庫只看格式，所以 a..b.com 這種會通過；網域另外用 new URL() 檢查
const DB_POST_URL_RE = /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}\/\S+$/;
const DB_LINK_RE = /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/\S*)?$/;
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

function hostOk(u: URL): boolean {
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const labels = u.hostname.split(".");
  return labels.length >= 2 && labels.every((l) => LABEL_RE.test(l)) && /^[a-z]{2,}$/i.test(labels[labels.length - 1]);
}

/** 貼文連結：https、網域合法、有路徑。 */
export function isValidPostUrl(v: string): boolean {
  if ([...v].length > POST_URL_MAX || !DB_POST_URL_RE.test(v)) return false;
  try {
    const u = new URL(v);
    return hostOk(u) && u.pathname.length > 1;
  } catch {
    return false;
  }
}

/** 交稿附的連結：https、網域合法，路徑可省略；最多 500 字。 */
export function isValidLink(v: string): boolean {
  if ([...v].length > LINK_MAX_LEN || !DB_LINK_RE.test(v)) return false;
  try {
    return hostOk(new URL(v));
  } catch {
    return false;
  }
}

/** 連結輸入框（一行一個）→ 清理後的非空白連結。 */
export function parseLinks(raw: string): string[] {
  return raw.replace(/\r\n?/g, "\n").split("\n").map(cleanText).filter((l) => l !== "");
}

export type SubmissionInput = { note: string; links: string[]; filePaths: string[] };

/** 交稿：說明 ≤ 1000 字、連結 ≤ 5 個且格式正確、檔案 ≤ 10 個且在自己的資料夾、不重複；檔案或連結至少一個。 */
export function validateSubmission(i: SubmissionInput, collabId: string, uid: string): Record<string, string> | null {
  const e: Record<string, string> = {};
  if (hasBadChar(i.note)) e.note = BAD_CHAR_MESSAGE;
  else if (textLength(i.note) > NOTE_MAX) e.note = `最多 ${NOTE_MAX} 字`;
  if (i.links.length > LINKS_MAX) e.links = `最多 ${LINKS_MAX} 個連結`;
  else if (i.links.some((l) => hasBadChar(l) || !isValidLink(l))) e.links = "連結必須是 https:// 開頭的完整網址";
  if (i.filePaths.length > MAX_DELIVERABLE_FILES) e.files = `一次最多 ${MAX_DELIVERABLE_FILES} 個檔案`;
  else if (new Set(i.filePaths).size !== i.filePaths.length || i.filePaths.some((p) => !isOwnDeliverablePath(collabId, uid, p))) {
    e.files = "檔案資料不正確，請重新上傳";
  }
  if (!e.links && !e.files && i.links.length + i.filePaths.length === 0) e.files = "請上傳檔案或附上連結";
  return Object.keys(e).length ? e : null;
}

/**
 * 錄取金額低於創作者報名時的報價：合作案會先進入「等待創作者確認」（invited），創作者接受後品牌才能付款。
 * 與 accept_application_with_collab（20261129000100_security_hardening.sql）的規則相同；沒有報價時不需要確認。
 */
export function needsCreatorConsent(amount: number | null, proposedPrice: number | null): boolean {
  return amount !== null && proposedPrice !== null && amount < proposedPrice;
}

const SUMMARY_CHARS = 200;

/**
 * 錄取表單的預設值。金額：報名報價 → 招募預算上限 → 下限 → 空白。
 * 交付內容：合作形式（、連接）+ 換行 + 說明前 200 字（超過加「…」），不超過 1000 字。
 */
export function acceptDefaults(
  proposedPrice: number | null,
  brief: { budgetMin: number | null; budgetMax: number | null; collabTypes: string[]; description: string },
): { amount: string; deliverables: string } {
  const price = proposedPrice !== null && proposedPrice > 0 ? proposedPrice : (brief.budgetMax ?? brief.budgetMin);
  const chars = [...brief.description.trim()];
  const summary = chars.length > SUMMARY_CHARS ? `${chars.slice(0, SUMMARY_CHARS).join("")}…` : chars.join("");
  const text = [brief.collabTypes.join("、"), summary].filter((s) => s !== "").join("\n");
  return { amount: price ? String(price) : "", deliverables: [...text].slice(0, DELIVERABLES_MAX).join("") };
}
