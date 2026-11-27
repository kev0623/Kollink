import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  NO_REVIEW_STATS, REVIEW_PAGE_SIZE, statsByUser, toAdminReviews, toCollabReviews, toPublicReviews, toReviewStats,
  type AdminReview, type AdminReviewRow, type CollabReviews, type CollabReviewsRow, type PublicReview, type PublicReviewRow,
  type ReviewStats, type ReviewStatsRow,
} from "./view";

// 評價的伺服器端讀取。全部用使用者自己的 client（definer 函式自己檢查身分）。會讀 cookie，不快取。

/** 合作案詳情的評價區；合作案還沒完成（或不是參與者）回傳 null。 */
export async function loadCollabReviews(collabId: string): Promise<CollabReviews | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_collaboration_reviews", { p_collab_id: collabId });
  if (error) throw error;
  const row = ((data ?? []) as unknown as CollabReviewsRow[])[0];
  return row ? toCollabReviews(row) : null;
}

/** 一個人的評分統計；查不到（未審核、訪客查品牌）回傳全空的統計。 */
export async function loadReviewStats(userId: string): Promise<ReviewStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("review_stats", { p_user_ids: [userId] });
  if (error) throw error;
  return toReviewStats(((data ?? []) as unknown as ReviewStatsRow[])[0]);
}

/** 一次查多個人（最多 100 個）；查不到的人不在 Map 裡。 */
export async function loadReviewStatsMany(userIds: string[]): Promise<Map<string, ReviewStats>> {
  const ids = [...new Set(userIds)].slice(0, 100);
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("review_stats", { p_user_ids: ids });
  if (error) throw error;
  return statsByUser((data ?? []) as unknown as ReviewStatsRow[]);
}

/** 創作者公開頁的評價（新的在前）。多拿一則用來判斷還有沒有更多。 */
export async function loadCreatorReviews(creatorId: string, limit = REVIEW_PAGE_SIZE): Promise<{ items: PublicReview[]; hasMore: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_creator_reviews", { p_creator_id: creatorId, p_limit: limit + 1, p_offset: 0 });
  if (error) throw error;
  const items = toPublicReviews((data ?? []) as unknown as PublicReviewRow[]);
  return { items: items.slice(0, limit), hasMore: items.length > limit };
}

/** 管理員：一個合作案的評價（含未公開與已隱藏）。只能在 requireAdmin 之後呼叫。 */
export async function loadAdminCollabReviews(collabId: string): Promise<AdminReview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_collab_reviews", { p_collab_id: collabId });
  if (error) throw error;
  return toAdminReviews((data ?? []) as unknown as AdminReviewRow[]);
}

export { NO_REVIEW_STATS };
