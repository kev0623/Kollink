// 創作者「收入」與品牌「付款紀錄」頁的純函式：加總、分組、?view= 解析。
// 資料來自 list_my_collaborations（每個分頁最多 200 筆）；金額單位是新台幣整數。
import type { CollabListItem, CollabStatus } from "@/lib/collabs/view";

/** list_my_collaborations 每個分頁最多回傳的筆數（SQL 的 limit 200）。達到這個數就可能還有更多沒讀到。 */
export const COLLAB_LIST_LIMIT = 200;

// ── 狀態分組 ──

/** 創作者：已收到＝已完成。 */
const CREATOR_RECEIVED: readonly CollabStatus[] = ["completed"];
/** 創作者：品牌已付款、平台正在處理撥款。 */
const CREATOR_AWAITING: readonly CollabStatus[] = ["awaiting_payout"];
/** 創作者：品牌已付款，但還沒到撥款（交稿、審核、發佈中）。 */
const CREATOR_IN_PROGRESS: readonly CollabStatus[] = ["awaiting_submission", "in_review", "awaiting_publish"];
/** 品牌：已付款（平台已人工確認收到款項）。 */
const BRAND_PAID: readonly CollabStatus[] = ["awaiting_submission", "in_review", "awaiting_publish", "awaiting_payout", "completed"];
const BRAND_UNPAID: readonly CollabStatus[] = ["awaiting_payment"];

/** 加總：金額不是有限數字（null、NaN）當 0，負數也當 0。 */
export function sumAmount(items: Pick<CollabListItem, "amount">[]): number {
  return items.reduce((s, i) => s + (Number.isFinite(i.amount) && i.amount > 0 ? i.amount : 0), 0);
}

function inGroup(i: Pick<CollabListItem, "status">, group: readonly CollabStatus[]): boolean {
  return group.includes(i.status);
}

/** 由新到舊（updatedAt 解析不了的排最後；同時間以 id 排，結果固定）。不改動傳入的陣列。 */
export function sortNewestFirst<T extends Pick<CollabListItem, "updatedAt" | "id">>(items: T[]): T[] {
  const t = (x: T) => { const n = Date.parse(x.updatedAt); return Number.isNaN(n) ? -Infinity : n; };
  return [...items].sort((a, b) => {
    const d = t(b) - t(a);
    if (d !== 0 && !Number.isNaN(d)) return d;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** 兩個分頁的結果合起來，是否可能被 200 筆上限截斷（任何一個分頁滿 200 筆）。 */
export function mayBeTruncated(counts: number[]): boolean {
  return counts.some((n) => n >= COLLAB_LIST_LIMIT);
}

// ── 創作者：收入 ──

export type CreatorEarningsView = "all" | "received" | "awaiting" | "in_progress";
export const CREATOR_EARNINGS_VIEWS: { value: CreatorEarningsView; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "received", label: "已收到" },
  { value: "awaiting", label: "等待撥款" },
  { value: "in_progress", label: "進行中" },
];

function parseView<V extends string>(v: string | string[] | undefined, allowed: readonly V[], fallback: V): V {
  const x = Array.isArray(v) ? v[0] : v;
  return allowed.find((a) => a === x) ?? fallback;
}

/** ?view=；不認得的值都是「全部」。 */
export function parseCreatorEarningsView(v: string | string[] | undefined): CreatorEarningsView {
  return parseView(v, ["received", "awaiting", "in_progress"] as const, "all");
}

export type CreatorEarningsSummary = { received: number; awaiting: number; inProgress: number };

/** 已收到／等待撥款／進行中。邀約中、等待付款（品牌還沒付）與已取消、已婉拒、不認得的狀態都不計入。 */
export function summarizeCreatorEarnings(items: CollabListItem[]): CreatorEarningsSummary {
  return {
    received: sumAmount(items.filter((i) => inGroup(i, CREATOR_RECEIVED))),
    awaiting: sumAmount(items.filter((i) => inGroup(i, CREATOR_AWAITING))),
    inProgress: sumAmount(items.filter((i) => inGroup(i, CREATOR_IN_PROGRESS))),
  };
}

/** 收入頁的列表：「全部」是除了已取消、已婉拒以外的所有合作（含還沒付款的），其他分組只含該分組的狀態。由新到舊。 */
export function creatorEarningsRows(items: CollabListItem[], view: CreatorEarningsView): CollabListItem[] {
  const open = items.filter((i) => i.status !== "cancelled" && i.status !== "declined");
  const picked = view === "all" ? open
    : view === "received" ? open.filter((i) => inGroup(i, CREATOR_RECEIVED))
    : view === "awaiting" ? open.filter((i) => inGroup(i, CREATOR_AWAITING))
    : open.filter((i) => inGroup(i, CREATOR_IN_PROGRESS));
  return sortNewestFirst(picked);
}

// ── 品牌：付款紀錄 ──

export type BrandPaymentsView = "all" | "paid" | "awaiting_payment";
export const BRAND_PAYMENTS_VIEWS: { value: BrandPaymentsView; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "paid", label: "已付款" },
  { value: "awaiting_payment", label: "等待付款" },
];

export function parseBrandPaymentsView(v: string | string[] | undefined): BrandPaymentsView {
  return parseView(v, ["paid", "awaiting_payment"] as const, "all");
}

export type BrandPaymentsSummary = { paid: number; awaitingPayment: number };

export function summarizeBrandPayments(items: CollabListItem[]): BrandPaymentsSummary {
  return {
    paid: sumAmount(items.filter((i) => inGroup(i, BRAND_PAID))),
    awaitingPayment: sumAmount(items.filter((i) => inGroup(i, BRAND_UNPAID))),
  };
}

/** 付款紀錄的列表：只含和付款有關的（已付款、等待付款）；邀約中、已取消與已婉拒不列。由新到舊。 */
export function brandPaymentsRows(items: CollabListItem[], view: BrandPaymentsView): CollabListItem[] {
  const paid = items.filter((i) => inGroup(i, BRAND_PAID));
  const unpaid = items.filter((i) => inGroup(i, BRAND_UNPAID));
  return sortNewestFirst(view === "paid" ? paid : view === "awaiting_payment" ? unpaid : [...paid, ...unpaid]);
}

/** 付款是測試模式（綠界 stage）時，金額不是實際收款，頁面要提示。 */
export function isTestPaymentMode(a: { enabled: boolean; env: "stage" | "prod" | null }): boolean {
  return a.enabled && a.env === "stage";
}

/** 創作者「全部」列表裡有沒有還沒計入金額的合作案（邀約中、等待付款）。 */
export function hasUncountedRows(items: Pick<CollabListItem, "status">[]): boolean {
  return items.some((i) => i.status === "invited" || i.status === "awaiting_payment");
}
