import { describe, expect, it } from "vitest";
import { ADMIN_NAV, BRAND_NAV, CREATOR_NAV, isActive } from "./nav";

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

describe("管理後台（計畫 9）", () => {
  it("5 項都開放（手機底部導覽列放得下），總覽只比對完全相同", () => {
    expect(ADMIN_NAV.map((i) => i.href)).toEqual(["/admin", "/admin/creators", "/admin/collabs", "/admin/payments", "/admin/messages"]);
    expect(isActive("/admin", "/admin")).toBe(true);
    expect(isActive("/admin", "/admin/creators")).toBe(false);
    expect(isActive("/admin/collabs", "/admin/collabs/00000000-0000-0000-0000-000000000001")).toBe(true);
  });
});

describe("收入與付款紀錄", () => {
  it("創作者「收入」與品牌「付款紀錄」已開放（沒有「即將推出」的項目了），子路徑也會亮起", () => {
    expect(CREATOR_NAV.find((i) => i.label === "收入")).toMatchObject({ href: "/creator/earnings", icon: "Wallet" });
    expect(BRAND_NAV.find((i) => i.label === "付款紀錄")).toMatchObject({ href: "/brand/payments", icon: "Receipt" });
    expect(BRAND_NAV.find((i) => i.label === "付款與發票")).toBeUndefined();
    expect(isActive("/creator/earnings", "/creator/earnings")).toBe(true);
    expect(isActive("/brand/payments", "/brand/payments")).toBe(true);
    expect(isActive("/creator", "/creator/earnings")).toBe(false);
    for (const it of [...BRAND_NAV, ...CREATOR_NAV]) expect(it.href).not.toBeNull();
  });
});
