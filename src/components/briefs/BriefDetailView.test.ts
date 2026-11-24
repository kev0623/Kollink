import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BriefDetailView } from "./BriefDetailView";

const brief = {
  title: "新品開箱", description: "說明", collabTypes: ["貼文"], categories: ["美妝"], minFollowers: 0,
  region: null, budgetMin: null, budgetMax: null, includesProduct: false, deadline: null, coverPath: null,
  brandName: "品牌", brandLogoPath: null, applicantCount: null,
} as Parameters<typeof BriefDetailView>[0]["brief"];

const count = (html: string, tag: string) => (html.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;

describe("BriefDetailView heading level", () => {
  it("defaults to h1 title with h2 sections", () => {
    const html = renderToStaticMarkup(createElement(BriefDetailView, { brief, today: "2026-11-24" }));
    expect(count(html, "h1")).toBe(1);
    expect(count(html, "h2")).toBe(2);
  });
  it("headingLevel=2 renders no h1 (title h2, sections h3)", () => {
    const html = renderToStaticMarkup(createElement(BriefDetailView, { brief, today: "2026-11-24", headingLevel: 2 }));
    expect(count(html, "h1")).toBe(0);
    expect(count(html, "h2")).toBe(1);
    expect(count(html, "h3")).toBe(2);
  });
});
