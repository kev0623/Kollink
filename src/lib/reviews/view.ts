// 評價的型別、規則與畫面文字（server 與 client 都能 import）。
// 規則與資料庫一致，資料庫是最後防線：20261202000100_reviews.sql。
import { formatDateTw } from "@/lib/briefs/dates";
import { contactKinds } from "@/lib/messages/contact";
import { hasBadChar, textLength } from "@/lib/validation/brief";

/** 完成後幾天內可以評價（SQL 的 review_window() 相同） */
export const REVIEW_WINDOW_DAYS = 14;
/** 評價文字上限（SQL 的 char_length(v_comment) > 500 相同） */
export const REVIEW_COMMENT_MAX = 500;
/** 公開頁一次顯示幾則（SQL list_creator_reviews 的預設 p_limit 相同） */
export const REVIEW_PAGE_SIZE = 10;

export const RATING_LABEL: Record<number, string> = {
  1: "很不滿意", 2: "不滿意", 3: "普通", 4: "滿意", 5: "非常滿意",
};

export function isRating(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}

/** 評價文字（已清理過）的錯誤訊息；沒問題回傳 null。空字串可以（文字選填）。 */
export function validateReviewComment(comment: string): string | null {
  if (textLength(comment) > REVIEW_COMMENT_MAX) return `最多 ${REVIEW_COMMENT_MAX} 字`;
  if (hasBadChar(comment)) return "含有不允許的特殊字元";
  if (contactKinds(comment).length > 0) return "評價會公開，請不要留電話、Email、LINE ID 或連結";
  return null;
}

// ── 合作案詳情的評價區 ──

export type CollabReviewsRow = {
  closes_at: string | null;
  can_review: boolean | null;
  my_rating: number | null;
  my_comment: string | null;
  my_created_at: string | null;
  my_hidden: boolean | null;
  their_submitted: boolean | null;
  their_published: boolean | null;
  their_rating: number | null;
  their_comment: string | null;
  their_created_at: string | null;
};

export type ReviewBody = { rating: number; comment: string | null; createdAt: string };

export type CollabReviews = {
  closesAt: string;
  canReview: boolean;
  mine: (ReviewBody & { hidden: boolean }) | null;
  theirSubmitted: boolean;
  /** 對方的評價；公開之後才有 */
  theirs: ReviewBody | null;
};

export function toCollabReviews(r: CollabReviewsRow): CollabReviews {
  const mine = isRating(r.my_rating)
    ? { rating: r.my_rating, comment: r.my_comment, createdAt: r.my_created_at ?? "", hidden: r.my_hidden === true }
    : null;
  const theirs = r.their_published === true && isRating(r.their_rating)
    ? { rating: r.their_rating, comment: r.their_comment, createdAt: r.their_created_at ?? "" }
    : null;
  return {
    closesAt: r.closes_at ?? "",
    canReview: r.can_review === true,
    mine,
    theirSubmitted: r.their_submitted === true,
    theirs,
  };
}

/** 對方那一欄在還看不到內容時的說明；看得到內容（theirs 有值）時回傳 null。 */
export function theirReviewHint(r: CollabReviews, counterpart: string, nowMs: number): string | null {
  if (r.theirs) return null;
  const closed = Number.isNaN(Date.parse(r.closesAt)) || nowMs > Date.parse(r.closesAt);
  if (r.theirSubmitted) {
    // 對方寫了但看不到：自己還沒寫（雙盲），或被平台隱藏
    if (!r.mine && !closed) return `${counterpart}已經寫好評價，你送出後就能看到`;
    return `${counterpart}的評價目前沒有公開`;
  }
  if (closed) return `${counterpart}沒有留下評價`;
  return r.mine
    ? `${counterpart}還沒寫。對方送出後，或 ${formatDateTw(r.closesAt)} 之後，你的評價才會公開`
    : `${counterpart}還沒寫`;
}

// ── 統計 ──

export type ReviewStatsRow = {
  user_id: string | null;
  avg_rating: number | string | null;
  review_count: number | null;
  completed_count: number | null;
};

export type ReviewStats = { avg: number | null; count: number; completed: number };

export const NO_REVIEW_STATS: ReviewStats = { avg: null, count: 0, completed: 0 };

export function toReviewStats(r: ReviewStatsRow | null | undefined): ReviewStats {
  if (!r) return NO_REVIEW_STATS;
  const avg = r.avg_rating === null ? null : Number(r.avg_rating);
  const count = r.review_count ?? 0;
  return {
    avg: count > 0 && avg !== null && Number.isFinite(avg) ? avg : null,
    count,
    completed: r.completed_count ?? 0,
  };
}

export function statsByUser(rows: ReviewStatsRow[]): Map<string, ReviewStats> {
  const out = new Map<string, ReviewStats>();
  for (const r of rows) if (r.user_id) out.set(r.user_id, toReviewStats(r));
  return out;
}

/** 4 → "4.0" */
export function formatRating(avg: number): string {
  return avg.toFixed(1);
}

/** 一行摘要：「4.8（12 則評價）・完成 15 案」；沒有評價時用 emptyText。 */
export function statsSummary(s: ReviewStats, emptyText: string): string {
  const head = s.avg === null ? emptyText : `${formatRating(s.avg)}（${s.count} 則評價）`;
  return s.completed > 0 ? `${head}・完成 ${s.completed} 案` : head;
}

// ── 公開頁的評價列表 ──

export type PublicReviewRow = {
  id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
  brand_name: string | null;
  brand_logo_path: string | null;
};

export type PublicReview = {
  id: string; rating: number; comment: string | null; createdAt: string; brandName: string; brandLogoPath: string | null;
};

export function toPublicReviews(rows: PublicReviewRow[]): PublicReview[] {
  const out: PublicReview[] = [];
  for (const r of rows) {
    if (!r.id || !isRating(r.rating)) continue;
    out.push({
      id: r.id, rating: r.rating, comment: r.comment, createdAt: r.created_at ?? "",
      brandName: r.brand_name ?? "品牌", brandLogoPath: r.brand_logo_path,
    });
  }
  return out;
}

// ── 管理員 ──

export type AdminReviewRow = {
  id: string | null;
  author_side: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
  visible_from: string | null;
  hidden_at: string | null;
};

export type AdminReview = {
  id: string; side: "brand" | "creator"; rating: number; comment: string | null;
  createdAt: string; visibleFrom: string; hiddenAt: string | null;
};

export function toAdminReviews(rows: AdminReviewRow[]): AdminReview[] {
  const out: AdminReview[] = [];
  for (const r of rows) {
    if (!r.id || !isRating(r.rating) || (r.author_side !== "brand" && r.author_side !== "creator")) continue;
    out.push({
      id: r.id, side: r.author_side, rating: r.rating, comment: r.comment,
      createdAt: r.created_at ?? "", visibleFrom: r.visible_from ?? "", hiddenAt: r.hidden_at,
    });
  }
  return out;
}

export function adminReviewState(r: AdminReview, nowMs: number): string {
  if (r.hiddenAt) return "已隱藏";
  return Date.parse(r.visibleFrom) <= nowMs ? "已公開" : "尚未公開";
}

// ── 錯誤 ──

type DbError = { code?: string; message?: string };

const MESSAGES: Record<string, string> = {
  "not authenticated": "登入已逾時，請重新登入",
  "collaboration not found": "找不到這個合作案",
  "collaboration not completed": "合作完成後才能評價",
  "review window closed": `評價期限已過（完成後 ${REVIEW_WINDOW_DAYS} 天內）`,
  "already reviewed": "你已經評價過了",
  "invalid rating": "請選擇星數",
  "invalid comment": `評價文字最多 ${REVIEW_COMMENT_MAX} 字，且不能有特殊字元`,
  "comment has contact info": "評價會公開，請不要留電話、Email、LINE ID 或連結",
  "text too long": "內容太長，請縮短後再送出",
};

/** 已經寫過／期限已過：畫面重新整理就會顯示正確的狀態。 */
export function isReviewStale(error: DbError): boolean {
  return error.message === "already reviewed";
}

export function reviewErrorMessage(error: DbError): string {
  const m = error.message ?? "";
  return Object.hasOwn(MESSAGES, m) ? MESSAGES[m] : "發生錯誤，請稍後再試";
}
