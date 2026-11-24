// 「今天」一律是台灣時間（Asia/Taipei）的日期，與 SQL 的 public.today_tw() 相同規則。
// 日期字串一律是 YYYY-MM-DD（Postgres date 的 JSON 格式）。

const TW_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
});
const TW_DATE_TIME = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** 截止日最晚是今天起算第 90 天（含）。 */
export const MAX_DEADLINE_DAYS = 90;

/** 台灣今天的日期。會讀現在時間：伺服器元件裡只能在 requireRole／await searchParams 之後呼叫。 */
export function todayTw(now: Date = new Date()): string {
  return TW_DATE.format(now);
}

/** 是否為存在的日期（拒絕 2026-02-30 這種）。 */
export function isIsoDate(v: string): boolean {
  const m = ISO_DATE_RE.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** to − from 的天數（同一天是 0）。 */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** 「今天截止」「剩 3 天」；已過截止日是「已截止」。 */
export function deadlineLabel(deadline: string, today: string): string {
  const n = daysBetween(today, deadline);
  if (n < 0) return "已截止";
  if (n === 0) return "今天截止";
  return `剩 ${n} 天`;
}

/** 2026-11-24 → 2026/11/24 */
export function formatDate(date: string): string {
  return date.replaceAll("-", "/");
}

/** timestamptz（ISO 字串）→ 台灣時間的 2026/11/24 */
export function formatDateTw(iso: string): string {
  return formatDate(todayTw(new Date(iso)));
}

/** timestamptz（ISO 字串）→ 台灣時間的 2026/11/24 14:05 */
export function formatDateTimeTw(iso: string): string {
  const parts = Object.fromEntries(TW_DATE_TIME.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}
