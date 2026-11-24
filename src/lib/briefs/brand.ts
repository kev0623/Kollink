import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  BRIEF_COLUMNS, toApplicant, toBrief, withCounts,
  type Applicant, type ApplicantRow, type BrandBriefListItem, type Brief, type BriefRow, type CountRow,
} from "./view";

// 品牌端讀取。全部用品牌自己的 client（RLS／definer 函式自己檢查身分）。會讀 cookie：只能在 requireRole 之後呼叫。不快取。

/** 自己的招募（最新的在前，最多 200 則）＋ 報名人數與待處理人數。 */
export async function loadMyBriefs(brandId: string): Promise<BrandBriefListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("briefs").select(BRIEF_COLUMNS).eq("brand_id", brandId)
    .order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  const briefs = ((data ?? []) as unknown as BriefRow[]).map(toBrief);
  if (briefs.length === 0) return [];
  const { data: counts, error: e2 } = await supabase.rpc("brief_application_counts", { p_ids: briefs.map((b) => b.id) });
  if (e2) throw e2;
  return withCounts(briefs, (counts ?? []) as unknown as CountRow[]);
}

/** 自己的一則招募；不是自己的或不存在回傳 null。 */
export async function loadOwnBrief(brandId: string, id: string): Promise<Brief | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("briefs").select(BRIEF_COLUMNS).eq("id", id).eq("brand_id", brandId).maybeSingle();
  if (error) throw error;
  return data ? toBrief(data as unknown as BriefRow) : null;
}

/** 報名者（最新的在前）。只有招募主能呼叫（否則 42501 not brief owner）。 */
export async function loadApplicants(briefId: string): Promise<Applicant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_brief_applicants", { p_brief_id: briefId });
  if (error) throw error;
  return ((data ?? []) as unknown as ApplicantRow[]).map(toApplicant);
}
