// 網址參數 ⇄ 查詢。任何垃圾值都不能讓頁面或資料庫報錯（followups「搜尋與篩選必須能容忍清單以外的值」）。
import { CATEGORIES } from "@/lib/options";
import { cleanText } from "@/lib/validation/onboarding";
import { hasBadChar, type BriefStep } from "@/lib/validation/brief";
import { OPPORTUNITY_PAGE_SIZE, type BrandBriefTab } from "./view";

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function first(p: Params, key: string): string | null {
  if (p instanceof URLSearchParams) return p.get(key);
  const v = p[key];
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 網址的 [id] 與 Server Action 的 id 先檢查格式，避免把垃圾送進 uuid 參數（22P02）。 */
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

// ── 創作者：機會頁 ──

export type OpportunityTab = "match" | "all" | "category" | "cash" | "product" | "applied";
export type OpportunityQuery = { tab: OpportunityTab; category: string | null };
export const DEFAULT_OPPORTUNITY_QUERY: OpportunityQuery = { tab: "match", category: null };

const SIMPLE_TABS: readonly string[] = ["all", "cash", "product", "applied"];

/** ?tab=all|cash|product|applied、?cat=<內容領域>（cat 優先）；其他一律是「適合我」。 */
export function parseOpportunityQuery(p: Params): OpportunityQuery {
  const cat = Array.from(cleanText(first(p, "cat") ?? "")).slice(0, 30).join("");
  // NUL 送進資料庫會 22P05、bidi 字元資料庫也不收：這種 cat 直接忽略，退回預設
  if (cat && !hasBadChar(cat)) return { tab: "category", category: cat };
  const tab = first(p, "tab");
  if (tab && SIMPLE_TABS.includes(tab)) return { tab: tab as OpportunityTab, category: null };
  return DEFAULT_OPPORTUNITY_QUERY;
}

/** 查詢字串（不含 ?）：載入更多時原樣送回伺服器重新解析。 */
export function opportunityQueryString(q: OpportunityQuery): string {
  if (q.tab === "category" && q.category) return new URLSearchParams({ cat: q.category }).toString();
  if (q.tab === "match" || q.tab === "category") return "";
  return new URLSearchParams({ tab: q.tab }).toString();
}

export function opportunityHref(q: OpportunityQuery): string {
  const qs = opportunityQueryString(q);
  return qs ? `/creator?${qs}` : "/creator";
}

/** 機會頁上方的篩選標籤（一次只選一個）。 */
export const OPPORTUNITY_FILTERS: { label: string; query: OpportunityQuery }[] = [
  { label: "適合我", query: DEFAULT_OPPORTUNITY_QUERY },
  { label: "全部", query: { tab: "all", category: null } },
  ...CATEGORIES.map((c) => ({ label: c, query: { tab: "category" as const, category: c } })),
  { label: "現金", query: { tab: "cash", category: null } },
  { label: "互惠", query: { tab: "product", category: null } },
];

export function sameOpportunityQuery(a: OpportunityQuery, b: OpportunityQuery): boolean {
  return a.tab === b.tab && a.category === b.category;
}

/** list_opportunities 的參數（「我的報名」不呼叫這個函式）。 */
export function toListArgs(q: OpportunityQuery, offset: number) {
  const filter = q.tab === "applied" ? "all" : q.tab;
  return {
    p_filter: filter,
    ...(filter === "category" && q.category ? { p_category: q.category } : {}),
    p_limit: OPPORTUNITY_PAGE_SIZE,
    p_offset: offset,
  };
}

// ── 品牌：我的招募、表單步驟 ──

export function parseBrandBriefTab(v: string | string[] | undefined): BrandBriefTab {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "draft" || s === "ended" ? s : "open";
}

export const BRAND_BRIEF_TABS: { value: BrandBriefTab; label: string }[] = [
  { value: "open", label: "發佈中" },
  { value: "draft", label: "草稿" },
  { value: "ended", label: "已結束" },
];

/** ?step=1..4；其他一律是 1。 */
export function parseBriefStep(v: string | string[] | undefined | null): BriefStep {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "2" || s === "3" || s === "4" ? (Number(s) as BriefStep) : 1;
}
