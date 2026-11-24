import { describe, expect, it } from "vitest";
import { sortRatesByTypes, toOwnProfileFields, toPublicCreator, viewerKindOf, type PublicCreatorRow } from "./view";

const row: PublicCreatorRow = {
  user_id: "u1", handle: "mei", display_name: "小美", avatar_path: null, region: "台北市",
  categories: ["美妝"], follower_count: 12000, engagement_rate: "3.50", audience_age: null,
  style_tags: null, collab_types: ["IG 貼文"], bio: null, status: "approved", is_self: false,
};

describe("toPublicCreator", () => {
  it("轉成駝峰欄位；numeric 字串轉數字；null 陣列變空陣列", () => {
    expect(toPublicCreator(row)).toEqual({
      userId: "u1", handle: "mei", displayName: "小美", avatarPath: null, region: "台北市",
      categories: ["美妝"], followerCount: 12000, engagementRate: 3.5, audienceAge: null,
      styleTags: [], collabTypes: ["IG 貼文"], bio: null, status: "approved", isSelf: false,
    });
  });
  it("未知的狀態當成 pending；is_self 只有 true 才算本人", () => {
    expect(toPublicCreator({ ...row, status: "weird", is_self: null })).toMatchObject({ status: "pending", isSelf: false });
    expect(toPublicCreator({ ...row, engagement_rate: null }).engagementRate).toBeNull();
  });
});

describe("toOwnProfileFields", () => {
  it("null 變成表單預設值", () => {
    expect(toOwnProfileFields({
      bio: null, style_tags: null, collab_types: ["Reels"], engagement_rate: 2, audience_age: null, avatar_path: null,
    })).toEqual({ bio: "", styleTags: [], collabTypes: ["Reels"], engagementRate: 2, audienceAge: "", avatarPath: null });
  });
});

describe("viewerKindOf", () => {
  it("品牌、創作者，其他都是訪客", () => {
    expect(viewerKindOf("brand")).toBe("brand");
    expect(viewerKindOf("creator")).toBe("creator");
    expect(viewerKindOf(null)).toBe("guest");
    expect(viewerKindOf(undefined)).toBe("guest");
  });
});

describe("sortRatesByTypes", () => {
  it("依想接的合作順序排列，不在清單的排最後", () => {
    const rates = [
      { collabType: "產品互惠", priceTwd: 0 },
      { collabType: "IG 貼文", priceTwd: 4500 },
      { collabType: "Reels", priceTwd: 8000 },
    ];
    expect(sortRatesByTypes(rates, ["Reels", "IG 貼文"]).map((r) => r.collabType)).toEqual(["Reels", "IG 貼文", "產品互惠"]);
  });
});
