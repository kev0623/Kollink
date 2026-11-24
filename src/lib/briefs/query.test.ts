import { describe, expect, it } from "vitest";
import {
  OPPORTUNITY_FILTERS, isUuid, opportunityHref, opportunityQueryString, parseBrandBriefTab, parseBriefStep,
  parseOpportunityQuery, sameOpportunityQuery, toListArgs,
} from "./query";

describe("isUuid", () => {
  it("只接受 UUID 字串", () => {
    expect(isUuid("00000000-0000-0000-0000-00000006f001")).toBe(true);
    expect(isUuid("abc")).toBe(false);
    expect(isUuid(123)).toBe(false);
  });
});

describe("parseOpportunityQuery", () => {
  it("預設是適合我；垃圾值也是", () => {
    expect(parseOpportunityQuery({})).toEqual({ tab: "match", category: null });
    expect(parseOpportunityQuery({ tab: "drop table" })).toEqual({ tab: "match", category: null });
    expect(parseOpportunityQuery(new URLSearchParams("tab=match"))).toEqual({ tab: "match", category: null });
  });
  it("tab 與 cat；cat 優先、會清理並截成 30 字", () => {
    expect(parseOpportunityQuery({ tab: "cash" })).toEqual({ tab: "cash", category: null });
    expect(parseOpportunityQuery({ tab: ["applied", "all"] })).toEqual({ tab: "applied", category: null });
    expect(parseOpportunityQuery({ tab: "all", cat: " 美妝 " })).toEqual({ tab: "category", category: "美妝" });
    expect(parseOpportunityQuery({ cat: "字".repeat(40) }).category).toBe("字".repeat(30));
    expect(parseOpportunityQuery({ cat: "不在清單" })).toEqual({ tab: "category", category: "不在清單" });
    expect(parseOpportunityQuery({ cat: "  " })).toEqual({ tab: "match", category: null });
  });
});

describe("網址與參數", () => {
  it("opportunityHref／QueryString 來回一致", () => {
    for (const { query } of OPPORTUNITY_FILTERS) {
      expect(parseOpportunityQuery(new URLSearchParams(opportunityQueryString(query)))).toEqual(query);
    }
    expect(opportunityHref({ tab: "match", category: null })).toBe("/creator");
    expect(opportunityHref({ tab: "applied", category: null })).toBe("/creator?tab=applied");
    expect(opportunityHref({ tab: "category", category: "美妝" })).toBe("/creator?cat=%E7%BE%8E%E5%A6%9D");
  });
  it("toListArgs", () => {
    expect(toListArgs({ tab: "match", category: null }, 0)).toEqual({ p_filter: "match", p_limit: 20, p_offset: 0 });
    expect(toListArgs({ tab: "category", category: "美妝" }, 20)).toEqual({ p_filter: "category", p_category: "美妝", p_limit: 20, p_offset: 20 });
  });
  it("篩選標籤：適合我、全部、各內容領域、現金、互惠", () => {
    expect(OPPORTUNITY_FILTERS.map((f) => f.label).slice(0, 3)).toEqual(["適合我", "全部", "美妝"]);
    expect(OPPORTUNITY_FILTERS.at(-1)?.label).toBe("互惠");
    expect(sameOpportunityQuery({ tab: "category", category: "美妝" }, { tab: "category", category: "美妝" })).toBe(true);
    expect(sameOpportunityQuery({ tab: "category", category: "美妝" }, { tab: "category", category: "保養" })).toBe(false);
  });
});

describe("品牌", () => {
  it("parseBrandBriefTab", () => {
    expect(parseBrandBriefTab(undefined)).toBe("open");
    expect(parseBrandBriefTab("draft")).toBe("draft");
    expect(parseBrandBriefTab(["ended"])).toBe("ended");
    expect(parseBrandBriefTab("x")).toBe("open");
  });
  it("parseBriefStep", () => {
    expect(parseBriefStep("3")).toBe(3);
    expect(parseBriefStep(["4"])).toBe(4);
    expect(parseBriefStep("5")).toBe(1);
    expect(parseBriefStep("2.0")).toBe(1);
    expect(parseBriefStep(undefined)).toBe(1);
  });
});
