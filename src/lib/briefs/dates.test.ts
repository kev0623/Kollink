import { describe, expect, it } from "vitest";
import {
  addDays, daysBetween, deadlineLabel, formatDate, formatDateTimeTw, formatDateTw, isIsoDate, todayTw,
} from "./dates";

describe("todayTw", () => {
  it("台灣時間跨日的邊界與 SQL today_tw() 相同（UTC 16:00 是台灣隔天 00:00）", () => {
    expect(todayTw(new Date("2026-11-24T15:59:59Z"))).toBe("2026-11-24");
    expect(todayTw(new Date("2026-11-24T16:00:00Z"))).toBe("2026-11-25");
  });
  it("跨年也正確", () => {
    expect(todayTw(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
  });
});

describe("isIsoDate", () => {
  it("只接受存在的 YYYY-MM-DD", () => {
    expect(isIsoDate("2026-11-24")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-1-1")).toBe(false);
    expect(isIsoDate("")).toBe(false);
    expect(isIsoDate("2026-11-24T00:00")).toBe(false);
  });
});

describe("addDays / daysBetween", () => {
  it("跨月、跨年", () => {
    expect(addDays("2026-11-24", 90)).toBe("2027-02-22");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-11-24", -1)).toBe("2026-11-23");
    expect(daysBetween("2026-11-24", "2027-02-22")).toBe(90);
    expect(daysBetween("2026-11-24", "2026-11-23")).toBe(-1);
  });
});

describe("deadlineLabel", () => {
  it("今天截止、剩 N 天、已截止", () => {
    expect(deadlineLabel("2026-11-24", "2026-11-24")).toBe("今天截止");
    expect(deadlineLabel("2026-11-27", "2026-11-24")).toBe("剩 3 天");
    expect(deadlineLabel("2026-11-23", "2026-11-24")).toBe("已截止");
  });
});

describe("格式化", () => {
  it("日期與台灣時間", () => {
    expect(formatDate("2026-11-24")).toBe("2026/11/24");
    expect(formatDateTw("2026-11-24T16:30:00Z")).toBe("2026/11/25");
    expect(formatDateTimeTw("2026-11-24T06:05:00Z")).toBe("2026/11/24 14:05");
    expect(formatDateTimeTw("2026-11-24T16:00:00Z")).toBe("2026/11/25 00:00");
  });
});
