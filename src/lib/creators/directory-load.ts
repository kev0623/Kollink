import "server-only";
import { connection } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { pageRange } from "@/lib/paging";
import {
  PUBLIC_CREATORS_PAGE_SIZE, toDirectory, type DirectoryCreator, type DirectoryQuery, type DirectoryRow,
} from "./directory";

/**
 * 公開的創作者列表：一律用訪客身分讀（不讀 cookie，登入與否看到的都一樣）。
 * 審核狀態在後台改、App 無法觸發 revalidate，所以不快取，每次請求都讀。
 */
export async function loadPublicCreators(q: DirectoryQuery): Promise<{ items: DirectoryCreator[]; total: number }> {
  await connection();
  const { from } = pageRange(q.page, PUBLIC_CREATORS_PAGE_SIZE);
  const { data, error } = await createAnonClient().rpc("list_public_creators", {
    p_keyword: q.q || undefined,
    p_category: q.category ?? undefined,
    p_region: q.region ?? undefined,
    p_sort: q.sort,
    p_limit: PUBLIC_CREATORS_PAGE_SIZE,
    p_offset: from,
  });
  if (error) throw error;
  return toDirectory((data ?? []) as unknown as DirectoryRow[]);
}

/** 首頁用：最新加入的幾位。讀取失敗時回傳空陣列（首頁其他內容照常顯示）。 */
export async function loadFeaturedCreators(limit: number): Promise<DirectoryCreator[]> {
  await connection();
  const { data, error } = await createAnonClient().rpc("list_public_creators", { p_sort: "newest", p_limit: limit, p_offset: 0 });
  if (error) return [];
  return toDirectory((data ?? []) as unknown as DirectoryRow[]).items;
}
