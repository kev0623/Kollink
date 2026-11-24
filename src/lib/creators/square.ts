import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toSearchArgs, type SquareQuery } from "./square-query";
import { toSquarePage, type SquareCreatorRow, type SquarePage } from "./square-view";

/**
 * 以目前品牌的身分搜尋（search_creators 只給品牌，否則 42501）。
 * 會讀 cookie：只能在 requireRole 之後（頁面的 <Suspense> 內或 Server Action）呼叫。不快取。
 */
export async function searchSquare(query: SquareQuery, offset = 0): Promise<SquarePage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_creators", toSearchArgs(query, offset));
  if (error) throw error;
  // 產生的型別把欄位都標成非 null，實際上可能是 null，所以轉成自己的 Row 型別
  return toSquarePage((data ?? []) as unknown as SquareCreatorRow[], offset);
}

/** 已審核創作者用過的風格標籤（最多 20 個，次數多的在前）。 */
export async function loadPopularStyleTags(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("popular_style_tags");
  if (error) throw error;
  return ((data ?? []) as unknown as { tag: string | null }[])
    .map((r) => r.tag)
    .filter((t): t is string => typeof t === "string" && t.length > 0);
}
