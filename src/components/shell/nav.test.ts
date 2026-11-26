import { describe, expect, it } from "vitest";
import { BRAND_NAV, CREATOR_NAV, isActive } from "./nav";

describe("isActive", () => {
  it("首頁只比對完全相同", () => {
    expect(isActive("/brand", "/brand")).toBe(true);
    expect(isActive("/brand", "/brand/settings")).toBe(false);
    expect(isActive("/creator", "/creator/me")).toBe(false);
  });
  it("其他項目含子路徑", () => {
    expect(isActive("/brand/settings", "/brand/settings")).toBe(true);
    expect(isActive("/creator/me", "/creator/me/x")).toBe(true);
    expect(isActive("/creator/me", "/creator/mex")).toBe(false);
  });
});

describe("BRAND_NAV", () => {
  it("我的招募已開放，子頁面也會亮起", () => {
    expect(BRAND_NAV.find((i) => i.label === "我的招募")?.href).toBe("/brand/briefs");
    expect(isActive("/brand/briefs", "/brand/briefs/new")).toBe(true);
    expect(isActive("/brand", "/brand/briefs")).toBe(false);
  });
});

describe("合作案（計畫 6）", () => {
  it("品牌「合作案」與創作者「合作」已開放，詳情頁也會亮起", () => {
    expect(BRAND_NAV.find((i) => i.label === "合作案")?.href).toBe("/brand/collabs");
    expect(CREATOR_NAV.find((i) => i.label === "合作")?.href).toBe("/creator/collabs");
    expect(isActive("/creator/collabs", "/creator/collabs/00000000-0000-0000-0000-000000000001")).toBe(true);
  });
});

describe("訊息（計畫 7）", () => {
  it("品牌與創作者的「訊息」已開放並顯示未讀徽章，對話頁也會亮起", () => {
    expect(BRAND_NAV.find((i) => i.label === "訊息")).toMatchObject({ href: "/brand/messages", badge: "messages" });
    expect(CREATOR_NAV.find((i) => i.label === "訊息")).toMatchObject({ href: "/creator/messages", badge: "messages" });
    expect(isActive("/brand/messages", "/brand/messages/00000000-0000-0000-0000-000000000001")).toBe(true);
    expect(BRAND_NAV.filter((i) => i.badge).length).toBe(1);
  });
});
