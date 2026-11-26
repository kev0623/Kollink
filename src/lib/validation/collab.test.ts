import { describe, expect, it } from "vitest";
import {
  acceptDefaults, cleanLongText, isValidLink, isValidPostUrl, parseAmount, parseLinks, parseOfferForm,
  validateOffer, validateRevisionNote, validateSubmission,
} from "./collab";

const C = "00000000-0000-0000-0000-0000000007d1";
const U = "00000000-0000-0000-0000-000000000731";
const F = `${C}/${U}/11111111-1111-4111-8111-111111111111.jpg`;

describe("金額", () => {
  it("去千分位、範圍 1..10,000,000", () => {
    expect(parseAmount("4,500")).toBe(4500);
    expect(parseAmount(" 10000000 ")).toBe(10_000_000);
    expect(parseAmount("10000001")).toBeNull();
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("12.5")).toBeNull();
    expect(parseAmount("-3")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
});

describe("邀請與錄取表單", () => {
  function fd(o: Record<string, string>) {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.append(k, v);
    return f;
  }
  it("解析：清理案名、交付內容換行統一", () => {
    expect(parseOfferForm(fd({ title: " 春季開箱 ", deliverables: "IG 貼文\r\n限動 2 則 ", amount: "3,000" })))
      .toEqual({ title: "春季開箱", deliverables: "IG 貼文\n限動 2 則", amount: "3,000" });
  });
  it("直接邀請要案名；錄取不檢查案名", () => {
    expect(validateOffer({ title: "", deliverables: "x", amount: "1000" }, true)).toEqual({ title: "請填寫案名" });
    expect(validateOffer({ title: "", deliverables: "x", amount: "1000" }, false)).toBeNull();
    expect(validateOffer({ title: "案".repeat(61), deliverables: "", amount: "0" }, true)).toEqual({
      title: "最多 60 字", deliverables: "請填寫交付內容", amount: "請填 1 到 10,000,000 的整數",
    });
    expect(validateOffer({ title: "x", deliverables: "字".repeat(1001), amount: "1" }, true)).toEqual({ deliverables: "最多 1000 字" });
    expect(validateOffer({ title: "a‮b", deliverables: "x\u0000", amount: "1" }, true)).toEqual({
      title: "含有不允許的特殊字元", deliverables: "含有不允許的特殊字元",
    });
  });
  it("長文字清理不會在 1000 字以內截斷", () => {
    expect([...cleanLongText("字".repeat(1001))]).toHaveLength(1001);
  });
});

describe("修改說明", () => {
  it("必填、最多 1000 字", () => {
    expect(validateRevisionNote("")).toBe("請寫下要修改的地方");
    expect(validateRevisionNote("字".repeat(1001))).toBe("最多 1000 字");
    expect(validateRevisionNote("第二張亮一點")).toBeNull();
  });
});

describe("貼文連結", () => {
  it("https、網域合法、有路徑", () => {
    expect(isValidPostUrl("https://www.instagram.com/p/abc123/")).toBe(true);
    expect(isValidPostUrl("http://www.instagram.com/p/abc123/")).toBe(false);
    expect(isValidPostUrl(`https://www.instagram.com/p/${"a".repeat(500)}`)).toBe(false);
    expect(isValidPostUrl("https://instagram.com")).toBe(false);
    expect(isValidPostUrl("https://instagram.com/")).toBe(false);
    expect(isValidPostUrl("https://a..b.com/p/1")).toBe(false);
    expect(isValidPostUrl("https://-a.com/p/1")).toBe(false);
    expect(isValidPostUrl("https://evil.com@x.com/p")).toBe(false);
    expect(isValidPostUrl("https://x.com:8443/p")).toBe(false);
    expect(isValidPostUrl("https://x.c/p")).toBe(false);
  });
});

describe("交稿", () => {
  it("連結：一行一個、清理、去空行", () => {
    expect(parseLinks(" https://a.com/1 \r\n\n https://b.com ")).toEqual(["https://a.com/1", "https://b.com"]);
    expect(isValidLink("https://drive.google.com")).toBe(true);
    expect(isValidLink(`https://a.com/${"x".repeat(490)}`)).toBe(false);
  });
  it("檔案或連結至少一個", () => {
    expect(validateSubmission({ note: "只有說明", links: [], filePaths: [] }, C, U)).toEqual({ files: "請上傳檔案或附上連結" });
    expect(validateSubmission({ note: "", links: [], filePaths: [F] }, C, U)).toBeNull();
    expect(validateSubmission({ note: "", links: ["https://a.com/x"], filePaths: [] }, C, U)).toBeNull();
  });
  it("格式錯誤", () => {
    expect(validateSubmission({ note: "字".repeat(1001), links: ["http://a.com"], filePaths: [F, F] }, C, U)).toEqual({
      note: "最多 1000 字", links: "連結必須是 https:// 開頭的完整網址", files: "檔案資料不正確，請重新上傳",
    });
    expect(validateSubmission({ note: "", links: Array(6).fill("https://a.com"), filePaths: [] }, C, U)).toEqual({ links: "最多 5 個連結" });
    expect(validateSubmission({ note: "", links: [], filePaths: [`${C}/other/x.jpg`] }, C, U)).toEqual({ files: "檔案資料不正確，請重新上傳" });
    expect(validateSubmission({ note: "", links: [], filePaths: Array(11).fill(F) }, C, U)).toEqual({ files: "一次最多 10 個檔案" });
  });
});

describe("錄取預設值", () => {
  const brief = { budgetMin: 3000, budgetMax: 8000, collabTypes: ["IG 貼文", "限時動態"], description: "  冬季保養開箱  " };
  it("金額：報價 → 預算上限 → 下限 → 空白", () => {
    expect(acceptDefaults(6000, brief).amount).toBe("6000");
    expect(acceptDefaults(null, brief).amount).toBe("8000");
    expect(acceptDefaults(0, { ...brief, budgetMax: null }).amount).toBe("3000");
    expect(acceptDefaults(null, { ...brief, budgetMin: null, budgetMax: null }).amount).toBe("");
  });
  it("交付內容：合作形式 + 說明摘要", () => {
    expect(acceptDefaults(null, brief).deliverables).toBe("IG 貼文、限時動態\n冬季保養開箱");
    const long = acceptDefaults(null, { ...brief, description: "字".repeat(300) }).deliverables;
    expect(long).toBe(`IG 貼文、限時動態\n${"字".repeat(200)}…`);
  });
});
