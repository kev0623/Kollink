import { describe, expect, it } from "vitest";
import {
  MAX_RAW_LENGTH, cleanText, cleanTextWithin, hasBidi, normalizeIgUsername, suggestHandle, validateBrandInput, validateCreatorInput,
  type CreatorInput,
} from "./onboarding";

const okCreator: CreatorInput = {
  displayName: "小美", handle: "mei.daily", igUsername: "mei.daily",
  followerCount: "12000", region: "台北市", categories: ["美妝", "穿搭"],
};

describe("cleanText / IG / handle", () => {
  it("去掉前後半形與全形空白", () => expect(cleanText("\u3000 小美 \u3000")).toBe("小美"));
  it("去掉前後的 NBSP", () => expect(cleanText("\u00a0小美\u00a0")).toBe("小美"));
  it("只有零寬空白、BOM、NBSP 視為空字串", () => {
    expect(cleanText("\u200b\u200c\u200d")).toBe("");
    expect(cleanText("\ufeff")).toBe("");
    expect(cleanText("\u00a0\u2060\u3000")).toBe("");
  });
  it("emoji ZWJ 序列與內部 ZWNJ 原樣保留，前後的 ZWJ/ZWNJ 仍去除", () => {
    expect(cleanText("👩\u200d💻")).toBe("👩\u200d💻");
    expect(cleanText("می\u200cخواهم")).toBe("می\u200cخواهم");
    expect(cleanText("\u200d👩\u200d💻\u200c")).toBe("👩\u200d💻");
  });
  it("中間的 U+200B、U+2060、U+FEFF 一律移除", () => {
    expect(cleanText("小\u200b美")).toBe("小美");
    expect(cleanText("美\u2060妝\ufeff")).toBe("美妝");
  });
  it("擴大後的看不見字元只有它們時視為空字串", () => {
    expect(cleanText("\u3164")).toBe("");
    expect(cleanText("\u2800\uffa0\ufe0f\u00ad\u0085")).toBe("");
    expect(cleanText("\u034f\u061c\u115f\u1160\u180e\u200e\u200f\u2061\u2064")).toBe("");
    expect(cleanText("\u3164小美\u3164")).toBe("小美");
  });
  it("雙向控制字元不會被 cleanText 吃掉（由驗證報錯）", () => {
    expect(hasBidi(cleanText("小\u202e美"))).toBe(true);
    expect(hasBidi("小美\u2066")).toBe(true);
    expect(hasBidi("小美")).toBe(false);
  });
  it("超長輸入以線性時間處理", () => {
    for (const filler of [" ", "\u200d"]) {
      const input = "a" + filler.repeat(200_000) + "b";
      const t0 = performance.now();
      cleanText(input);
      expect(performance.now() - t0).toBeLessThan(100);
    }
  });
  it("超長欄位仍得到一般的長度錯誤", () => {
    const long = " ".repeat(MAX_RAW_LENGTH + 5) + "小美";
    expect(validateCreatorInput({ ...okCreator, displayName: long })?.displayName).toBe("請填寫顯示名稱（40 字以內）");
    expect(validateBrandInput({ brandName: long, industry: "美妝保養", logoPath: null })?.brandName)
      .toBe("請填寫品牌名稱（60 字以內）");
  });
  it("IG 帳號去掉開頭的 @", () => expect(normalizeIgUsername(" @Mei.Daily ")).toBe("Mei.Daily"));
  it("由 IG 帳號建議 handle", () => {
    expect(suggestHandle("@Mei.Daily")).toBe("mei.daily");
    expect(suggestHandle("a-b c")).toBe("abc");
  });
});

describe("validateBrandInput", () => {
  it("正確資料", () => expect(validateBrandInput({ brandName: "花粉選物", industry: "美妝保養", logoPath: null })).toBeNull());
  it("名稱空白或超過 60 字", () => {
    expect(validateBrandInput({ brandName: "\u3000", industry: "美妝保養", logoPath: null })?.brandName).toBeTruthy();
    expect(validateBrandInput({ brandName: "長".repeat(61), industry: "美妝保養", logoPath: null })?.brandName).toBeTruthy();
    expect(validateBrandInput({ brandName: "長".repeat(60), industry: "美妝保養", logoPath: null })).toBeNull();
  });
  it("沒選產業", () => expect(validateBrandInput({ brandName: "x", industry: "", logoPath: null })?.industry).toBeTruthy());
  it("名稱含雙向控制字元", () => {
    expect(validateBrandInput({ brandName: "花\u202e粉", industry: "美妝保養", logoPath: null })?.brandName)
      .toBe("含有不允許的特殊字元");
  });
});

describe("validateCreatorInput", () => {
  it("正確資料", () => expect(validateCreatorInput(okCreator)).toBeNull());
  it("顯示名稱、地區、內容領域含雙向控制字元", () => {
    expect(validateCreatorInput({ ...okCreator, displayName: "小\u202e美" })?.displayName).toBe("含有不允許的特殊字元");
    expect(validateCreatorInput({ ...okCreator, region: "台\u2067北" })?.region).toBe("含有不允許的特殊字元");
    expect(validateCreatorInput({ ...okCreator, categories: ["美\u202a妝"] })?.categories).toBe("含有不允許的特殊字元");
  });
  it("內部零寬字元被移除後的重複內容領域", () => {
    expect(validateCreatorInput({ ...okCreator, categories: ["美妝", "美\u200b妝"] })?.categories).toBeTruthy();
  });
  it("顯示名稱 40 字邊界", () => {
    expect(validateCreatorInput({ ...okCreator, displayName: "長".repeat(40) })).toBeNull();
    expect(validateCreatorInput({ ...okCreator, displayName: "長".repeat(41) })?.displayName).toBeTruthy();
  });
  it.each(["ab", "Mei", "a b c", "a".repeat(31)])("handle %s 不合法", (h) => {
    expect(validateCreatorInput({ ...okCreator, handle: h })?.handle).toBeTruthy();
  });
  it("IG 帳號格式", () => {
    expect(validateCreatorInput({ ...okCreator, igUsername: "@mei" })).toBeNull();
    expect(validateCreatorInput({ ...okCreator, igUsername: "mei ig" })?.igUsername).toBeTruthy();
  });
  it.each(["", "-1", "1.5", "abc", "1234567890"])("粉絲數 %s 不合法", (n) => {
    expect(validateCreatorInput({ ...okCreator, followerCount: n })?.followerCount).toBeTruthy();
  });
  it("地區必填", () => expect(validateCreatorInput({ ...okCreator, region: "" })?.region).toBeTruthy());
  it("內容領域 1–5 個且不重複", () => {
    expect(validateCreatorInput({ ...okCreator, categories: [] })?.categories).toBeTruthy();
    expect(validateCreatorInput({ ...okCreator, categories: ["a", "b", "c", "d", "e", "f"] })?.categories).toBeTruthy();
    expect(validateCreatorInput({ ...okCreator, categories: ["美妝", " 美妝"] })?.categories).toBeTruthy();
    expect(validateCreatorInput({ ...okCreator, categories: ["長".repeat(21)] })?.categories).toBeTruthy();
  });
});

describe("cleanTextWithin", () => {
  it("與 cleanText 相同的清理，但截斷長度可以指定", () => {
    expect(cleanTextWithin("  小美​ ", 10)).toBe("小美");
    const long = "字".repeat(1500);
    expect(cleanText(long)).toHaveLength(MAX_RAW_LENGTH);
    expect(cleanTextWithin(long, 8000)).toBe(long);
    expect(cleanTextWithin("x".repeat(9000), 8000)).toHaveLength(8000);
  });
  it("cleanText 可以直接當 map 的 callback（不會把索引當成截斷長度）", () => {
    expect(["  a ", " b"].map(cleanText)).toEqual(["a", "b"]);
  });
});
