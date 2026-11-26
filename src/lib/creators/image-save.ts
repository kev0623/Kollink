// 圖片上傳即儲存：只把圖片換進「資料庫裡目前已儲存」的內容，其他還沒儲存的修改不受影響。
import type { OwnProfileFields, PortfolioItem } from "./view";
import { validatePortfolio, validatePublicProfileInput } from "@/lib/validation/creator-profile";

/** 已儲存的公開資料換上新頭像，輸出成 update_creator_public_profile 的參數；已儲存的資料本身不合法時回 null。 */
export function avatarSaveArgs(saved: OwnProfileFields, avatarPath: string) {
  const engagement = saved.engagementRate === null ? "" : String(saved.engagementRate);
  const input = {
    bio: saved.bio, styleTags: saved.styleTags, collabTypes: saved.collabTypes,
    engagementRate: engagement, audienceAge: saved.audienceAge, avatarPath,
  };
  if (validatePublicProfileInput(input)) return null;
  return {
    p_bio: saved.bio,
    p_style_tags: saved.styleTags,
    p_collab_types: saved.collabTypes,
    p_engagement_rate: saved.engagementRate as number,
    p_audience_age: saved.audienceAge,
    p_avatar_path: avatarPath,
  };
}

/** 已儲存的作品清單加上新圖片（排最後），輸出成 set_creator_portfolio 的 p_items；超過上限回 error。 */
export function portfolioAppendItems(
  saved: PortfolioItem[], imagePath: string,
): { items: { image_path: string; link_url: string | null }[] } | { error: string } {
  const next = [...saved.map((s) => ({ imagePath: s.imagePath, linkUrl: s.linkUrl ?? "" })), { imagePath, linkUrl: "" }];
  const errors = validatePortfolio(next);
  if (errors) return { error: errors.portfolio ?? "作品無法儲存" };
  return { items: next.map((it) => ({ image_path: it.imagePath, link_url: it.linkUrl || null })) };
}
