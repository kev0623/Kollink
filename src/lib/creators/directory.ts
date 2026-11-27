// 公開的創作者列表（/creators 與首頁）：查詢參數、型別與轉換。server 與 client 都能 import。
// 資料庫：list_public_creators（20261203000100_public_creators.sql）。
import type { L } from "@/lib/lang";
import { optionLabel } from "@/lib/lang";
import { CATEGORIES, REGIONS } from "@/lib/options";
import { parsePage } from "@/lib/paging";

/** 每頁幾位（SQL 的預設 p_limit 相同；上限 24） */
export const PUBLIC_CREATORS_PAGE_SIZE = 12;
/** 關鍵字上限（SQL 的 left(…, 50) 相同） */
export const DIRECTORY_QUERY_MAX = 50;
export const DIRECTORY_PATH = "/creators";

export const DIRECTORY_SORTS = [
  { value: "newest", label: { zh: "最新加入", en: "Newest" } },
  { value: "followers", label: { zh: "粉絲數多", en: "Most followers" } },
  { value: "rating", label: { zh: "評價高", en: "Top rated" } },
  { value: "price", label: { zh: "起價低", en: "Lowest price" } },
] as const satisfies readonly { value: string; label: L }[];
export type DirectorySort = (typeof DIRECTORY_SORTS)[number]["value"];

/** 訪客看不到粉絲數，所以也不能依粉絲數排序（資料庫同樣會忽略）。 */
export function directorySortsFor(signedIn: boolean) {
  return DIRECTORY_SORTS.filter((s) => signedIn || s.value !== "followers");
}

export type DirectoryQuery = { q: string; category: string | null; region: string | null; sort: DirectorySort; page: number };

type Param = string | string[] | undefined;
const first = (v: Param): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");

/** 網址參數 → 查詢。不認得的值一律退回預設（不報錯）。 */
export function parseDirectoryQuery(sp: Record<string, Param>): DirectoryQuery {
  const q = [...first(sp.q).trim()].slice(0, DIRECTORY_QUERY_MAX).join("");
  const category = first(sp.category);
  const region = first(sp.region);
  const sort = first(sp.sort);
  return {
    q,
    category: (CATEGORIES as readonly string[]).includes(category) ? category : null,
    region: (REGIONS as readonly string[]).includes(region) ? region : null,
    sort: DIRECTORY_SORTS.some((s) => s.value === sort) ? (sort as DirectorySort) : "newest",
    page: parsePage(sp.page),
  };
}

/** 查詢 → 網址（預設值不寫進網址）。 */
export function directoryHref(q: Partial<DirectoryQuery>): string {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.category) p.set("category", q.category);
  if (q.region) p.set("region", q.region);
  if (q.sort && q.sort !== "newest") p.set("sort", q.sort);
  if (q.page && q.page > 1) p.set("page", String(q.page));
  const s = p.toString();
  return s ? `${DIRECTORY_PATH}?${s}` : DIRECTORY_PATH;
}

export function hasDirectoryFilter(q: DirectoryQuery): boolean {
  return q.q !== "" || q.category !== null || q.region !== null;
}

export type DirectoryRow = {
  handle: string | null;
  display_name: string | null;
  avatar_path: string | null;
  cover_path: string | null;
  region: string | null;
  categories: string[] | null;
  follower_count: number | null;
  engagement_rate: number | string | null;
  avg_rating: number | string | null;
  review_count: number | null;
  min_price?: number | null;
  total_count: number | string | null;
};

export type DirectoryCreator = {
  handle: string;
  displayName: string;
  avatarPath: string | null;
  coverPath: string | null;
  region: string | null;
  categories: string[];
  /** 粉絲數：登入後才有；訪客是 null */
  followerCount: number | null;
  engagementRate: number | null;
  rating: number | null;
  reviewCount: number;
  /** 起價（所有報價的最低價）；沒有報價是 null。公開顯示 */
  minPrice: number | null;
};

function num(v: number | string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toDirectory(rows: DirectoryRow[]): { items: DirectoryCreator[]; total: number } {
  const items: DirectoryCreator[] = [];
  for (const r of rows) {
    if (!r.handle) continue;
    const reviewCount = r.review_count ?? 0;
    items.push({
      handle: r.handle,
      displayName: r.display_name || r.handle,
      avatarPath: r.avatar_path,
      coverPath: r.cover_path,
      region: r.region,
      categories: r.categories ?? [],
      followerCount: r.follower_count ?? null,
      engagementRate: num(r.engagement_rate),
      rating: reviewCount > 0 ? num(r.avg_rating) : null,
      reviewCount,
      minPrice: r.min_price ?? null,
    });
  }
  return { items, total: num(rows[0]?.total_count ?? null) ?? 0 };
}

/** 結果標題：「美妝・台北市的創作者」「「小美」的搜尋結果」「所有創作者」（雙語） */
export function directoryHeading(q: DirectoryQuery): L {
  if (q.q) return { zh: `「${q.q}」的搜尋結果`, en: `Results for “${q.q}”` };
  const parts = [q.category, q.region].filter((p): p is string => Boolean(p)).map(optionLabel);
  return parts.length > 0
    ? { zh: `${parts.map((p) => p.zh).join("・")}的創作者`, en: `${parts.map((p) => p.en).join(", ")} creators` }
    : { zh: "所有創作者", en: "All creators" };
}
