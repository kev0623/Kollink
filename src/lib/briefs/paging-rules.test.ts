import { describe, expect, it } from "vitest";
import { brandBriefTabFilter } from "./query";
import {
  activeApplicantCount, APPLICANT_EMPTY_TEXT, APPLICANT_FILTERS, brandTabOf, displayStatusOf, NO_APPLICANTS, toApplicantCounts,
  type BrandBriefTab, type BriefStatus,
} from "./view";

const TODAY = "2026-11-27";
type Sample = { status: BriefStatus; deadline: string | null };

/** 依 brandBriefTabFilter 回傳的條件判斷一則招募會不會被選到（模擬資料庫的行為：eq 與 or 都要成立）。 */
function matches(tab: BrandBriefTab, b: Sample): boolean {
  const f = brandBriefTabFilter(tab, TODAY);
  if (f.status && b.status !== f.status) return false;
  if (f.or === `deadline.is.null,deadline.gte.${TODAY}`) return b.deadline === null || b.deadline >= TODAY;
  if (f.or === `status.eq.closed,and(status.eq.open,deadline.lt.${TODAY})`) {
    return b.status === "closed" || (b.status === "open" && b.deadline !== null && b.deadline < TODAY);
  }
  if (f.or) throw new Error(`測試不認得的條件：${f.or}`);
  return true;
}

describe("brandBriefTabFilter", () => {
  const samples: Sample[] = [];
  for (const status of ["draft", "open", "closed"] as const) {
    for (const deadline of [null, "2026-11-26", TODAY, "2026-11-28"]) samples.push({ status, deadline });
  }

  it("資料庫條件與畫面的分頁規則（displayStatusOf＋brandTabOf）一致：每則招募剛好屬於一個分頁", () => {
    for (const b of samples) {
      const expected = brandTabOf(displayStatusOf(b.status, b.deadline, TODAY));
      for (const tab of ["open", "draft", "ended"] as const) {
        expect(matches(tab, b), `${b.status} ${b.deadline} 在 ${tab}`).toBe(tab === expected);
      }
    }
  });
  it("截止日當天還算發佈中", () => {
    expect(matches("open", { status: "open", deadline: TODAY })).toBe(true);
    expect(matches("ended", { status: "open", deadline: TODAY })).toBe(false);
  });
  it("日期不是 YYYY-MM-DD 就丟錯，不拼進查詢", () => {
    for (const bad of ["", "today", "2026-11-27,status.eq.draft", "2026-11-27)", "2026/11/27"]) {
      expect(() => brandBriefTabFilter("open", bad)).toThrow("invalid date");
    }
  });
});

describe("報名者人數", () => {
  it("bigint 可能是字串；缺值與負數當成 0", () => {
    expect(toApplicantCounts({ all_count: "55", applied_count: 22, accepted_count: "11", rejected_count: null }))
      .toEqual({ all: 55, applied: 22, accepted: 11, rejected: 0 });
    expect(toApplicantCounts({ all_count: -1, applied_count: "x", accepted_count: null, rejected_count: 3 }))
      .toEqual({ all: 0, applied: 0, accepted: 0, rejected: 3 });
  });
  it("沒有列時全部是 0", () => {
    expect(toApplicantCounts(undefined)).toEqual(NO_APPLICANTS);
    expect(toApplicantCounts(null)).toEqual(NO_APPLICANTS);
  });
  it("「報名 N 人」只算待處理與已錄取", () => {
    expect(activeApplicantCount({ all: 55, applied: 22, accepted: 11, rejected: 11 })).toBe(33);
    expect(activeApplicantCount(NO_APPLICANTS)).toBe(0);
  });
  it("每個篩選都有空狀態的說明", () => {
    for (const f of APPLICANT_FILTERS) expect(APPLICANT_EMPTY_TEXT[f.value].length).toBeGreaterThan(3);
  });
});
