import { describe, expect, it } from "vitest";
import { profileMetadata } from "./metadata";
import type { PublicCreator } from "./view";

const c: PublicCreator = {
  userId: "u1", handle: "mei", displayName: "小美", avatarPath: null, region: "台北市", categories: ["美妝", "穿搭"],
  followerCount: 12000, engagementRate: 3.5, audienceAge: "18-24", styleTags: [], collabTypes: [], bio: null,
  status: "approved", isSelf: false,
};

describe("profileMetadata", () => {
  it("已審核：title、description、openGraph，沒有 robots", () => {
    const m = profileMetadata(c);
    expect(m.title).toEqual({ absolute: "小美（@mei）｜Kollink" });
    expect(m.description).toBe("台北市・美妝、穿搭・IG 粉絲 12,000");
    expect(m.openGraph).toMatchObject({ title: "小美（@mei）｜Kollink", type: "profile" });
    expect(m.robots).toBeUndefined();
  });
  it("本人預覽（未審核）加 noindex", () => {
    expect(profileMetadata({ ...c, status: "pending", isSelf: true }).robots).toEqual({ index: false, follow: false });
  });
  it("沒有地區與內容領域時只剩粉絲數", () => {
    expect(profileMetadata({ ...c, region: null, categories: [], followerCount: 0 }).description).toBe("IG 粉絲 0");
    // 訪客拿不到粉絲數：描述裡就不寫
    expect(profileMetadata({ ...c, followerCount: null }).description).not.toContain("粉絲");
  });
  it("找不到時不洩漏任何資料", () => {
    const m = profileMetadata(null);
    expect(m).toEqual({ title: { absolute: "找不到這個頁面｜Kollink" }, robots: { index: false, follow: false } });
  });
});
