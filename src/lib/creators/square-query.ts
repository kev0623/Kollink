import { cleanText, hasBidi } from "@/lib/validation/onboarding";

export const SQUARE_PAGE_SIZE = 24;
export const KEYWORD_MAX = 50;
const VALUE_MAX = 30;
const LIST_MAX = 20;

export const SQUARE_SORTS = ["newest", "followers", "engagement", "price"] as const;
export type SquareSort = (typeof SQUARE_SORTS)[number];
export const SORT_LABELS: Record<SquareSort, string> = {
  newest: "最新加入",
  followers: "粉絲數（高到低）",
  engagement: "互動率（高到低）",
  price: "起價（低到高）",
};

// 區間一律「含下限、不含上限」，與 search_creators 的 p_*_min／p_*_max 相同
export const FOLLOWER_RANGES = [
  { key: "lt1k", label: "1 千以下", min: null, max: 1000 },
  { key: "1k-10k", label: "1 千到 1 萬", min: 1000, max: 10000 },
  { key: "10k-100k", label: "1 萬到 10 萬", min: 10000, max: 100000 },
  { key: "gte100k", label: "10 萬以上", min: 100000, max: null },
] as const;
export const ENGAGEMENT_OPTIONS = [
  { key: "1", label: "≥ 1%", min: 1 },
  { key: "3", label: "≥ 3%", min: 3 },
  { key: "5", label: "≥ 5%", min: 5 },
] as const;
export const PRICE_RANGES = [
  { key: "lt5k", label: "5 千以下", min: null, max: 5000 },
  { key: "5k-20k", label: "5 千到 2 萬", min: 5000, max: 20000 },
  { key: "gte20k", label: "2 萬以上", min: 20000, max: null },
] as const;

export type FollowerKey = (typeof FOLLOWER_RANGES)[number]["key"];
export type EngagementKey = (typeof ENGAGEMENT_OPTIONS)[number]["key"];
export type PriceKey = (typeof PRICE_RANGES)[number]["key"];

export type SquareQuery = {
  q: string;
  fav: boolean;
  categories: string[];
  tags: string[];
  followers: FollowerKey | null;
  engagement: EngagementKey | null;
  price: PriceKey | null;
  regions: string[];
  collabs: string[];
  sort: SquareSort;
};

export const EMPTY_SQUARE_QUERY: SquareQuery = {
  q: "", fav: false, categories: [], tags: [], followers: null, engagement: null, price: null,
  regions: [], collabs: [], sort: "newest",
};

/** 網址參數名稱：分享出去的網址就長這樣，改名會讓舊網址失效。 */
const P = {
  q: "q", fav: "fav", categories: "cat", tags: "tag", followers: "followers", engagement: "er",
  price: "price", regions: "region", collabs: "collab", sort: "sort",
} as const;

export type ParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

function getAll(input: ParamsInput, key: string): string[] {
  if (input instanceof URLSearchParams) return input.getAll(key);
  const v = input[key];
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === "string");
}

/** 多選值：清理後去掉空的、含雙向控制字元的、超過 30 字的、重複的；最多 20 個。清單以外的值保留。 */
function parseList(input: ParamsInput, key: string): string[] {
  const out: string[] = [];
  for (const raw of getAll(input, key)) {
    const v = cleanText(raw);
    if (!v || hasBidi(v) || Array.from(v).length > VALUE_MAX || out.includes(v)) continue;
    out.push(v);
    if (out.length === LIST_MAX) break;
  }
  return out;
}

function parseKey<K extends string>(input: ParamsInput, key: string, options: readonly { key: K }[]): K | null {
  const v = getAll(input, key)[0];
  return options.find((o) => o.key === v)?.key ?? null;
}

/** 網址 → 查詢條件。任何值都不會丟錯：不認得的單選值當成沒選、多選值照上面的規則清理。 */
export function parseSquareQuery(input: ParamsInput): SquareQuery {
  const q = cleanText(getAll(input, P.q)[0] ?? "");
  const sort = getAll(input, P.sort)[0] ?? "";
  return {
    q: hasBidi(q) ? "" : Array.from(q).slice(0, KEYWORD_MAX).join(""),
    fav: getAll(input, P.fav)[0] === "1",
    categories: parseList(input, P.categories),
    tags: parseList(input, P.tags),
    followers: parseKey(input, P.followers, FOLLOWER_RANGES),
    engagement: parseKey(input, P.engagement, ENGAGEMENT_OPTIONS),
    price: parseKey(input, P.price, PRICE_RANGES),
    regions: parseList(input, P.regions),
    collabs: parseList(input, P.collabs),
    sort: (SQUARE_SORTS as readonly string[]).includes(sort) ? (sort as SquareSort) : "newest",
  };
}

/** 查詢條件 → 查詢字串（不含 ?）。預設值不輸出，所以沒有篩選時是空字串。 */
export function serializeSquareQuery(q: SquareQuery): string {
  const sp = new URLSearchParams();
  if (q.q) sp.set(P.q, q.q);
  if (q.fav) sp.set(P.fav, "1");
  for (const v of q.categories) sp.append(P.categories, v);
  for (const v of q.tags) sp.append(P.tags, v);
  if (q.followers) sp.set(P.followers, q.followers);
  if (q.engagement) sp.set(P.engagement, q.engagement);
  if (q.price) sp.set(P.price, q.price);
  for (const v of q.regions) sp.append(P.regions, v);
  for (const v of q.collabs) sp.append(P.collabs, v);
  if (q.sort !== "newest") sp.set(P.sort, q.sort);
  return sp.toString();
}

export function squareHref(q: SquareQuery): string {
  const s = serializeSquareQuery(q);
  return s ? `/brand?${s}` : "/brand";
}

/** 有幾個欄位在篩選（排序不算），手機「篩選（N）」按鈕用。 */
export function activeFilterCount(q: SquareQuery): number {
  return [
    q.q !== "", q.fav, q.categories.length > 0, q.tags.length > 0, q.followers !== null,
    q.engagement !== null, q.price !== null, q.regions.length > 0, q.collabs.length > 0,
  ].filter(Boolean).length;
}

/** 清除篩選：保留排序。 */
export function clearFilters(q: SquareQuery): SquareQuery {
  return { ...EMPTY_SQUARE_QUERY, sort: q.sort };
}

export function toggleValue(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** 沒有結果時顯示哪一種空狀態：只開了「只看收藏」→ 還沒有收藏；其他 → 找不到符合條件。 */
export function emptyStateOf(q: SquareQuery): "no-favorites" | "no-results" {
  return q.fav && activeFilterCount(q) === 1 ? "no-favorites" : "no-results";
}

/** search_creators 的參數；沒有篩選的欄位不帶（用資料庫的預設值）。 */
export type SearchArgs = {
  p_keyword?: string;
  p_favorites_only?: boolean;
  p_categories?: string[];
  p_style_tags?: string[];
  p_follower_min?: number;
  p_follower_max?: number;
  p_engagement_min?: number;
  p_price_min?: number;
  p_price_max?: number;
  p_regions?: string[];
  p_collab_types?: string[];
  p_sort: SquareSort;
  p_limit: number;
  p_offset: number;
};

export function toSearchArgs(q: SquareQuery, offset: number, limit: number = SQUARE_PAGE_SIZE): SearchArgs {
  const args: SearchArgs = { p_sort: q.sort, p_limit: limit, p_offset: offset };
  if (q.q) args.p_keyword = q.q;
  if (q.fav) args.p_favorites_only = true;
  if (q.categories.length) args.p_categories = q.categories;
  if (q.tags.length) args.p_style_tags = q.tags;
  if (q.regions.length) args.p_regions = q.regions;
  if (q.collabs.length) args.p_collab_types = q.collabs;
  const f = FOLLOWER_RANGES.find((r) => r.key === q.followers);
  if (f && f.min !== null) args.p_follower_min = f.min;
  if (f && f.max !== null) args.p_follower_max = f.max;
  const e = ENGAGEMENT_OPTIONS.find((o) => o.key === q.engagement);
  if (e) args.p_engagement_min = e.min;
  const p = PRICE_RANGES.find((r) => r.key === q.price);
  if (p && p.min !== null) args.p_price_min = p.min;
  if (p && p.max !== null) args.p_price_max = p.max;
  return args;
}
