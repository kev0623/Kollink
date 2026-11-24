import "server-only";
import { createClient } from "@/lib/supabase/server";
import { sortRatesByTypes, toOwnProfileFields, type OwnProfileFields, type PortfolioItem, type Rate } from "./view";

export type OwnPublicProfile = { profile: OwnProfileFields; portfolio: PortfolioItem[]; rates: Rate[] };

/** 創作者後台讀自己的公開頁資料（使用者自己的 client；呼叫前先 requireRole("creator")）。 */
export async function loadOwnPublicProfile(userId: string): Promise<OwnPublicProfile> {
  const supabase = await createClient();
  const [p, items, rates] = await Promise.all([
    supabase.from("creator_profiles")
      .select("bio, style_tags, collab_types, engagement_rate, audience_age, avatar_path")
      .eq("user_id", userId).single(),
    supabase.from("creator_portfolio_items").select("image_path, link_url").eq("creator_id", userId).order("position"),
    supabase.from("creator_rates").select("collab_type, price_twd").eq("creator_id", userId),
  ]);
  if (p.error) throw p.error;
  if (items.error) throw items.error;
  if (rates.error) throw rates.error;
  const profile = toOwnProfileFields(p.data);
  return {
    profile,
    portfolio: (items.data ?? []).map((r) => ({ imagePath: r.image_path, linkUrl: r.link_url })),
    rates: sortRatesByTypes(
      (rates.data ?? []).map((r) => ({ collabType: r.collab_type, priceTwd: r.price_twd })), profile.collabTypes,
    ),
  };
}
