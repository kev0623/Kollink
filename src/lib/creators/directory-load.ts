import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pageRange } from "@/lib/paging";
import {
  PUBLIC_CREATORS_PAGE_SIZE, toDirectory, type DirectoryCreator, type DirectoryQuery, type DirectoryRow,
} from "./directory";

/**
 * 公開的創作者列表：用目前的人的身分讀（會讀 cookie，只能在 <Suspense> 內呼叫）。
 * 登入的人多拿到粉絲數、可以依粉絲數排序；訪客的粉絲數是 null（資料庫決定，不是畫面隱藏）。
 * 審核狀態在後台改、App 無法觸發 revalidate，所以不快取，每次請求都讀。
 */
export async function loadPublicCreators(q: DirectoryQuery): Promise<{ items: DirectoryCreator[]; total: number }> {
  await connection();
  const { from } = pageRange(q.page, PUBLIC_CREATORS_PAGE_SIZE);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_public_creators", {
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
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_public_creators", { p_sort: "newest", p_limit: limit, p_offset: 0 });
  if (error) return [];
  return toDirectory((data ?? []) as unknown as DirectoryRow[]).items;
}
