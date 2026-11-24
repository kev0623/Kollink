import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/brand/actions", () => ({ setFavoriteAction: vi.fn() }));
import { CreatorCard } from "./CreatorCard";
import { CreatorTable } from "./CreatorTable";
import type { SquareCreator } from "@/lib/creators/square-view";

const base: SquareCreator = {
  userId: "u1", handle: "mei", displayName: "小美", avatarPath: null, region: "台北市", categories: ["美妝", "穿搭"],
  styleTags: ["日系"], collabTypes: ["IG 貼文", "Reels", "限時動態"], followerCount: 12000, engagementRate: 3.5,
  minPrice: 4500, postPrice: null, portfolioPaths: [], isFavorite: false,
};

const card = (c: Partial<SquareCreator> = {}) => renderToStaticMarkup(createElement(CreatorCard, { c: { ...base, ...c } }));
const table = (sort: "newest" | "followers" | "engagement" | "price" = "newest", items = [base]) =>
  renderToStaticMarkup(createElement(CreatorTable, { items, sort, onSort: () => {} }));

describe("CreatorCard", () => {
  it("連到公開頁，顯示名稱、地區、內容領域、數據與起價", () => {
    const out = card();
    expect(out).toContain('href="/c/mei"');
    expect(out).toContain("小美");
    expect(out).toContain("台北市");
    expect(out).toContain("美妝、穿搭");
    expect(out).toContain("12,000");
    expect(out).toContain("3.5%");
    expect(out).toContain("NT$4,500");
  });
  it("沒有報價時起價顯示「洽談」", () => {
    expect(card({ minPrice: null })).toContain("洽談");
  });
  it("標籤最多 3 個，風格標籤優先", () => {
    const out = card();
    expect(out).toContain("日系");
    expect(out).toContain("Reels");
    expect(out).not.toContain("限時動態");
  });
  it("沒有作品時顯示名字首字，不放圖片", () => {
    const out = card();
    expect(out).not.toContain("<img");
    expect(out).toContain(">小</div>");
  });
  it("最多顯示三張作品縮圖", () => {
    // 沒有頭像，所以 <img> 都是作品縮圖
    const out = card({ portfolioPaths: ["u1/portfolio-a.jpg", "u1/portfolio-b.jpg", "u1/portfolio-c.jpg", "u1/portfolio-d.jpg"] });
    expect(out.match(/<img/g)?.length).toBe(3);
  });
  it("有 ♡，反映收藏狀態", () => {
    expect(card({ isFavorite: true })).toContain('aria-label="收藏 小美" aria-pressed="true"');
  });
});

describe("CreatorTable", () => {
  it("一列一位：名稱連結、粉絲數、互動率、貼文報價（沒有顯示 —）、地區、查看", () => {
    const out = table();
    expect(out).toContain('href="/c/mei"');
    expect(out).toContain("12,000");
    expect(out).toContain("3.5%");
    expect(out).toContain("—");
    expect(out).toContain("台北市");
    expect(out).toContain("查看");
    expect(out).toContain('aria-label="收藏 小美"');
  });
  it("貼文報價有值時顯示價格", () => {
    expect(table("newest", [{ ...base, postPrice: 6000 }])).toContain("NT$6,000");
  });
  it("只有三個欄位標題可以點；目前的排序標上 aria-sort", () => {
    const out = table("followers");
    expect(out.match(/<button[^>]*data-sort=/g)?.length).toBe(3);
    expect(out).toContain('aria-sort="descending"');
    expect(table("price")).toContain('aria-sort="ascending"');
    expect(table("newest")).not.toContain("aria-sort");
  });
  it("表格可以左右捲動", () => {
    expect(table()).toContain("overflow-x-auto");
  });
});
