// 招募、機會、報名的顯示用型別與轉換。
// supabase gen types 把 RPC 的 RETURNS TABLE 欄位都標成非 null，實際上可能是 null：Row 型別一律自己定義、欄位可為 null。
import { deadlineLabel, formatDate } from "@/lib/briefs/dates";
import { formatNumber, formatTwd } from "@/lib/format";
import { toNumberOrNull } from "@/lib/creators/view";
import type { BriefInput } from "@/lib/validation/brief";

export type BriefStatus = "draft" | "open" | "closed";
/** 畫面上的狀態：open 但已過截止日顯示「已截止」（不寫進資料庫）。 */
export type BriefDisplayStatus = "draft" | "open" | "expired" | "closed";
export type ApplicationStatus = "applied" | "accepted" | "rejected" | "withdrawn";

const BRIEF_STATUSES: readonly string[] = ["draft", "open", "closed"];
const APPLICATION_STATUSES: readonly string[] = ["applied", "accepted", "rejected", "withdrawn"];

/** 不認得的值當成 closed（最保守：不能編輯、不能報名）。 */
export function toBriefStatus(v: unknown): BriefStatus {
  return typeof v === "string" && BRIEF_STATUSES.includes(v) ? (v as BriefStatus) : "closed";
}

/** 不認得的值當成 withdrawn（最保守：沒有任何操作）。 */
export function toApplicationStatus(v: unknown): ApplicationStatus {
  return typeof v === "string" && APPLICATION_STATUSES.includes(v) ? (v as ApplicationStatus) : "withdrawn";
}

/** 截止日文字：倒數標籤（剩 N 天、今天截止、已截止）只在發佈中顯示，草稿與已關閉只顯示日期。 */
export function deadlineText(status: BriefStatus, deadline: string, today: string): string {
  return status === "open" ? `${formatDate(deadline)}（${deadlineLabel(deadline, today)}）` : formatDate(deadline);
}

export function displayStatusOf(status: BriefStatus, deadline: string | null, today: string): BriefDisplayStatus {
  if (status === "open" && deadline !== null && deadline < today) return "expired";
  return status;
}

export const BRIEF_STATUS_LABEL: Record<BriefDisplayStatus, string> = {
  draft: "草稿", open: "發佈中", expired: "已截止", closed: "已關閉",
};
export const CREATOR_APPLICATION_LABEL: Record<ApplicationStatus, string> = {
  applied: "待回覆", accepted: "已錄取", rejected: "未錄取", withdrawn: "已撤回",
};
export const BRAND_APPLICATION_LABEL: Record<ApplicationStatus, string> = {
  applied: "待處理", accepted: "已錄取", rejected: "已婉拒", withdrawn: "已撤回",
};

export type Reward = { budgetMin: number | null; budgetMax: number | null; includesProduct: boolean };

/** 「NT$5,000–20,000」「NT$5,000 起」「最高 NT$20,000」「產品互惠 + NT$3,000 起」「產品互惠」；都沒有是「—」。 */
export function rewardLabel(r: Reward): string {
  const min = r.budgetMin !== null && r.budgetMin > 0 ? r.budgetMin : null;
  const max = r.budgetMax !== null && r.budgetMax > 0 ? r.budgetMax : null;
  let cash: string | null = null;
  if (min !== null && max !== null) cash = min === max ? formatTwd(min) : `${formatTwd(min)}–${formatNumber(max)}`;
  else if (min !== null) cash = `${formatTwd(min)} 起`;
  else if (max !== null) cash = `最高 ${formatTwd(max)}`;
  if (r.includesProduct) return cash ? `產品互惠 + ${cash}` : "產品互惠";
  return cash ?? "—";
}

export function audienceLabel(minFollowers: number): string {
  return minFollowers > 0 ? `粉絲 ${formatNumber(minFollowers)} 以上` : "粉絲數不限";
}

export type MatchFlags = { followers: boolean; region: boolean; category: boolean; collab: boolean };

/** 詳情頁的條件清單：每一項是否符合。 */
export function matchItems(o: {
  minFollowers: number; region: string | null; categories: string[]; collabTypes: string[]; match: MatchFlags;
}): { label: string; ok: boolean }[] {
  return [
    { label: audienceLabel(o.minFollowers), ok: o.match.followers },
    { label: o.region ? `地區：${o.region}` : "地區不限", ok: o.match.region },
    { label: o.categories.length ? `內容領域：${o.categories.join("、")}` : "內容領域不限", ok: o.match.category },
    { label: `合作形式：${o.collabTypes.join("、") || "—"}`, ok: o.match.collab },
  ];
}

// ── 品牌端：自己的招募 ──

export type Brief = Reward & {
  id: string;
  brandId: string;
  title: string;
  description: string;
  collabTypes: string[];
  categories: string[];
  minFollowers: number;
  region: string | null;
  deadline: string | null;
  coverPath: string | null;
  status: BriefStatus;
  publishedAt: string | null;
  createdAt: string;
};

export type BriefRow = {
  id: string;
  brand_id: string;
  title: string | null;
  description: string | null;
  collab_types: string[] | null;
  categories: string[] | null;
  min_followers: number | null;
  region: string | null;
  budget_min_twd: number | null;
  budget_max_twd: number | null;
  includes_product: boolean | null;
  deadline: string | null;
  cover_path: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
};

export const BRIEF_COLUMNS =
  "id, brand_id, title, description, collab_types, categories, min_followers, region, budget_min_twd, "
  + "budget_max_twd, includes_product, deadline, cover_path, status, published_at, created_at";

export function toBrief(r: BriefRow): Brief {
  return {
    id: r.id,
    brandId: r.brand_id,
    title: r.title ?? "",
    description: r.description ?? "",
    collabTypes: r.collab_types ?? [],
    categories: r.categories ?? [],
    minFollowers: r.min_followers ?? 0,
    region: r.region ?? null,
    budgetMin: r.budget_min_twd ?? null,
    budgetMax: r.budget_max_twd ?? null,
    includesProduct: r.includes_product === true,
    deadline: r.deadline ?? null,
    coverPath: r.cover_path ?? null,
    status: toBriefStatus(r.status),
    publishedAt: r.published_at ?? null,
    createdAt: r.created_at,
  };
}

export const UNTITLED_DRAFT = "（未命名草稿）";

export type CountRow = { brief_id: string | null; applicant_count: number | string | null; pending_count: number | string | null };
export type BrandBriefListItem = Brief & { applicantCount: number; pendingCount: number };

export function withCounts(briefs: Brief[], counts: CountRow[]): BrandBriefListItem[] {
  const byId = new Map(counts.filter((c) => c.brief_id).map((c) => [c.brief_id as string, c]));
  return briefs.map((b) => {
    const c = byId.get(b.id);
    return { ...b, applicantCount: toNumberOrNull(c?.applicant_count ?? null) ?? 0, pendingCount: toNumberOrNull(c?.pending_count ?? null) ?? 0 };
  });
}

export type BrandBriefTab = "open" | "draft" | "ended";

export function brandTabOf(s: BriefDisplayStatus): BrandBriefTab {
  if (s === "draft") return "draft";
  if (s === "open") return "open";
  return "ended";
}

/** 編輯表單的初始值。 */
export function briefToInput(b: Brief): BriefInput {
  return {
    title: b.title,
    description: b.description,
    collabTypes: b.collabTypes,
    coverPath: b.coverPath,
    categories: b.categories,
    minFollowers: b.minFollowers > 0 ? String(b.minFollowers) : "",
    region: b.region ?? "",
    budgetMin: b.budgetMin !== null ? String(b.budgetMin) : "",
    budgetMax: b.budgetMax !== null ? String(b.budgetMax) : "",
    includesProduct: b.includesProduct,
    deadline: b.deadline ?? "",
  };
}

// ── 詳情頁（創作者看到的樣式；品牌的預覽也用這個） ──

export type BriefDetailData = Reward & {
  title: string;
  description: string;
  collabTypes: string[];
  categories: string[];
  minFollowers: number;
  region: string | null;
  deadline: string | null;
  coverPath: string | null;
  brandName: string;
  brandLogoPath: string | null;
  /** 決定截止日是否附倒數標籤；預覽時以發佈後的樣子（open）顯示 */
  status: BriefStatus;
  /** 預覽時是 null（還沒有人報名，不顯示） */
  applicantCount: number | null;
};

function toIntOrNull(v: string): number | null {
  if (!/^\d{1,9}$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n : null;
}

/** 表單預覽：還沒存的內容照填寫的樣子顯示，數字填錯的當成沒填。 */
export function previewFromInput(i: BriefInput, brand: { name: string; logoPath: string | null }): BriefDetailData {
  return {
    title: i.title || "（未填案名）",
    description: i.description,
    collabTypes: i.collabTypes,
    categories: i.categories,
    minFollowers: toIntOrNull(i.minFollowers) ?? 0,
    region: i.region || null,
    budgetMin: toIntOrNull(i.budgetMin),
    budgetMax: toIntOrNull(i.budgetMax),
    includesProduct: i.includesProduct,
    deadline: i.deadline || null,
    coverPath: i.coverPath,
    brandName: brand.name,
    brandLogoPath: brand.logoPath,
    status: "open",
    applicantCount: null,
  };
}

// ── 創作者端：機會 ──

export type Opportunity = Reward & {
  id: string;
  title: string;
  collabTypes: string[];
  categories: string[];
  minFollowers: number;
  region: string | null;
  deadline: string;
  coverPath: string | null;
  brandName: string;
  brandLogoPath: string | null;
  applicantCount: number;
  match: MatchFlags;
  isMatch: boolean;
  myStatus: ApplicationStatus | null;
};

export type OpportunityRow = {
  id: string;
  title: string | null;
  collab_types: string[] | null;
  categories: string[] | null;
  min_followers: number | null;
  region: string | null;
  budget_min_twd: number | null;
  budget_max_twd: number | null;
  includes_product: boolean | null;
  deadline: string | null;
  cover_path: string | null;
  brand_name: string | null;
  brand_logo_path: string | null;
  applicant_count: number | string | null;
  followers_ok: boolean | null;
  region_ok: boolean | null;
  category_ok: boolean | null;
  collab_ok: boolean | null;
  is_match: boolean | null;
  my_status: string | null;
  total_count?: number | string | null;
};

export function toOpportunity(r: OpportunityRow): Opportunity {
  return {
    id: r.id,
    title: r.title ?? "",
    collabTypes: r.collab_types ?? [],
    categories: r.categories ?? [],
    minFollowers: r.min_followers ?? 0,
    region: r.region ?? null,
    budgetMin: r.budget_min_twd ?? null,
    budgetMax: r.budget_max_twd ?? null,
    includesProduct: r.includes_product === true,
    deadline: r.deadline ?? "",
    coverPath: r.cover_path ?? null,
    brandName: r.brand_name ?? "",
    brandLogoPath: r.brand_logo_path ?? null,
    applicantCount: toNumberOrNull(r.applicant_count) ?? 0,
    match: {
      followers: r.followers_ok === true,
      region: r.region_ok === true,
      category: r.category_ok === true,
      collab: r.collab_ok === true,
    },
    isMatch: r.is_match === true,
    myStatus: r.my_status === null || r.my_status === undefined ? null : toApplicationStatus(r.my_status),
  };
}

export const OPPORTUNITY_PAGE_SIZE = 20;
export type OpportunityPage = { items: Opportunity[]; total: number; hasMore: boolean };

export function toOpportunityPage(rows: OpportunityRow[], offset: number): OpportunityPage {
  const total = toNumberOrNull(rows[0]?.total_count ?? null) ?? 0;
  return { items: rows.map(toOpportunity), total, hasMore: offset + rows.length < total };
}

/** 載入更多：已顯示的在前，新的接在後面，以 id 去重。 */
export function appendUniqueById<T extends { id: string }>(current: T[], more: T[]): T[] {
  const seen = new Set(current.map((x) => x.id));
  return [...current, ...more.filter((x) => !seen.has(x.id) && seen.add(x.id))];
}

export type OpportunityDetail = Opportunity & {
  description: string;
  status: BriefStatus;
  application: { id: string; status: ApplicationStatus; message: string | null; proposedPrice: number | null } | null;
};

export type OpportunityDetailRow = OpportunityRow & {
  description: string | null;
  status: string;
  my_application_id: string | null;
  my_message: string | null;
  my_proposed_price_twd: number | null;
};

export function toOpportunityDetail(r: OpportunityDetailRow): OpportunityDetail {
  return {
    ...toOpportunity(r),
    description: r.description ?? "",
    status: toBriefStatus(r.status),
    application: r.my_application_id
      ? {
        id: r.my_application_id,
        status: toApplicationStatus(r.my_status),
        message: r.my_message ?? null,
        proposedPrice: r.my_proposed_price_twd ?? null,
      }
      : null,
  };
}

export function detailDataOf(o: OpportunityDetail): BriefDetailData {
  return {
    title: o.title, description: o.description, collabTypes: o.collabTypes, categories: o.categories,
    minFollowers: o.minFollowers, region: o.region, budgetMin: o.budgetMin, budgetMax: o.budgetMax,
    includesProduct: o.includesProduct, deadline: o.deadline, coverPath: o.coverPath, brandName: o.brandName,
    brandLogoPath: o.brandLogoPath, status: o.status, applicantCount: o.applicantCount,
  };
}

// ── 我的報名 ──

export type MyApplication = {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  brief: Reward & { id: string; title: string; deadline: string | null; status: BriefStatus; brandName: string };
};

export type MyApplicationRow = {
  id: string;
  status: string;
  created_at: string;
  briefs: {
    id: string;
    title: string | null;
    deadline: string | null;
    status: string;
    budget_min_twd: number | null;
    budget_max_twd: number | null;
    includes_product: boolean | null;
    brand_profiles: { brand_name: string | null } | null;
  } | null;
};

export const MY_APPLICATION_COLUMNS =
  "id, status, created_at, briefs(id, title, deadline, status, budget_min_twd, budget_max_twd, includes_product, brand_profiles(brand_name))";

/** 招募讀不到（理論上不會）的報名略過。 */
export function toMyApplications(rows: MyApplicationRow[]): MyApplication[] {
  return rows.flatMap((r) => r.briefs
    ? [{
      id: r.id,
      status: toApplicationStatus(r.status),
      createdAt: r.created_at,
      brief: {
        id: r.briefs.id,
        title: r.briefs.title ?? "",
        deadline: r.briefs.deadline ?? null,
        status: toBriefStatus(r.briefs.status),
        brandName: r.briefs.brand_profiles?.brand_name ?? "",
        budgetMin: r.briefs.budget_min_twd ?? null,
        budgetMax: r.briefs.budget_max_twd ?? null,
        includesProduct: r.briefs.includes_product === true,
      },
    }]
    : []);
}

// ── 品牌端：報名者 ──

export type Applicant = {
  id: string;
  creatorId: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  followerCount: number;
  engagementRate: number | null;
  region: string | null;
  message: string | null;
  proposedPrice: number | null;
  status: ApplicationStatus;
  createdAt: string;
  /** 已錄取時的合作案 id（計畫 6） */
  collaborationId: string | null;
};

export type ApplicantRow = {
  id: string;
  creator_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_path: string | null;
  follower_count: number | null;
  engagement_rate: number | string | null;
  region: string | null;
  message: string | null;
  proposed_price_twd: number | null;
  status: string;
  created_at: string;
  collaboration_id?: string | null;
};

export function toApplicant(r: ApplicantRow): Applicant {
  return {
    id: r.id,
    creatorId: r.creator_id,
    handle: r.handle ?? "",
    displayName: r.display_name ?? "",
    avatarPath: r.avatar_path ?? null,
    followerCount: r.follower_count ?? 0,
    engagementRate: toNumberOrNull(r.engagement_rate),
    region: r.region ?? null,
    message: r.message ?? null,
    proposedPrice: r.proposed_price_twd ?? null,
    status: toApplicationStatus(r.status),
    createdAt: r.created_at,
    collaborationId: r.collaboration_id ?? null,
  };
}

export type ApplicantFilter = "all" | "applied" | "accepted" | "rejected";
export const APPLICANT_FILTERS: { value: ApplicantFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "applied", label: "待處理" },
  { value: "accepted", label: "已錄取" },
  { value: "rejected", label: "已婉拒" },
];

export function filterApplicants(list: Applicant[], f: ApplicantFilter): Applicant[] {
  return f === "all" ? list : list.filter((a) => a.status === f);
}

export function proposedPriceLabel(p: number | null): string {
  return p === null ? "依招募預算" : formatTwd(p);
}
