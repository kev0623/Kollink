"use server";

import { requireRole } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { searchSquare } from "@/lib/creators/square";
import { parseSquareQuery } from "@/lib/creators/square-query";
import type { SquareCreator } from "@/lib/creators/square-view";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_OFFSET = 10_000;
const MAX_QUERY_LENGTH = 4000;
const BAD_INPUT = "資料格式不正確，請重新整理頁面";

export type FavoriteResult = { ok: true } | { ok: false; error: string };
export type LoadMoreResult = { ok: true; items: SquareCreator[]; hasMore: boolean } | { ok: false; error: string };

/**
 * 收藏或取消收藏。用品牌自己的 client，RLS 只允許改自己的收藏。
 * 不 revalidate：按 ♡ 不重跑整頁搜尋，畫面由 FavoriteButton 的樂觀更新處理（見計畫 4「設計決定」3）。
 */
export async function setFavoriteAction(creatorId: unknown, favorite: unknown): Promise<FavoriteResult> {
  const me = await requireRole("brand");
  if (typeof creatorId !== "string" || !UUID_RE.test(creatorId) || typeof favorite !== "boolean") {
    return { ok: false, error: BAD_INPUT };
  }
  const supabase = await createClient();
  if (favorite) {
    const { error } = await supabase.from("creator_favorites").insert({ brand_id: me.id, creator_id: creatorId });
    // 已經收藏過（連點、另一個分頁）視為成功
    if (error && error.code !== "23505") return { ok: false, error: "收藏失敗，請稍後再試" };
  } else {
    const { error } = await supabase
      .from("creator_favorites").delete().eq("brand_id", me.id).eq("creator_id", creatorId);
    if (error) return { ok: false, error: "取消收藏失敗，請稍後再試" };
  }
  return { ok: true };
}

/** 「載入更多」：query 是目前網址的查詢字串，在伺服器重新解析，不信任 client 傳來的物件。 */
export async function loadMoreCreatorsAction(query: unknown, offset: unknown): Promise<LoadMoreResult> {
  await requireRole("brand");
  if (
    typeof query !== "string" || query.length > MAX_QUERY_LENGTH
    || typeof offset !== "number" || !Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET
  ) {
    return { ok: false, error: BAD_INPUT };
  }
  try {
    const page = await searchSquare(parseSquareQuery(new URLSearchParams(query)), offset);
    return { ok: true, items: page.items, hasMore: page.hasMore };
  } catch {
    return { ok: false, error: "載入失敗，請稍後再試" };
  }
}
