import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, pageRange } from "@/lib/paging";
import { brandBriefTabFilter } from "./query";
import {
  BRIEF_COLUMNS, toApplicant, toApplicantCounts, toBrief, withCounts,
  type Applicant, type ApplicantCounts, type ApplicantCountsRow, type ApplicantFilter, type ApplicantRow,
  type BrandBriefListItem, type BrandBriefTab, type Brief, type BriefRow, type CountRow,
} from "./view";

// 品牌端讀取。全部用品牌自己的 client（RLS／definer 函式自己檢查身分）。會讀 cookie：只能在 requireRole 之後呼叫。不快取。

export type BrandBriefCounts = Record<BrandBriefTab, number>;
export type BrandBriefPage = { items: BrandBriefListItem[]; counts: BrandBriefCounts };

/**
 * 自己的招募：某個分頁（發佈中／草稿／已結束）的其中一頁（最新的在前，每頁 PAGE_SIZE 則）＋ 報名人數與待處理人數，
 * 以及三個分頁各自的總數（標籤上的數字與總頁數）。頁數超過最後一頁時 items 是空的，由頁面改導到最後一頁。
 */
export async function loadMyBriefsPage(brandId: string, tab: BrandBriefTab, page: number, today: string): Promise<BrandBriefPage> {
  const supabase = await createClient();
  const filtered = (t: BrandBriefTab, columns: string, head: boolean) => {
    const f = brandBriefTabFilter(t, today);
    let q = supabase.from("briefs").select(columns, head ? { count: "exact", head: true } : undefined).eq("brand_id", brandId);
    if (f.status) q = q.eq("status", f.status);
    if (f.or) q = q.or(f.or);
    return q;
  };
  const { from, to } = pageRange(page);
  const [rows, open, draft, ended] = await Promise.all([
    // id 當第二排序鍵：同一秒建立的招募換頁時順序不變
    filtered(tab, BRIEF_COLUMNS, false).order("created_at", { ascending: false }).order("id").range(from, to),
    filtered("open", "id", true),
    filtered("draft", "id", true),
    filtered("ended", "id", true),
  ]);
  for (const r of [rows, open, draft, ended]) if (r.error) throw r.error;
  const counts: BrandBriefCounts = { open: open.count ?? 0, draft: draft.count ?? 0, ended: ended.count ?? 0 };
  const briefs = ((rows.data ?? []) as unknown as BriefRow[]).map(toBrief);
  if (briefs.length === 0) return { items: [], counts };
  const { data, error } = await supabase.rpc("brief_application_counts", { p_ids: briefs.map((b) => b.id) });
  if (error) throw error;
  return { items: withCounts(briefs, (data ?? []) as unknown as CountRow[]), counts };
}

/** 自己的一則招募；不是自己的或不存在回傳 null。 */
export async function loadOwnBrief(brandId: string, id: string): Promise<Brief | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("briefs").select(BRIEF_COLUMNS).eq("id", id).eq("brand_id", brandId).maybeSingle();
  if (error) throw error;
  return data ? toBrief(data as unknown as BriefRow) : null;
}

export type ApplicantPage = { items: Applicant[]; counts: ApplicantCounts };

/**
 * 報名者的其中一頁（最新的在前，每頁 PAGE_SIZE 人）＋ 各篩選的人數。只有招募主能呼叫（否則 42501 not brief owner）。
 * 頁數超過最後一頁時 items 是空的，由頁面改導到最後一頁。
 */
export async function loadApplicantsPage(briefId: string, filter: ApplicantFilter, page: number): Promise<ApplicantPage> {
  const supabase = await createClient();
  const [list, counts] = await Promise.all([
    supabase.rpc("list_brief_applicants_page", {
      p_brief_id: briefId, p_status: filter === "all" ? undefined : filter, p_limit: PAGE_SIZE, p_offset: pageRange(page).from,
    }),
    supabase.rpc("brief_applicant_status_counts", { p_brief_id: briefId }),
  ]);
  if (list.error) throw list.error;
  if (counts.error) throw counts.error;
  return {
    items: ((list.data ?? []) as unknown as ApplicantRow[]).map(toApplicant),
    counts: toApplicantCounts(((counts.data ?? []) as unknown as ApplicantCountsRow[])[0]),
  };
}
