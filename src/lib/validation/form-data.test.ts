import { describe, expect, it } from "vitest";
import { parseBrandForm, parseCreatorForm, parsePortfolioForm, parsePublicProfileForm, parseRatesForm } from "./form-data";

function fd(entries: [string, string][]) {
  const f = new FormData();
  entries.forEach(([k, v]) => f.append(k, v));
  return f;
}

describe("parseBrandForm", () => {
  it("去空白、空的 Logo 變成 null", () => {
    expect(parseBrandForm(fd([["brandName", " 花粉選物\u3000"], ["industry", "美妝保養"], ["logoPath", " "]]))).toEqual({
      brandName: "花粉選物", industry: "美妝保養", logoPath: null,
    });
  });
  it("缺欄位時為空字串", () => {
    expect(parseBrandForm(fd([]))).toEqual({ brandName: "", industry: "", logoPath: null });
  });
  it("Logo 路徑原樣保留", () => {
    expect(parseBrandForm(fd([["brandName", "x"], ["industry", "美妝保養"], ["logoPath", "u1/a.png"]])).logoPath).toBe("u1/a.png");
  });
});

describe("parseCreatorForm", () => {
  it("IG 去掉 @、內容領域取多個值", () => {
    expect(parseCreatorForm(fd([
      ["displayName", " 小美 "], ["handle", "mei.daily"], ["igUsername", "@mei.daily"],
      ["followerCount", " 12000 "], ["region", "台北市"], ["categories", "美妝"], ["categories", " 穿搭"],
    ]))).toEqual({
      displayName: "小美", handle: "mei.daily", igUsername: "mei.daily",
      followerCount: "12000", region: "台北市", categories: ["美妝", "穿搭"],
    });
  });
});

describe("parsePublicProfileForm", () => {
  it("自我介紹的換行統一成 \\n（textarea 送出 \\r\\n，長度要和使用者看到的一致）", () => {
    const r = parsePublicProfileForm(fd([["bio", "第一行\r\n第二行\r第三行"], ["avatarPath", ""]]));
    expect(r.bio).toBe("第一行\n第二行\n第三行");
  });
  it("清理文字、拆標籤、多值合作形式、去掉互動率的 %", () => {
    expect(parsePublicProfileForm(fd([
      ["bio", " 日常穿搭\n分享　"], ["styleTags", "日系，簡約、"], ["collabTypes", "IG 貼文"], ["collabTypes", "Reels"],
      ["engagementRate", " 3.5% "], ["audienceAge", "18-24"], ["avatarPath", " "],
    ]))).toEqual({
      bio: "日常穿搭\n分享", styleTags: ["日系", "簡約"], collabTypes: ["IG 貼文", "Reels"],
      engagementRate: "3.5", audienceAge: "18-24", avatarPath: null,
    });
  });
});

describe("parsePortfolioForm", () => {
  it("解析 items JSON；欄位不是字串時變成空字串", () => {
    expect(parsePortfolioForm(fd([["items", JSON.stringify([
      { imagePath: " u1/portfolio-a.jpg ", linkUrl: "https://www.instagram.com/p/1/" },
      { imagePath: 1, linkUrl: null },
    ])]]))).toEqual([
      { imagePath: "u1/portfolio-a.jpg", linkUrl: "https://www.instagram.com/p/1/" },
      { imagePath: "", linkUrl: "" },
    ]);
  });
  it("不是 JSON 陣列時回傳 null", () => {
    expect(parsePortfolioForm(fd([["items", "{"]]))).toBeNull();
    expect(parsePortfolioForm(fd([["items", "{}"]]))).toBeNull();
    expect(parsePortfolioForm(fd([]))).toBeNull();
  });
});

describe("parseRatesForm", () => {
  it("只讀清單內的合作形式；去掉千分位與空白；空白代表不提供", () => {
    expect(parseRatesForm(fd([
      ["price:IG 貼文", " 4,500 "], ["price:Reels", ""], ["price:限時動態", "100"],
    ]), ["IG 貼文", "Reels"])).toEqual([{ collabType: "IG 貼文", price: "4500" }]);
  });
});
