import { describe, expect, it } from "vitest";
import {
  isInstagramUrl, splitTags, validatePortfolio, validatePublicProfileInput, validateRates, type PublicProfileInput,
} from "./creator-profile";

const ok: PublicProfileInput = {
  bio: "日常穿搭分享", styleTags: ["日系", "簡約"], collabTypes: ["IG 貼文", "Reels"],
  engagementRate: "3.5", audienceAge: "18-24", avatarPath: null,
};

describe("isInstagramUrl（與資料庫 check_instagram_url 相同規則）", () => {
  it.each([
    "https://www.instagram.com/p/ABC123/",
    "https://instagram.com/reel/xyz?igsh=abc",
  ])("%s 可以", (u) => expect(isInstagramUrl(u)).toBe(true));
  it.each([
    "http://instagram.com/p/1",
    "https://instagram.com.evil.com/p/1",
    "https://evil.com/instagram.com/p/1",
    "https://www.instagram.com/",
    "https://www.instagram.com/p/a b",
    "https://www.instagram.com/p/‮1",
    `https://www.instagram.com/${"a".repeat(300)}`,
  ])("%s 不行", (u) => expect(isInstagramUrl(u)).toBe(false));
});

describe("splitTags", () => {
  it("半形、全形逗號與頓號都可以分隔，空白項目去掉", () => {
    expect(splitTags(" 日系, 簡約，可愛、 ,")).toEqual(["日系", "簡約", "可愛"]);
    expect(splitTags("")).toEqual([]);
  });
});

describe("validatePublicProfileInput", () => {
  it("正確資料沒有錯誤；全部留空也可以", () => {
    expect(validatePublicProfileInput(ok)).toBeNull();
    expect(validatePublicProfileInput({
      bio: "", styleTags: [], collabTypes: [], engagementRate: "", audienceAge: "", avatarPath: null,
    })).toBeNull();
  });
  it("自我介紹最多 300 字、不可含雙向控制字元", () => {
    expect(validatePublicProfileInput({ ...ok, bio: "長".repeat(301) })?.bio).toBe("自我介紹最多 300 字");
    expect(validatePublicProfileInput({ ...ok, bio: "小‮美" })?.bio).toBe("含有不允許的特殊字元");
  });
  it("風格標籤：最多 8 個、每個 12 字、不可重複", () => {
    const msg = "最多 8 個標籤，每個 12 字以內，不可重複";
    expect(validatePublicProfileInput({ ...ok, styleTags: ["a", "b", "c", "d", "e", "f", "g", "h", "i"] })?.styleTags).toBe(msg);
    expect(validatePublicProfileInput({ ...ok, styleTags: ["長".repeat(13)] })?.styleTags).toBe(msg);
    expect(validatePublicProfileInput({ ...ok, styleTags: ["日系", "日系"] })?.styleTags).toBe(msg);
  });
  it("想接的合作：最多 6 個、每個 20 字", () => {
    expect(validatePublicProfileInput({ ...ok, collabTypes: ["a", "b", "c", "d", "e", "f", "g"] })?.collabTypes)
      .toBe("請重新選擇想接的合作");
  });
  it("互動率：0–100，最多兩位小數", () => {
    for (const v of ["0", "3.5", "100", "99.99"]) expect(validatePublicProfileInput({ ...ok, engagementRate: v })).toBeNull();
    for (const v of ["101", "-1", "3.555", "abc", "1e2"]) {
      expect(validatePublicProfileInput({ ...ok, engagementRate: v })?.engagementRate).toBe("請填 0–100 的數字（最多兩位小數）");
    }
  });
  it("受眾年齡最多 10 字", () => {
    expect(validatePublicProfileInput({ ...ok, audienceAge: "1".repeat(11) })?.audienceAge).toBe("請重新選擇受眾年齡");
  });
});

describe("validatePortfolio", () => {
  const item = { imagePath: "u1/portfolio-a.jpg", linkUrl: "" };
  it("正確資料沒有錯誤", () => {
    expect(validatePortfolio([item, { ...item, linkUrl: "https://www.instagram.com/p/1/" }])).toBeNull();
    expect(validatePortfolio([])).toBeNull();
  });
  it("最多 6 張", () => {
    expect(validatePortfolio(Array(7).fill(item))?.portfolio).toBe("最多 6 張作品");
  });
  it("連結錯誤時指出第幾張", () => {
    expect(validatePortfolio([item, { ...item, linkUrl: "https://evil.com/p/1" }])?.portfolio)
      .toBe("第 2 張的連結必須是 https://www.instagram.com/ 開頭的網址");
  });
  it("圖片路徑不可為空", () => {
    expect(validatePortfolio([{ imagePath: "", linkUrl: "" }])?.portfolio).toBe("有作品還沒上傳完成");
  });
});

describe("validateRates", () => {
  it("0 到 10,000,000 的整數", () => {
    expect(validateRates([{ collabType: "IG 貼文", price: "4500" }, { collabType: "Reels", price: "0" }])).toBeNull();
    expect(validateRates([{ collabType: "Reels", price: "10000000" }])).toBeNull();
  });
  it("錯誤以 price:<合作形式> 為 key", () => {
    const msg = "請填 0 到 10,000,000 的整數";
    expect(validateRates([{ collabType: "Reels", price: "-1" }])).toEqual({ "price:Reels": msg });
    expect(validateRates([{ collabType: "Reels", price: "1.5" }])).toEqual({ "price:Reels": msg });
    expect(validateRates([{ collabType: "Reels", price: "10000001" }])).toEqual({ "price:Reels": msg });
  });
});
