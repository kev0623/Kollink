import "server-only";
import { createClient } from "@/lib/supabase/server";
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

/** 我的報名（最新的在前，最多 100 筆）。 */
export async function loadMyApplications(creatorId: string): Promise<MyApplication[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brief_applications").select(MY_APPLICATION_COLUMNS).eq("creator_id", creatorId)
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return toMyApplications((data ?? []) as unknown as MyApplicationRow[]);
}
