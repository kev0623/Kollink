// 列表分頁（頁數在網址 ?page=，1 起算）。管理後台有自己的每頁筆數（src/lib/admin/query.ts），算法共用這裡的。

/** 品牌與創作者列表的每頁筆數。資料庫函式 list_brief_applicants_page 的上限是 50（兩邊一起改）。 */
export const PAGE_SIZE = 20;
/** 頁數上限：避免 ?page=999999999 讓資料庫做很大的 offset。 */
export const MAX_PAGE = 1000;

/** ?page=：正整數；其他任何值都是 1，超過上限就是上限。 */
export function parsePage(v: string | string[] | undefined): number {
  const x = Array.isArray(v) ? v[0] : v;
  if (!x || !/^\d{1,7}$/.test(x)) return 1;
  const n = Number(x);
  return n < 1 ? 1 : Math.min(n, MAX_PAGE);
}

/** 總頁數（至少 1）。 */
export function pageCount(total: number, size: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

/** 這一頁在資料庫的範圍（含頭尾，給 PostgREST 的 range(from, to)）。 */
export function pageRange(page: number, size: number = PAGE_SIZE): { from: number; to: number } {
  const from = (Math.max(1, page) - 1) * size;
  return { from, to: from + size - 1 };
}

/** 網址的頁數超過最後一頁（資料變少、舊連結）時要改去的頁數；不用改回 null。 */
export function pageOverflow(page: number, total: number, size: number = PAGE_SIZE): number | null {
  const last = pageCount(total, size);
  return page > last ? last : null;
}

/** 「第 21–40 筆，共 57 筆」用的範圍；沒有資料回 null。 */
export function pageSpan(page: number, total: number, size: number = PAGE_SIZE): { first: number; last: number } | null {
  if (total <= 0) return null;
  const p = Math.min(Math.max(1, page), pageCount(total, size));
  return { first: (p - 1) * size + 1, last: Math.min(p * size, total) };
}

export type PageItem = { kind: "page"; page: number } | { kind: "gap"; key: string };

/**
 * 頁碼列：第一頁、最後一頁、目前頁與前後各一頁，中間省略的地方用 gap。7 頁以內全部列出。
 * 例：page 6 / 20 → 1 … 5 6 7 … 20
 */
export function pageItems(page: number, pages: number): PageItem[] {
  const cur = Math.min(Math.max(1, page), pages);
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => ({ kind: "page" as const, page: i + 1 }));
  const want = new Set<number>([1, pages, cur - 1, cur, cur + 1]);
  // 靠近兩端時多列幾個，讓項目數固定（不會點一下版面就變寬）
  if (cur <= 4) [2, 3, 4, 5].forEach((n) => want.add(n));
  if (cur >= pages - 3) [pages - 4, pages - 3, pages - 2, pages - 1].forEach((n) => want.add(n));
  const list = [...want].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: PageItem[] = [];
  list.forEach((n, i) => {
    if (i > 0 && n - list[i - 1] > 1) out.push({ kind: "gap", key: `gap-${list[i - 1]}` });
    out.push({ kind: "page", page: n });
  });
  return out;
}

/** 在既有的查詢參數上換頁：第 1 頁不帶 page。hash 例如 "#applicants"。 */
export function pageHref(basePath: string, params: Record<string, string | undefined>, page: number, hash = ""): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return `${basePath}${s ? `?${s}` : ""}${hash}`;
}
