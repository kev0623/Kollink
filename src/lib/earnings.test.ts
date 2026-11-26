import { describe, expect, it } from "vitest";
import {
  brandPaymentsRows, creatorEarningsRows, mayBeTruncated, parseBrandPaymentsView, parseCreatorEarningsView,
  sortNewestFirst, sumAmount, isTestPaymentMode, hasUncountedRows, summarizeBrandPayments, summarizeCreatorEarnings,
} from "./earnings";
import type { CollabListItem } from "@/lib/collabs/view";

let n = 0;
function item(status: string, amount: number, updatedAt = "2026-11-20T00:00:00Z"): CollabListItem {
  n += 1;
  return {
    id: `id-${String(n).padStart(3, "0")}`, title: `t${n}`, amount, status: status as CollabListItem["status"], updatedAt,
    side: "creator", counterpartName: "品牌", counterpartImagePath: null, counterpartHandle: null, myTurn: false,
  };
}

const ALL = [
  item("invited", 100), item("awaiting_payment", 200), item("awaiting_submission", 300), item("in_review", 400),
  item("awaiting_publish", 500), item("awaiting_payout", 600), item("completed", 700),
  item("declined", 800), item("cancelled", 900),
];

describe("sumAmount", () => {
  it("空陣列是 0；null／NaN／負數當 0", () => {
    expect(sumAmount([])).toBe(0);
    expect(sumAmount([{ amount: 5 }, { amount: NaN }, { amount: -3 }, { amount: null as unknown as number }])).toBe(5);
  });
});

describe("創作者收入", () => {
  it("已收到、等待撥款、進行中各自加總；未付款與已結束的不計", () => {
    expect(summarizeCreatorEarnings(ALL)).toEqual({ received: 700, awaiting: 600, inProgress: 1200 });
  });
  it("不認得的狀態（toCollabStatus 已轉成 cancelled）不計；沒有資料全是 0", () => {
    expect(summarizeCreatorEarnings([item("weird", 999)])).toEqual({ received: 0, awaiting: 0, inProgress: 0 });
    expect(summarizeCreatorEarnings([])).toEqual({ received: 0, awaiting: 0, inProgress: 0 });
  });
  it("金額 0 的合作案照常列出、加總不變", () => {
    expect(summarizeCreatorEarnings([item("completed", 0), item("completed", 50)]).received).toBe(50);
  });
  it("列表：全部含未付款但不含已取消與已婉拒；分組只含該分組", () => {
    expect(creatorEarningsRows(ALL, "all").map((i) => i.status).sort()).toEqual(
      ["awaiting_payment", "awaiting_payout", "awaiting_publish", "awaiting_submission", "completed", "in_review", "invited"].sort(),
    );
    expect(creatorEarningsRows(ALL, "received").map((i) => i.status)).toEqual(["completed"]);
    expect(creatorEarningsRows(ALL, "awaiting").map((i) => i.status)).toEqual(["awaiting_payout"]);
    expect(creatorEarningsRows(ALL, "in_progress")).toHaveLength(3);
  });
  it("?view= 解析：不認得的值、空值、陣列", () => {
    expect(parseCreatorEarningsView(undefined)).toBe("all");
    expect(parseCreatorEarningsView("zzz")).toBe("all");
    expect(parseCreatorEarningsView("")).toBe("all");
    expect(parseCreatorEarningsView("received")).toBe("received");
    expect(parseCreatorEarningsView(["awaiting", "x"])).toBe("awaiting");
    expect(parseCreatorEarningsView("in_progress")).toBe("in_progress");
    expect(parseCreatorEarningsView("paid")).toBe("all");
  });
});

describe("品牌付款紀錄", () => {
  it("已付款含交稿、審核、發佈、撥款、完成；等待付款只有 awaiting_payment", () => {
    expect(summarizeBrandPayments(ALL)).toEqual({ paid: 300 + 400 + 500 + 600 + 700, awaitingPayment: 200 });
  });
  it("邀約中、已取消、已婉拒不計", () => {
    expect(summarizeBrandPayments([item("invited", 1), item("cancelled", 2), item("declined", 3)])).toEqual({ paid: 0, awaitingPayment: 0 });
  });
  it("列表分組", () => {
    expect(brandPaymentsRows(ALL, "paid")).toHaveLength(5);
    expect(brandPaymentsRows(ALL, "awaiting_payment")).toHaveLength(1);
    expect(brandPaymentsRows(ALL, "all")).toHaveLength(6);
  });
  it("?view= 解析", () => {
    expect(parseBrandPaymentsView("paid")).toBe("paid");
    expect(parseBrandPaymentsView("awaiting_payment")).toBe("awaiting_payment");
    expect(parseBrandPaymentsView("zzz")).toBe("all");
    expect(parseBrandPaymentsView(undefined)).toBe("all");
    expect(parseBrandPaymentsView("received")).toBe("all");
  });
});

describe("排序與截斷", () => {
  it("由新到舊；壞日期排最後；不改動原陣列", () => {
    const a = item("completed", 1, "2026-11-01T00:00:00Z");
    const b = item("completed", 1, "2026-11-10T00:00:00Z");
    const c = item("completed", 1, "");
    const input = [c, a, b];
    expect(sortNewestFirst(input).map((x) => x.id)).toEqual([b.id, a.id, c.id]);
    expect(input[0]).toBe(c);
  });
  it("任何一個分頁滿 200 筆就視為可能被截斷", () => {
    expect(mayBeTruncated([199, 12])).toBe(false);
    expect(mayBeTruncated([3, 200])).toBe(true);
    expect(mayBeTruncated([])).toBe(false);
  });
});

describe("isTestPaymentMode", () => {
  it("只有啟用且為 stage 才算測試環境", () => {
    expect(isTestPaymentMode({ enabled: true, env: "stage" })).toBe(true);
    expect(isTestPaymentMode({ enabled: true, env: "prod" })).toBe(false);
    expect(isTestPaymentMode({ enabled: false, env: null })).toBe(false);
  });
});

describe("hasUncountedRows", () => {
  it("有邀約中或等待付款才為真", () => {
    expect(hasUncountedRows([item("invited", 1)])).toBe(true);
    expect(hasUncountedRows([item("awaiting_payment", 1)])).toBe(true);
    expect(hasUncountedRows([item("completed", 1), item("in_review", 1)])).toBe(false);
    expect(hasUncountedRows([])).toBe(false);
  });
});
