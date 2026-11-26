import { describe, expect, it } from "vitest";
import { avatarSaveArgs, portfolioAppendItems } from "./image-save";

const saved = { bio: "舊的介紹", styleTags: ["日系"], collabTypes: ["圖文"], engagementRate: 3.5, audienceAge: "", avatarPath: null };

describe("avatarSaveArgs", () => {
  it("只換頭像，其餘維持已儲存的值", () => {
    expect(avatarSaveArgs(saved, "u/avatar/x.png")).toEqual({
      p_bio: "舊的介紹", p_style_tags: ["日系"], p_collab_types: ["圖文"],
      p_engagement_rate: 3.5, p_audience_age: "", p_avatar_path: "u/avatar/x.png",
    });
  });
  it("沒有互動率時傳 null", () => {
    expect(avatarSaveArgs({ ...saved, engagementRate: null }, "p")?.p_engagement_rate).toBeNull();
  });
});

describe("portfolioAppendItems", () => {
  it("新圖片排在已儲存清單最後，連結沿用已儲存的", () => {
    const r = portfolioAppendItems([{ imagePath: "a", linkUrl: "https://www.instagram.com/p/1/" }], "b");
    expect(r).toEqual({ items: [{ image_path: "a", link_url: "https://www.instagram.com/p/1/" }, { image_path: "b", link_url: null }] });
  });
  it("超過上限回錯誤", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ imagePath: `p${i}`, linkUrl: null }));
    expect(portfolioAppendItems(many, "z")).toHaveProperty("error");
  });
});
