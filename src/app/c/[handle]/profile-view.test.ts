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
  it("訪客看到登入連結", () => {
    expect(html("guest")).toContain("/login?next=%2Fc%2Fmei");
  });
  it("創作者（含本人）只看到說明文字，沒有登入連結", () => {
    const out = html("creator");
    expect(out).toContain("完整報價只開放給品牌查看");
    expect(out).not.toContain("/login");
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
