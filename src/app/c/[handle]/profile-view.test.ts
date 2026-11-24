import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProfileView } from "./ProfileView";
import type { PublicCreator, ViewerKind } from "@/lib/creators/view";

const creator = {
  userId: "u1", handle: "mei", displayName: "Mei", igUsername: "mei", followerCount: 1000, engagementRate: null,
  region: null, categories: [], styleTags: [], collabTypes: [], bio: null, avatarPath: null, audienceAge: null,
} as unknown as PublicCreator;

const html = (viewer: ViewerKind) =>
  renderToStaticMarkup(createElement(ProfileView, { creator, portfolio: [], rates: [], viewer }));

describe("ProfileView 報價區", () => {
  it("訪客看到登入連結", () => {
    expect(html("guest")).toContain("/login?next=%2Fc%2Fmei");
  });
  it("創作者（含本人）只看到說明文字，沒有登入連結", () => {
    const out = html("creator");
    expect(out).toContain("報價只開放給品牌查看");
    expect(out).not.toContain("/login");
  });
});
