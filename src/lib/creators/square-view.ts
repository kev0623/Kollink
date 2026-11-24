import { formatTwd } from "@/lib/format";
import { toNumberOrNull } from "./view";

export type SquareCreator = {
  userId: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  region: string | null;
  categories: string[];
  styleTags: string[];
  collabTypes: string[];
  followerCount: number;
  engagementRate: number | null;
  minPrice: number | null;
  postPrice: number | null;
  portfolioPaths: string[];
  isFavorite: boolean;
};

/** search_creators 回傳的一列。產生的型別把 RETURNS TABLE 的欄位都標成非 null，實際上可能是 null，所以自己定義。 */
export type SquareCreatorRow = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_path: string | null;
  region: string | null;
  categories: string[] | null;
  style_tags: string[] | null;
  collab_types: string[] | null;
  follower_count: number | null;
  engagement_rate: number | string | null;
  min_price: number | null;
  post_price: number | null;
  portfolio_paths: string[] | null;
  is_favorite: boolean | null;
  created_at: string | null;
  total_count: number | string | null;
};

export type SquarePage = { items: SquareCreator[]; total: number; hasMore: boolean };

export function toSquareCreator(r: SquareCreatorRow): SquareCreator {
  return {
    userId: r.user_id,
    handle: r.handle,
    displayName: r.display_name,
    avatarPath: r.avatar_path ?? null,
    region: r.region ?? null,
    categories: r.categories ?? [],
    styleTags: r.style_tags ?? [],
    collabTypes: r.collab_types ?? [],
    followerCount: r.follower_count ?? 0,
    engagementRate: toNumberOrNull(r.engagement_rate),
    minPrice: toNumberOrNull(r.min_price),
    postPrice: toNumberOrNull(r.post_price),
    portfolioPaths: r.portfolio_paths ?? [],
    isFavorite: r.is_favorite === true,
  };
}

/** total 來自第一列的 total_count（window 函式，每列都一樣）。 */
export function toSquarePage(rows: SquareCreatorRow[], offset: number): SquarePage {
  const items = rows.map(toSquareCreator);
  const total = rows.length > 0 ? (toNumberOrNull(rows[0].total_count) ?? 0) : 0;
  return { items, total, hasMore: items.length > 0 && offset + items.length < total };
}

/** 卡片上的標籤：最多 max 個，風格標籤優先，不夠再用合作類型補。 */
export function cardTags(c: Pick<SquareCreator, "styleTags" | "collabTypes">, max = 3): string[] {
  const out: string[] = [];
  for (const t of [...c.styleTags, ...c.collabTypes]) {
    if (out.length === max) break;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export function startingPriceLabel(minPrice: number | null): string {
  return minPrice === null ? "洽談" : formatTwd(minPrice);
}

export function postPriceLabel(price: number | null): string {
  return price === null ? "—" : formatTwd(price);
}

/** 「載入更多」：接在後面並去掉已經顯示過的人（翻頁期間有人新加入時 offset 會位移）。 */
export function appendUnique(current: SquareCreator[], next: SquareCreator[]): SquareCreator[] {
  const seen = new Set(current.map((c) => c.userId));
  return [...current, ...next.filter((c) => !seen.has(c.userId))];
}
