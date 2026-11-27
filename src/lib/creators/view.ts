import type { Role } from "@/lib/auth/post-login";

export type CreatorStatus = "pending" | "approved" | "suspended" | "rejected";
const STATUSES: readonly string[] = ["pending", "approved", "suspended", "rejected"];

export type PublicCreator = {
  userId: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  region: string | null;
  categories: string[];
  /** 粉絲數：登入後才有；訪客是 null（資料庫就不回傳，20261204000100_gate_followers.sql） */
  followerCount: number | null;
  engagementRate: number | null;
  audienceAge: string | null;
  styleTags: string[];
  collabTypes: string[];
  bio: string | null;
  status: CreatorStatus;
  isSelf: boolean;
};

/** get_public_creator 回傳的一列。產生的型別把 RETURNS TABLE 的欄位都標成非 null，實際上可能是 null，所以自己定義。 */
export type PublicCreatorRow = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_path: string | null;
  region: string | null;
  categories: string[] | null;
  follower_count: number | null;
  engagement_rate: number | string | null;
  audience_age: string | null;
  style_tags: string[] | null;
  collab_types: string[] | null;
  bio: string | null;
  status: string;
  is_self: boolean | null;
};

export type PortfolioItem = { imagePath: string; linkUrl: string | null };
export type Rate = { collabType: string; priceTwd: number };

/** 後台公開頁表單的初始值。 */
export type OwnProfileFields = {
  bio: string;
  styleTags: string[];
  collabTypes: string[];
  engagementRate: number | null;
  audienceAge: string;
  avatarPath: string | null;
};

export type OwnProfileRow = {
  bio: string | null;
  style_tags: string[] | null;
  collab_types: string[] | null;
  engagement_rate: number | string | null;
  audience_age: string | null;
  avatar_path: string | null;
};

export type ViewerKind = "guest" | "brand" | "creator";

export function toNumberOrNull(v: number | string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toPublicCreator(r: PublicCreatorRow): PublicCreator {
  return {
    userId: r.user_id,
    handle: r.handle,
    displayName: r.display_name,
    avatarPath: r.avatar_path ?? null,
    region: r.region ?? null,
    categories: r.categories ?? [],
    followerCount: r.follower_count,
    engagementRate: toNumberOrNull(r.engagement_rate),
    audienceAge: r.audience_age ?? null,
    styleTags: r.style_tags ?? [],
    collabTypes: r.collab_types ?? [],
    bio: r.bio ?? null,
    status: STATUSES.includes(r.status) ? (r.status as CreatorStatus) : "pending",
    isSelf: r.is_self === true,
  };
}

export function toOwnProfileFields(r: OwnProfileRow): OwnProfileFields {
  return {
    bio: r.bio ?? "",
    styleTags: r.style_tags ?? [],
    collabTypes: r.collab_types ?? [],
    engagementRate: toNumberOrNull(r.engagement_rate),
    audienceAge: r.audience_age ?? "",
    avatarPath: r.avatar_path ?? null,
  };
}

/** 瀏覽公開頁的人：品牌、創作者（含本人），其他（未登入、還沒建立帳號）都是訪客。 */
export function viewerKindOf(role: Role | null | undefined): ViewerKind {
  if (role === "brand") return "brand";
  if (role === "creator") return "creator";
  return "guest";
}

/** 報價依創作者勾選「想接的合作」的順序排列；不在清單內的排最後。 */
export function sortRatesByTypes(rates: Rate[], collabTypes: string[]): Rate[] {
  const order = (t: string) => {
    const i = collabTypes.indexOf(t);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...rates].sort((a, b) => order(a.collabType) - order(b.collabType) || a.collabType.localeCompare(b.collabType));
}
