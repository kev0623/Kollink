import "server-only";
import { createClient } from "@/lib/supabase/server";
import { pageRange } from "@/lib/paging";
import { toListArgs, type OpportunityQuery } from "./query";
import {
  MY_APPLICATION_COLUMNS, toMyApplications, toOpportunityDetail, toOpportunityPage,
  type MyApplication, type MyApplicationRow, type OpportunityDetail, type OpportunityDetailRow,
  type OpportunityPage, type OpportunityRow,
} from "./view";

// 創作者端讀取。用創作者自己的 client（definer 函式只給創作者）。會讀 cookie：只能在 requireRole 之後呼叫。不快取。

export async function listOpportunities(query: OpportunityQuery, offset = 0): Promise<OpportunityPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_opportunities", toListArgs(query, offset));
  if (error) throw error;
  return toOpportunityPage((data ?? []) as unknown as OpportunityRow[], offset);
}

/** 看不到（草稿、別人的、已截止且沒報名過）回傳 null。 */
export async function loadOpportunity(id: string): Promise<OpportunityDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_opportunity", { p_id: id });
  if (error) throw error;
  const row = ((data ?? []) as unknown as OpportunityDetailRow[])[0];
  return row ? toOpportunityDetail(row) : null;
}

/**
 * 我的報名的其中一頁（最新的在前，每頁 PAGE_SIZE 筆）＋ 總筆數。
 * 頁數超過最後一頁時 items 是空的，由頁面改導到最後一頁。
 */
export async function loadMyApplicationsPage(creatorId: string, page: number): Promise<{ items: MyApplication[]; total: number }> {
  const supabase = await createClient();
  const { from, to } = pageRange(page);
  const { data, error, count } = await supabase
    .from("brief_applications").select(MY_APPLICATION_COLUMNS, { count: "exact" }).eq("creator_id", creatorId)
    // id 當第二排序鍵：同一秒的報名換頁時順序不變
    .order("created_at", { ascending: false }).order("id").range(from, to);
  // 頁數超過最後一頁時 PostgREST 回 416（PGRST103），不是空陣列：另外只數筆數，讓頁面導到最後一頁
  if (error?.code === "PGRST103") {
    const head = await supabase.from("brief_applications").select("id", { count: "exact", head: true }).eq("creator_id", creatorId);
    if (head.error) throw head.error;
    return { items: [], total: head.count ?? 0 };
  }
  if (error) throw error;
  return { items: toMyApplications((data ?? []) as unknown as MyApplicationRow[]), total: count ?? 0 };
}
