import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/brand/actions", () => ({ setFavoriteAction: vi.fn() }));
vi.mock("@/app/brand/collabs/actions", () => ({ inviteCreatorAction: vi.fn() }));
vi.mock("@/app/brand/messages/actions", () => ({ startConversationAction: vi.fn() }));
import { ProfileView } from "./ProfileView";
import type { PublicCreator, ViewerKind } from "@/lib/creators/view";

const creator = {
  userId: "u1", handle: "mei", displayName: "Mei", igUsername: "mei", followerCount: 1000, engagementRate: null,
  region: null, categories: [], styleTags: [], collabTypes: [], bio: null, avatarPath: null, audienceAge: null,
} as unknown as PublicCreator;

const html = (viewer: ViewerKind, favorite?: boolean) =>
  renderToStaticMarkup(createElement(ProfileView, { creator, portfolio: [], rates: [], viewer, favorite }));

describe("ProfileView 報價區", () => {
  const withRates = (viewer: ViewerKind, c: PublicCreator = creator) =>
    renderToStaticMarkup(createElement(ProfileView, { creator: c, portfolio: [], rates: [{ collabType: "IG 貼文", priceTwd: 8000 }], viewer }));
  it("報價對所有人公開（訪客、創作者、品牌）", () => {
    for (const v of ["guest", "creator", "brand"] as const) {
      expect(withRates(v)).toContain("IG 貼文");
      expect(withRates(v)).toContain("NT$8,000");
    }
  });
  it("訪客多一行註冊品牌帳號的引導；登入的人沒有", () => {
    expect(withRates("guest")).toContain("/signup?role=brand");
    expect(withRates("creator")).not.toContain("註冊品牌帳號");
  });
});

describe("ProfileView 粉絲數（登入後才顯示）", () => {
  it("有粉絲數時顯示數字", () => {
    expect(html("creator")).toContain("1,000");
    expect(html("creator")).not.toContain("登入後顯示");
  });
  it("訪客（粉絲數是 null）看到登入連結，登入後回到這一頁", () => {
    const out = renderToStaticMarkup(createElement(ProfileView, {
      creator: { ...creator, followerCount: null } as PublicCreator, portfolio: [], rates: [], viewer: "guest",
    }));
    expect(out).toContain("登入後顯示");
    expect(out).toContain("/login?next=%2Fc%2Fmei");
    expect(out).not.toContain("1,000");
  });
});

describe("ProfileView 收藏 ♡", () => {
  it("品牌看到 ♡，狀態反映是否已收藏", () => {
    expect(html("brand", false)).toContain('aria-label="收藏 Mei" aria-pressed="false"');
    expect(html("brand", true)).toContain('aria-label="收藏 Mei" aria-pressed="true"');
  });
  it("訪客與創作者看不到 ♡", () => {
    expect(html("guest", false)).not.toContain("收藏 Mei");
    expect(html("creator", false)).not.toContain("收藏 Mei");
  });
});

describe("ProfileView 傳訊息（計畫 7）", () => {
  it("只有品牌看到「傳訊息」", () => {
    expect(html("brand", false)).toContain("傳訊息");
    expect(html("guest")).not.toContain("傳訊息");
    expect(html("creator")).not.toContain("傳訊息");
  });
});
