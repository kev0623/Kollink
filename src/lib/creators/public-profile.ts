import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { HANDLE_RE } from "@/lib/validation/onboarding";
import {
  sortRatesByTypes, toPublicCreator, type PortfolioItem, type PublicCreator, type PublicCreatorRow, type Rate,
} from "./view";

/**
 * 以目前使用者身分讀公開頁：已審核的給所有人，未審核的只有本人讀得到。
 * 會讀 cookie，只能在 <Suspense> 內或 generateMetadata 呼叫。不快取（理由見計畫 3「快取決定」）。
 */
export const loadPublicCreator = cache(async (handle: string): Promise<PublicCreator | null> => {
  if (!HANDLE_RE.test(handle)) return null;
  // 結果依每次請求而異：先等請求進來再建立 client（auth-js 會讀 Date.now()）
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_creator", { p_handle: handle }).maybeSingle();
  if (error) throw error;
  return data ? toPublicCreator(data as PublicCreatorRow) : null;
});

/** 以訪客身分讀公開頁（只會拿到已審核的創作者）。OG 圖片用，不讀 cookie。 */
export async function loadApprovedCreatorAsGuest(handle: string): Promise<PublicCreator | null> {
  if (!HANDLE_RE.test(handle)) return null;
  await connection();
  const { data, error } = await createAnonClient().rpc("get_public_creator", { p_handle: handle }).maybeSingle();
  if (error) throw error;
  return data ? toPublicCreator(data as PublicCreatorRow) : null;
}

export async function loadPortfolio(creatorId: string): Promise<PortfolioItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_portfolio_items").select("image_path, link_url").eq("creator_id", creatorId).order("position");
  if (error) throw error;
  return (data ?? []).map((r) => ({ imagePath: r.image_path, linkUrl: r.link_url }));
}

/** 報價受 RLS 限制：只有品牌（已審核的創作者）與本人讀得到，其他人得到空陣列。 */
export async function loadRates(creatorId: string, collabTypes: string[]): Promise<Rate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("creator_rates").select("collab_type, price_twd").eq("creator_id", creatorId);
  if (error) throw error;
  return sortRatesByTypes((data ?? []).map((r) => ({ collabType: r.collab_type, priceTwd: r.price_twd })), collabTypes);
}

/** 目前的品牌有沒有收藏這位創作者。RLS 只讓品牌看到自己的收藏；不是品牌時永遠是 false。會讀 cookies。 */
export async function loadIsFavorite(creatorId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_favorites").select("creator_id").eq("creator_id", creatorId).maybeSingle();
  if (error) throw error;
  return data !== null;
}
