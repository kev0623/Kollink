import { describe, expect, it } from "vitest";
import { EMPTY_BRIEF_INPUT } from "@/lib/validation/brief";
import {
  appendUniqueById, audienceLabel, brandTabOf, briefToInput, displayStatusOf, filterApplicants, matchItems,
  deadlineText, previewFromInput, proposedPriceLabel, rewardLabel, toApplicant, toApplicationStatus, toBrief, toBriefStatus,
  toMyApplications, toOpportunityDetail, toOpportunityPage, withCounts,
  type ApplicantRow, type BriefRow, type OpportunityDetailRow, type OpportunityRow,
} from "./view";

const briefRow: BriefRow = {
  id: "b1", brand_id: "u1", title: null, description: null, collab_types: null, categories: null, min_followers: null,
  region: null, budget_min_twd: null, budget_max_twd: null, includes_product: null, deadline: null, cover_path: null,
  status: "draft", published_at: null, created_at: "2026-11-24T00:00:00Z",
};
const oppRow: OpportunityRow = {
  id: "o1", title: "春季", collab_types: ["IG 貼文"], categories: ["美妝"], min_followers: 1000, region: "台北市",
  budget_min_twd: 5000, budget_max_twd: null, includes_product: false, deadline: "2026-12-01", cover_path: null,
  brand_name: "品牌甲", brand_logo_path: null, applicant_count: "3", followers_ok: true, region_ok: null,
  category_ok: true, collab_ok: true, is_match: null, my_status: null, total_count: "41",
};

describe("狀態", () => {
  it("不認得的狀態取最保守的值", () => {
    expect(toBriefStatus("open")).toBe("open");
    expect(toBriefStatus("weird")).toBe("closed");
    expect(toApplicationStatus("accepted")).toBe("accepted");
    expect(toApplicationStatus(null)).toBe("withdrawn");
  });
  it("open 但截止日已過顯示已截止；截止日當天仍是發佈中", () => {
    expect(displayStatusOf("open", "2026-11-23", "2026-11-24")).toBe("expired");
    expect(displayStatusOf("open", "2026-11-24", "2026-11-24")).toBe("open");
    expect(displayStatusOf("draft", "2026-01-01", "2026-11-24")).toBe("draft");
    expect(displayStatusOf("closed", "2027-01-01", "2026-11-24")).toBe("closed");
  });
  it("品牌列表的分頁", () => {
    expect(brandTabOf("open")).toBe("open");
    expect(brandTabOf("draft")).toBe("draft");
    expect(brandTabOf("expired")).toBe("ended");
    expect(brandTabOf("closed")).toBe("ended");
  });
});

describe("rewardLabel", () => {
  const r = (budgetMin: number | null, budgetMax: number | null, includesProduct = false) => rewardLabel({ budgetMin, budgetMax, includesProduct });
  it("spec 的五種寫法", () => {
    expect(r(5000, 20000)).toBe("NT$5,000–20,000");
    expect(r(5000, null)).toBe("NT$5,000 起");
    expect(r(null, 20000)).toBe("最高 NT$20,000");
    expect(r(3000, null, true)).toBe("產品互惠 + NT$3,000 起");
    expect(r(null, null, true)).toBe("產品互惠");
  });
  it("上下限相同、0 當成沒填、都沒有", () => {
    expect(r(5000, 5000)).toBe("NT$5,000");
    expect(r(0, 20000)).toBe("最高 NT$20,000");
    expect(r(null, null)).toBe("—");
  });
});

describe("條件", () => {
  it("audienceLabel", () => {
    expect(audienceLabel(0)).toBe("粉絲數不限");
    expect(audienceLabel(12000)).toBe("粉絲 12,000 以上");
  });
  it("matchItems 四項依序", () => {
    expect(matchItems({
      minFollowers: 0, region: null, categories: [], collabTypes: ["IG 貼文", "Reels"],
      match: { followers: true, region: true, category: false, collab: true },
    })).toEqual([
      { label: "粉絲數不限", ok: true },
      { label: "地區不限", ok: true },
      { label: "內容領域不限", ok: false },
      { label: "合作形式：IG 貼文、Reels", ok: true },
    ]);
  });
});

describe("品牌端轉換", () => {
  it("toBrief 容忍 null", () => {
    expect(toBrief(briefRow)).toMatchObject({
      title: "", description: "", collabTypes: [], categories: [], minFollowers: 0, includesProduct: false, status: "draft",
    });
  });
  it("withCounts：沒有人數的是 0", () => {
    const b = toBrief(briefRow);
    expect(withCounts([b], [{ brief_id: "b1", applicant_count: "4", pending_count: 2 }])[0]).toMatchObject({ applicantCount: 4, pendingCount: 2 });
    expect(withCounts([b], [])[0]).toMatchObject({ applicantCount: 0, pendingCount: 0 });
  });
  it("briefToInput 與 previewFromInput", () => {
    const b = toBrief({ ...briefRow, title: "x", min_followers: 1000, budget_min_twd: 5000, deadline: "2026-12-01" });
    expect(briefToInput(b)).toEqual({
      ...EMPTY_BRIEF_INPUT, title: "x", minFollowers: "1000", budgetMin: "5000", deadline: "2026-12-01",
    });
    expect(previewFromInput({ ...EMPTY_BRIEF_INPUT, budgetMin: "abc", minFollowers: "1000" }, { name: "品牌甲", logoPath: null }))
      .toMatchObject({ title: "（未填案名）", budgetMin: null, minFollowers: 1000, brandName: "品牌甲", applicantCount: null });
  });
});

describe("機會", () => {
  it("toOpportunityPage：null 當 false、字串數字轉成數字、hasMore", () => {
    const page = toOpportunityPage([oppRow], 20);
    expect(page.total).toBe(41);
    expect(page.hasMore).toBe(true);
    expect(page.items[0]).toMatchObject({
      applicantCount: 3, isMatch: false, match: { followers: true, region: false, category: true, collab: true }, myStatus: null,
    });
    expect(toOpportunityPage([oppRow], 40).hasMore).toBe(false);
    expect(toOpportunityPage([], 0)).toEqual({ items: [], total: 0, hasMore: false });
  });
  it("appendUniqueById", () => {
    expect(appendUniqueById([{ id: "a" }], [{ id: "a" }, { id: "b" }, { id: "b" }])).toEqual([{ id: "a" }, { id: "b" }]);
  });
  it("toOpportunityDetail 帶出自己的報名", () => {
    const row: OpportunityDetailRow = {
      ...oppRow, description: null, status: "open", my_application_id: "a1", my_status: "applied",
      my_message: null, my_proposed_price_twd: 8000,
    };
    expect(toOpportunityDetail(row)).toMatchObject({
      description: "", status: "open", myStatus: "applied",
      application: { id: "a1", status: "applied", message: null, proposedPrice: 8000 },
    });
    expect(toOpportunityDetail({ ...row, my_application_id: null, my_status: null }).application).toBeNull();
  });
  it("toMyApplications 略過讀不到招募的", () => {
    expect(toMyApplications([
      { id: "a1", status: "accepted", created_at: "t", briefs: {
        id: "b1", title: "x", deadline: "2026-12-01", status: "closed", budget_min_twd: null, budget_max_twd: 3000,
        includes_product: null, brand_profiles: { brand_name: "品牌甲" },
      } },
      { id: "a2", status: "applied", created_at: "t", briefs: null },
    ])).toEqual([{
      id: "a1", status: "accepted", createdAt: "t",
      brief: { id: "b1", title: "x", deadline: "2026-12-01", status: "closed", brandName: "品牌甲", budgetMin: null, budgetMax: 3000, includesProduct: false },
    }]);
  });
});

describe("報名者", () => {
  const row: ApplicantRow = {
    id: "a1", creator_id: "c1", handle: "mei", display_name: "小美", avatar_path: null, follower_count: null,
    engagement_rate: "3.50", region: null, message: null, proposed_price_twd: null, status: "rejected", created_at: "t",
  };
  it("toApplicant 與篩選", () => {
    const a = toApplicant(row);
    expect(a).toMatchObject({ followerCount: 0, engagementRate: 3.5, status: "rejected" });
    expect(filterApplicants([a], "all")).toHaveLength(1);
    expect(filterApplicants([a], "applied")).toHaveLength(0);
    expect(filterApplicants([a], "rejected")).toHaveLength(1);
  });
  it("沒有提出報價顯示「依招募預算」", () => {
    expect(proposedPriceLabel(null)).toBe("依招募預算");
    expect(proposedPriceLabel(0)).toBe("NT$0");
  });
});

describe("deadlineText（倒數標籤只在發佈中顯示）", () => {
  const today = "2026-11-24";
  const cases: [string, string][] = [["past", "2026-11-20"], ["today", "2026-11-24"], ["future", "2026-11-27"]];
  it("open：過去、今天、未來都附標籤", () => {
    expect(deadlineText("open", "2026-11-20", today)).toBe("2026/11/20（已截止）");
    expect(deadlineText("open", "2026-11-24", today)).toBe("2026/11/24（今天截止）");
    expect(deadlineText("open", "2026-11-27", today)).toBe("2026/11/27（剩 3 天）");
  });
  it.each(["draft", "closed"] as const)("%s：任何日期都只顯示日期", (st) => {
    for (const [, d] of cases) expect(deadlineText(st, d, today)).toBe(d.replaceAll("-", "/"));
  });
});
