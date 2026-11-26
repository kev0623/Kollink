import { describe, expect, it } from "vitest";
import {
  ADMIN_MAX_PAGE, adminHref, offsetOf, pageCount, parseCollabFilter, parseCreatorFilter, parseMessageFilter,
  parseMoneyTab, parsePage, parseQuery,
} from "./query";

describe("parsePage", () => {
  it("正整數照用；其他一律 1；超過上限用上限", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2", "9"])).toBe(2);
    for (const v of [undefined, "", "0", "-1", "1.5", "abc", "1e3", " 2"]) expect(parsePage(v)).toBe(1);
    expect(parsePage("99999")).toBe(ADMIN_MAX_PAGE);
    expect(parsePage("99999999")).toBe(1);
  });
});

describe("parseQuery", () => {
  it("去頭尾空白、最多 50 字（emoji 算一個字）", () => {
    expect(parseQuery("  mei ")).toBe("mei");
    expect(parseQuery(undefined)).toBe("");
    expect(parseQuery("😀".repeat(60))).toBe("😀".repeat(50));
  });
});

describe("篩選參數容忍不認得的值", () => {
  it("創作者：預設待審核", () => {
    expect(parseCreatorFilter("rejected")).toBe("rejected");
    expect(parseCreatorFilter("bogus")).toBe("pending");
    expect(parseCreatorFilter(undefined)).toBe("pending");
  });
  it("合作案：預設進行中，接受任一狀態", () => {
    expect(parseCollabFilter("awaiting_payout")).toBe("awaiting_payout");
    expect(parseCollabFilter("all")).toBe("all");
    expect(parseCollabFilter("toString")).toBe("active");
  });
  it("款項與訊息", () => {
    expect(parseMoneyTab("anomalies")).toBe("anomalies");
    expect(parseMoneyTab("x")).toBe("payouts");
    expect(parseMessageFilter("reviewed")).toBe("reviewed");
    expect(parseMessageFilter(["x"])).toBe("open");
  });
});

describe("分頁", () => {
  it("offset 與總頁數", () => {
    expect(offsetOf(1)).toBe(0);
    expect(offsetOf(3)).toBe(100);
    expect(pageCount(0)).toBe(1);
    expect(pageCount(50)).toBe(1);
    expect(pageCount(51)).toBe(2);
  });
});

describe("adminHref", () => {
  it("省略空值、第 1 頁與預設值", () => {
    expect(adminHref("/admin/creators", { status: "pending", q: "", page: 1 }, { status: "pending" })).toBe("/admin/creators");
    expect(adminHref("/admin/creators", { status: "all", q: "mei a", page: 2 }, { status: "pending" }))
      .toBe("/admin/creators?status=all&q=mei+a&page=2");
    expect(adminHref("/admin/payments", { view: "anomalies", state: null })).toBe("/admin/payments?view=anomalies");
  });
});
