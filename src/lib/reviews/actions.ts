"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/briefs/query";
import { cleanLongText } from "@/lib/validation/collab";
import { isRating, isReviewStale, reviewErrorMessage, validateReviewComment } from "./view";

export type ReviewResult = { ok: true } | { ok: false; error: string; stale?: boolean };

/**
 * 送出評價（品牌與創作者共用）。身分、合作案狀態、期限、是否寫過都由資料庫的
 * submit_collaboration_review 檢查；這裡只先擋格式。
 */
export async function submitReviewAction(collabId: unknown, rating: unknown, comment: unknown): Promise<ReviewResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "登入已逾時，請重新登入" };
  if (!isUuid(collabId) || typeof comment !== "string") return { ok: false, error: "資料格式不正確，請重新整理頁面" };
  if (!isRating(rating)) return { ok: false, error: "請選擇星數" };
  const clean = cleanLongText(comment);
  const invalid = validateReviewComment(clean);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_collaboration_review", {
    p_collab_id: collabId, p_rating: rating, ...(clean === "" ? {} : { p_comment: clean }),
  });
  if (error && !isReviewStale(error)) return { ok: false, error: reviewErrorMessage(error) };
  revalidatePath(`/brand/collabs/${collabId}`);
  revalidatePath(`/creator/collabs/${collabId}`);
  if (error) return { ok: false, error: reviewErrorMessage(error), stale: true };
  return { ok: true };
}
