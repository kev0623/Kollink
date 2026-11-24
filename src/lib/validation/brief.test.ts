import { describe, expect, it } from "vitest";
import {
  EMPTY_BRIEF_INPUT, firstErrorStep, hasBadChar, parseApplicationForm, parseBriefForm, toSaveBriefArgs,
  validateApplication, validateBrief, validateBriefStep, type BriefInput,
} from "./brief";

const TODAY = "2026-11-24";
const UID = "00000000-0000-0000-0000-000000000601";
const ok: BriefInput = {
  title: "春季保養開箱", description: "說明", collabTypes: ["IG 貼文"], coverPath: `${UID}/cover-a.jpg`,
  categories: ["美妝"], minFollowers: "1000", region: "台北市", budgetMin: "5000", budgetMax: "20000",
  includesProduct: false, deadline: "2026-12-01",
};

function fd(entries: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe("hasBadChar", () => {
  it("雙向控制字元與 NUL 都不允許", () => {
    expect(hasBadChar("a‮b")).toBe(true);
    expect(hasBadChar("a\u0000b")).toBe(true);
    expect(hasBadChar("正常")).toBe(false);
  });
});

describe("parseBriefForm", () => {
  it("清理文字、數字去掉千分位、勾選框、空封面是 null", () => {
    const i = parseBriefForm(fd([
      ["title", "  春季​保養 "], ["description", "第一行\r\n第二行"], ["collabTypes", "IG 貼文"],
      ["collabTypes", " Reels "], ["coverPath", ""], ["categories", "美妝"], ["minFollowers", "1,000"],
      ["region", "台北市"], ["budgetMin", "5,000"], ["budgetMax", " 20，000 "], ["includesProduct", "on"],
      ["deadline", "2026-12-01"],
    ]));
    expect(i).toEqual({
      title: "春季保養", description: "第一行\n第二行", collabTypes: ["IG 貼文", "Reels"], coverPath: null,
      categories: ["美妝"], minFollowers: "1000", region: "台北市", budgetMin: "5000", budgetMax: "20000",
      includesProduct: true, deadline: "2026-12-01",
    });
  });
  it("缺欄位與非字串值當成空的", () => {
    const f = new FormData();
    f.append("title", new Blob(["x"]));
    expect(parseBriefForm(f)).toEqual(EMPTY_BRIEF_INPUT);
  });
  it("2000 字的說明不會被截斷", () => {
    const long = "字".repeat(2000);
    expect(parseBriefForm(fd([["description", long]])).description).toBe(long);
  });
});

describe("validateBrief", () => {
  it("完整資料可以發佈", () => expect(validateBrief(ok, "publish", TODAY)).toBeNull());
  it("草稿可以缺必填", () => expect(validateBrief(EMPTY_BRIEF_INPUT, "draft", TODAY)).toBeNull());
  it("發佈時檢查必填", () => {
    expect(validateBrief(EMPTY_BRIEF_INPUT, "publish", TODAY)).toEqual({
      title: "請填寫案名（60 字以內）", description: "請填寫合作說明", collabTypes: "請至少選一種合作形式",
      reward: "預算和產品至少要有一項", deadline: "請選擇截止日",
    });
  });
  it("草稿也檢查格式", () => {
    expect(validateBrief({ ...EMPTY_BRIEF_INPUT, title: "字".repeat(61) }, "draft", TODAY)).toEqual({ title: "案名最多 60 字" });
    expect(validateBrief({ ...EMPTY_BRIEF_INPUT, description: "字".repeat(2001) }, "draft", TODAY)).toEqual({ description: "說明最多 2000 字" });
    expect(validateBrief({ ...EMPTY_BRIEF_INPUT, title: "a\u0000" }, "draft", TODAY)).toEqual({ title: "含有不允許的特殊字元" });
    expect(validateBrief({ ...EMPTY_BRIEF_INPUT, deadline: "2026-02-30" }, "draft", TODAY)).toEqual({ deadline: "日期格式不正確" });
  });
  it("案名 60 字邊界（以 code point 計算）", () => {
    expect(validateBrief({ ...ok, title: "😀".repeat(60) }, "publish", TODAY)).toBeNull();
  });
  it("合作形式與內容領域的數量、長度、重複", () => {
    expect(validateBrief({ ...ok, collabTypes: ["a", "a"] }, "publish", TODAY)).toEqual({ collabTypes: "請重新選擇合作形式" });
    expect(validateBrief({ ...ok, collabTypes: ["字".repeat(21)] }, "publish", TODAY)).toEqual({ collabTypes: "請重新選擇合作形式" });
    expect(validateBrief({ ...ok, categories: ["a", "b", "c", "d", "e", "f"] }, "publish", TODAY)).toEqual({ categories: "最多選 5 個內容領域" });
    expect(validateBrief({ ...ok, categories: [] }, "publish", TODAY)).toBeNull();
  });
  it("清單以外的值只要格式正確就接受（白名單只在 UI 端）", () => {
    expect(validateBrief({ ...ok, collabTypes: ["開箱影片"], categories: ["園藝"], region: "火星" }, "publish", TODAY)).toBeNull();
  });
  it("封面路徑格式", () => {
    expect(validateBrief({ ...ok, coverPath: "x/cover-a.jpg" }, "publish", TODAY)).toEqual({ coverPath: "封面圖片有問題，請重新上傳" });
    expect(validateBrief({ ...ok, coverPath: `${UID}/cover-..jpg` }, "publish", TODAY)).toEqual({ coverPath: "封面圖片有問題，請重新上傳" });
    expect(validateBrief({ ...ok, coverPath: null }, "publish", TODAY)).toBeNull();
  });
  it("粉絲門檻", () => {
    expect(validateBrief({ ...ok, minFollowers: "" }, "publish", TODAY)).toBeNull();
    expect(validateBrief({ ...ok, minFollowers: "-1" }, "publish", TODAY)).toEqual({ minFollowers: "請填 0 以上的整數" });
    expect(validateBrief({ ...ok, minFollowers: "1.5" }, "publish", TODAY)).toEqual({ minFollowers: "請填 0 以上的整數" });
  });
  it("預算：範圍、上限不低於下限、只填一個可以", () => {
    expect(validateBrief({ ...ok, budgetMin: "10000001" }, "publish", TODAY)).toEqual({ budgetMin: "請填 0 到 10,000,000 的整數" });
    expect(validateBrief({ ...ok, budgetMin: "5000", budgetMax: "4000" }, "publish", TODAY)).toEqual({ budgetMax: "上限不能低於下限" });
    expect(validateBrief({ ...ok, budgetMin: "", budgetMax: "4000" }, "publish", TODAY)).toBeNull();
    expect(validateBrief({ ...ok, budgetMin: "5000", budgetMax: "" }, "publish", TODAY)).toBeNull();
    expect(validateBrief({ ...ok, budgetMin: "5000", budgetMax: "0" }, "publish", TODAY)).toBeNull();
  });
  it("預算和產品至少一項；預算 0 等於沒填", () => {
    expect(validateBrief({ ...ok, budgetMin: "0", budgetMax: "" }, "publish", TODAY)).toEqual({ reward: "預算和產品至少要有一項" });
    expect(validateBrief({ ...ok, budgetMin: "", budgetMax: "", includesProduct: true }, "publish", TODAY)).toBeNull();
  });
  it("截止日：今天到 90 天內（含兩端）", () => {
    expect(validateBrief({ ...ok, deadline: TODAY }, "publish", TODAY)).toBeNull();
    expect(validateBrief({ ...ok, deadline: "2027-02-22" }, "publish", TODAY)).toBeNull();
    expect(validateBrief({ ...ok, deadline: "2026-11-23" }, "publish", TODAY)).toEqual({ deadline: "截止日要在今天到 90 天內" });
    expect(validateBrief({ ...ok, deadline: "2027-02-23" }, "publish", TODAY)).toEqual({ deadline: "截止日要在今天到 90 天內" });
    expect(validateBrief({ ...ok, deadline: "2026-11-23" }, "draft", TODAY)).toBeNull();
  });
});

describe("validateBriefStep / firstErrorStep", () => {
  it("下一步只檢查這一步的欄位", () => {
    expect(validateBriefStep(1, { ...EMPTY_BRIEF_INPUT, title: "x", description: "y", collabTypes: ["IG 貼文"] }, TODAY)).toBeNull();
    expect(validateBriefStep(2, EMPTY_BRIEF_INPUT, TODAY)).toBeNull();
    expect(validateBriefStep(3, EMPTY_BRIEF_INPUT, TODAY)).toEqual({ reward: "預算和產品至少要有一項", deadline: "請選擇截止日" });
    expect(Object.keys(validateBriefStep(4, EMPTY_BRIEF_INPUT, TODAY) ?? {})).toContain("title");
  });
  it("跳到有錯誤的第一步", () => {
    expect(firstErrorStep({ deadline: "x", title: "y" })).toBe(1);
    expect(firstErrorStep({ region: "x" })).toBe(2);
    expect(firstErrorStep({ reward: "x" })).toBe(3);
    expect(firstErrorStep({ formError: "x" })).toBe(4);
  });
});

describe("toSaveBriefArgs", () => {
  it("轉成 save_brief 的參數（沒填的省略）", () => {
    expect(toSaveBriefArgs(null, { ...EMPTY_BRIEF_INPUT, title: "x" }, false)).toEqual({
      p_id: undefined, p_title: "x", p_description: "", p_collab_types: [], p_categories: [], p_min_followers: 0,
      p_region: "", p_budget_min_twd: undefined, p_budget_max_twd: undefined, p_includes_product: false,
      p_deadline: undefined, p_cover_path: undefined, p_publish: false,
    });
    expect(toSaveBriefArgs("id-1", ok, true)).toMatchObject({
      p_id: "id-1", p_min_followers: 1000, p_budget_min_twd: 5000, p_budget_max_twd: 20000,
      p_deadline: "2026-12-01", p_cover_path: `${UID}/cover-a.jpg`, p_publish: true,
    });
  });
});

describe("報名", () => {
  it("parseApplicationForm 清理留言與報價", () => {
    expect(parseApplicationForm(fd([["briefId", " b1 "], ["message", " 你好\r\n "], ["proposedPrice", "8,000"]])))
      .toEqual({ briefId: "b1", message: "你好", proposedPrice: "8000" });
  });
  it("validateApplication", () => {
    expect(validateApplication({ briefId: "b", message: "", proposedPrice: "" })).toBeNull();
    expect(validateApplication({ briefId: "b", message: "字".repeat(500), proposedPrice: "0" })).toBeNull();
    expect(validateApplication({ briefId: "b", message: "字".repeat(501), proposedPrice: "" })).toEqual({ message: "最多 500 字" });
    expect(validateApplication({ briefId: "b", message: "a‮", proposedPrice: "" })).toEqual({ message: "含有不允許的特殊字元" });
    expect(validateApplication({ briefId: "b", message: "", proposedPrice: "10000001" })).toEqual({ proposedPrice: "請填 0 到 10,000,000 的整數" });
  });
});
