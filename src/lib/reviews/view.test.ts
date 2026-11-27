import { describe, expect, it } from "vitest";
import {
  adminReviewState, formatRating, isRating, isReviewStale, NO_REVIEW_STATS, reviewErrorMessage, statsByUser, statsSummary,
  theirReviewHint, toAdminReviews, toCollabReviews, toPublicReviews, toReviewStats, validateReviewComment,
  REVIEW_COMMENT_MAX, type CollabReviewsRow,
} from "./view";

const CLOSES = "2026-12-15T04:00:00Z";
const BEFORE = Date.parse("2026-12-05T00:00:00Z");
const AFTER = Date.parse("2026-12-16T00:00:00Z");

function row(over: Partial<CollabReviewsRow> = {}): CollabReviewsRow {
  return {
    closes_at: CLOSES, can_review: true, my_rating: null, my_comment: null, my_created_at: null, my_hidden: null,
    their_submitted: false, their_published: false, their_rating: null, their_comment: null, their_created_at: null, ...over,
  };
}

describe("isRating", () => {
  it("只接受 1–5 的整數", () => {
    expect([1, 3, 5].every(isRating)).toBe(true);
    expect([0, 6, 2.5, "3", null, undefined, Number.NaN].some(isRating)).toBe(false);
  });
});

describe("validateReviewComment", () => {
  it("空字串與一般文字可以", () => {
    expect(validateReviewComment("")).toBeNull();
    expect(validateReviewComment("準時交稿，溝通順利")).toBeNull();
    expect(validateReviewComment("好".repeat(REVIEW_COMMENT_MAX))).toBeNull();
  });
  it("超過字數、特殊字元、聯絡方式都擋", () => {
    expect(validateReviewComment("好".repeat(REVIEW_COMMENT_MAX + 1))).toContain("500");
    expect(validateReviewComment("很好‮")).toContain("特殊字元");
    expect(validateReviewComment("找我 someone@example.com")).toContain("公開");
    expect(validateReviewComment("加我賴 abc123")).toContain("公開");
    expect(validateReviewComment("0912-345-678")).toContain("公開");
  });
});

describe("toCollabReviews", () => {
  it("還沒有人寫", () => {
    expect(toCollabReviews(row())).toEqual({ closesAt: CLOSES, canReview: true, mine: null, theirSubmitted: false, theirs: null });
  });
  it("自己寫了、對方的已公開", () => {
    const r = toCollabReviews(row({
      can_review: false, my_rating: 4, my_comment: "好", my_created_at: "2026-12-02T00:00:00Z", my_hidden: false,
      their_submitted: true, their_published: true, their_rating: 5, their_comment: null, their_created_at: "2026-12-03T00:00:00Z",
    }));
    expect(r.mine).toEqual({ rating: 4, comment: "好", createdAt: "2026-12-02T00:00:00Z", hidden: false });
    expect(r.theirs).toEqual({ rating: 5, comment: null, createdAt: "2026-12-03T00:00:00Z" });
  });
  it("對方寫了但沒公開：不帶內容（就算資料列誤帶了星數）", () => {
    const r = toCollabReviews(row({ their_submitted: true, their_published: false, their_rating: 1 }));
    expect(r.theirSubmitted).toBe(true);
    expect(r.theirs).toBeNull();
  });
  it("欄位是 null 時退回安全的預設", () => {
    const r = toCollabReviews(row({ closes_at: null, can_review: null, their_submitted: null }));
    expect(r).toEqual({ closesAt: "", canReview: false, mine: null, theirSubmitted: false, theirs: null });
  });
});

describe("theirReviewHint", () => {
  const mine = { my_rating: 4, my_created_at: "2026-12-02T00:00:00Z", can_review: false };
  it("看得到內容時沒有說明", () => {
    expect(theirReviewHint(toCollabReviews(row({ ...mine, their_submitted: true, their_published: true, their_rating: 5 })), "品牌", BEFORE)).toBeNull();
  });
  it("對方寫了、自己還沒寫：請自己先送出", () => {
    expect(theirReviewHint(toCollabReviews(row({ their_submitted: true })), "品牌", BEFORE)).toBe("品牌已經寫好評價，你送出後就能看到");
  });
  it("對方寫了、自己也寫了卻看不到：被隱藏", () => {
    expect(theirReviewHint(toCollabReviews(row({ ...mine, their_submitted: true })), "品牌", BEFORE)).toBe("品牌的評價目前沒有公開");
  });
  it("對方寫了、自己沒寫、期限已過：沒有公開", () => {
    expect(theirReviewHint(toCollabReviews(row({ can_review: false, their_submitted: true })), "品牌", AFTER)).toBe("品牌的評價目前沒有公開");
  });
  it("對方還沒寫：依自己寫了沒與期限", () => {
    expect(theirReviewHint(toCollabReviews(row()), "小美", BEFORE)).toBe("小美還沒寫");
    expect(theirReviewHint(toCollabReviews(row(mine)), "小美", BEFORE)).toBe("小美還沒寫。對方送出後，或 2026/12/15 之後，你的評價才會公開");
    expect(theirReviewHint(toCollabReviews(row(mine)), "小美", AFTER)).toBe("小美沒有留下評價");
  });
  it("期限格式壞掉當成已過期", () => {
    expect(theirReviewHint(toCollabReviews(row({ closes_at: "x" })), "小美", BEFORE)).toBe("小美沒有留下評價");
  });
});

describe("統計", () => {
  it("toReviewStats：numeric 可能是字串；沒有評價時平均是 null", () => {
    expect(toReviewStats({ user_id: "u", avg_rating: "4.8", review_count: 12, completed_count: 15 })).toEqual({ avg: 4.8, count: 12, completed: 15 });
    expect(toReviewStats({ user_id: "u", avg_rating: null, review_count: 0, completed_count: 2 })).toEqual({ avg: null, count: 0, completed: 2 });
    expect(toReviewStats({ user_id: "u", avg_rating: 5, review_count: 0, completed_count: null })).toEqual({ avg: null, count: 0, completed: 0 });
    expect(toReviewStats(undefined)).toBe(NO_REVIEW_STATS);
  });
  it("statsByUser 略過沒有 user_id 的列", () => {
    const m = statsByUser([
      { user_id: "a", avg_rating: 4, review_count: 1, completed_count: 1 },
      { user_id: null, avg_rating: 5, review_count: 1, completed_count: 1 },
    ]);
    expect([...m.keys()]).toEqual(["a"]);
  });
  it("formatRating 固定一位小數", () => {
    expect(formatRating(4)).toBe("4.0");
    expect(formatRating(4.75)).toBe("4.8");
  });
  it("statsSummary", () => {
    expect(statsSummary({ avg: 4.8, count: 12, completed: 15 }, "尚無評價")).toBe("4.8（12 則評價）・完成 15 案");
    expect(statsSummary({ avg: null, count: 0, completed: 3 }, "尚無評價")).toBe("尚無評價・完成 3 案");
    expect(statsSummary(NO_REVIEW_STATS, "新創作者・尚無評價")).toBe("新創作者・尚無評價");
  });
});

describe("列表轉換", () => {
  it("toPublicReviews 略過壞資料、品牌名稱缺的補「品牌」", () => {
    expect(toPublicReviews([
      { id: "r1", rating: 5, comment: "好", created_at: "2026-12-01T00:00:00Z", brand_name: null, brand_logo_path: null },
      { id: null, rating: 5, comment: null, created_at: null, brand_name: "x", brand_logo_path: null },
      { id: "r3", rating: 9, comment: null, created_at: null, brand_name: "x", brand_logo_path: null },
    ])).toEqual([{ id: "r1", rating: 5, comment: "好", createdAt: "2026-12-01T00:00:00Z", brandName: "品牌", brandLogoPath: null }]);
  });
  it("toAdminReviews 與狀態文字", () => {
    const [a, b, c] = toAdminReviews([
      { id: "1", author_side: "brand", rating: 4, comment: null, created_at: "", visible_from: "2026-12-01T00:00:00Z", hidden_at: null },
      { id: "2", author_side: "creator", rating: 2, comment: "x", created_at: "", visible_from: "2026-12-20T00:00:00Z", hidden_at: null },
      { id: "3", author_side: "brand", rating: 1, comment: null, created_at: "", visible_from: "2026-12-01T00:00:00Z", hidden_at: "2026-12-02T00:00:00Z" },
      { id: "4", author_side: "admin", rating: 1, comment: null, created_at: "", visible_from: "", hidden_at: null },
    ]);
    expect(adminReviewState(a, BEFORE)).toBe("已公開");
    expect(adminReviewState(b, BEFORE)).toBe("尚未公開");
    expect(adminReviewState(c, BEFORE)).toBe("已隱藏");
    expect(toAdminReviews([{ id: "4", author_side: "admin", rating: 1, comment: null, created_at: "", visible_from: "", hidden_at: null }])).toEqual([]);
  });
});

describe("錯誤訊息", () => {
  it("已知的錯誤有中文，其他是通用訊息", () => {
    expect(reviewErrorMessage({ message: "review window closed" })).toContain("14");
    expect(reviewErrorMessage({ message: "comment has contact info" })).toContain("公開");
    expect(reviewErrorMessage({ message: "constructor" })).toBe("發生錯誤，請稍後再試");
    expect(reviewErrorMessage({})).toBe("發生錯誤，請稍後再試");
  });
  it("只有已經寫過算狀態過期", () => {
    expect(isReviewStale({ message: "already reviewed" })).toBe(true);
    expect(isReviewStale({ message: "review window closed" })).toBe(false);
  });
});
