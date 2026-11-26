// 管理後台的網址參數（?status=、?view=、?q=、?page=）。一律容忍不認得的值：退回預設，不報錯。
import type { CollabStatus } from "@/lib/collabs/view";

/** 每頁筆數（資料庫函式的上限是 100）。 */
export const ADMIN_PAGE_SIZE = 50;
/** 頁數上限：避免 ?page=999999999 讓資料庫做很大的 offset。 */
export const ADMIN_MAX_PAGE = 1000;
/** 關鍵字上限（與資料庫 left(…, 50) 相同）。 */
export const ADMIN_QUERY_MAX = 50;

export type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** ?page=：1 起算的正整數；其他任何值都是 1，超過上限就是上限。 */
export function parsePage(v: string | string[] | undefined): number {
  const x = first(v);
  if (!x || !/^\d{1,7}$/.test(x)) return 1;
  const n = Number(x);
  return n < 1 ? 1 : Math.min(n, ADMIN_MAX_PAGE);
}

/** ?q=：去掉前後空白、截成 50 字（以 code point 計算）。 */
export function parseQuery(v: string | string[] | undefined): string {
  const x = (first(v) ?? "").trim();
  return Array.from(x).slice(0, ADMIN_QUERY_MAX).join("").trim();
}

function pick<T extends string>(v: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const x = first(v);
  return x !== undefined && (allowed as readonly string[]).includes(x) ? (x as T) : fallback;
}

export type CreatorFilter = "pending" | "rejected" | "approved" | "suspended" | "all";
export const CREATOR_FILTERS: { value: CreatorFilter; label: string }[] = [
  { value: "pending", label: "待審核" },
  { value: "rejected", label: "已退回" },
  { value: "approved", label: "已審核" },
  { value: "suspended", label: "已停權" },
  { value: "all", label: "全部" },
];
export function parseCreatorFilter(v: string | string[] | undefined): CreatorFilter {
  return pick(v, CREATOR_FILTERS.map((f) => f.value), "pending");
}

export type CollabFilter = "active" | "all" | CollabStatus;
export const COLLAB_FILTERS: { value: CollabFilter; label: string }[] = [
  { value: "active", label: "進行中" },
  { value: "awaiting_payment", label: "等待付款" },
  { value: "awaiting_submission", label: "待交稿" },
  { value: "in_review", label: "審核中" },
  { value: "awaiting_publish", label: "待發佈" },
  { value: "awaiting_payout", label: "待撥款" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
  { value: "declined", label: "已婉拒" },
  { value: "invited", label: "邀約中" },
  { value: "all", label: "全部" },
];
export function parseCollabFilter(v: string | string[] | undefined): CollabFilter {
  return pick(v, COLLAB_FILTERS.map((f) => f.value), "active");
}

export type MoneyTab = "payouts" | "refunds" | "anomalies" | "payments";
export const MONEY_TABS: { value: MoneyTab; label: string }[] = [
  { value: "payouts", label: "待撥款" },
  { value: "refunds", label: "需退款" },
  { value: "anomalies", label: "付款異常" },
  { value: "payments", label: "全部付款單" },
];
export function parseMoneyTab(v: string | string[] | undefined): MoneyTab {
  return pick(v, MONEY_TABS.map((t) => t.value), "payouts");
}

export type MessageFilter = "open" | "reviewed" | "all";
export const MESSAGE_FILTERS: { value: MessageFilter; label: string }[] = [
  { value: "open", label: "未檢視" },
  { value: "reviewed", label: "已檢視" },
  { value: "all", label: "全部" },
];
export function parseMessageFilter(v: string | string[] | undefined): MessageFilter {
  return pick(v, MESSAGE_FILTERS.map((f) => f.value), "open");
}

/** 第幾筆開始（給資料庫的 p_offset）。 */
export function offsetOf(page: number): number {
  return (page - 1) * ADMIN_PAGE_SIZE;
}

/** 總頁數（至少 1）。 */
export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / ADMIN_PAGE_SIZE));
}

/**
 * 組管理後台的網址：值是 null、undefined、空字串，或等於該參數的預設值（defaults）時省略，
 * 讓預設狀態的網址保持乾淨（例如 /admin/creators 而不是 /admin/creators?status=pending&page=1）。
 */
export function adminHref(
  path: string,
  params: Record<string, string | number | null | undefined>,
  defaults: Record<string, string | number> = {},
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    if (k === "page" && v === 1) continue;
    if (Object.hasOwn(defaults, k) && defaults[k] === v) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}
