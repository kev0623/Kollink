import { describe, expect, it } from "vitest";
import { LANG_SCRIPT, LANG_STORAGE_KEY, optionLabel, parseLang } from "./lang";
import { CATEGORIES, REGIONS } from "./options";

describe("parseLang", () => {
  it("只有 en 是英文，其他一律中文", () => {
    expect(parseLang("en")).toBe("en");
    for (const v of ["zh", "EN", "", null, undefined, 1]) expect(parseLang(v)).toBe("zh");
  });
});

describe("LANG_SCRIPT", () => {
  it("讀同一個 localStorage key，只在選過英文時改 <html>", () => {
    expect(LANG_SCRIPT).toContain(`"${LANG_STORAGE_KEY}"`);
    expect(LANG_SCRIPT).toContain('"data-lang","en"');
    expect(LANG_SCRIPT).toContain("try{");
  });
  it("實際執行：預設不動，存了 en 才設定；localStorage 壞掉也不丟錯", () => {
    const run = (stored: string | null, broken = false) => {
      const attrs: Record<string, string> = {};
      const documentElement = { lang: "zh-Hant", setAttribute: (k: string, v: string) => { attrs[k] = v; } };
      const localStorage = { getItem: () => { if (broken) throw new Error("blocked"); return stored; } };
      new Function("document", "localStorage", LANG_SCRIPT)({ documentElement }, localStorage);
      return { attrs, lang: documentElement.lang };
    };
    expect(run(null)).toEqual({ attrs: {}, lang: "zh-Hant" });
    expect(run("zh")).toEqual({ attrs: {}, lang: "zh-Hant" });
    expect(run("en")).toEqual({ attrs: { "data-lang": "en" }, lang: "en" });
    expect(run("en", true)).toEqual({ attrs: {}, lang: "zh-Hant" });
  });
});

describe("optionLabel", () => {
  it("每個類別與地區都有英文，而且不是中文原文", () => {
    for (const v of [...CATEGORIES, ...REGIONS]) {
      const l = optionLabel(v);
      expect(l.zh).toBe(v);
      expect(l.en).toMatch(/^[A-Za-z0-9 ]+$/);
    }
  });
  it("清單以外的值兩種語言都顯示原文", () => {
    expect(optionLabel("手作")).toEqual({ zh: "手作", en: "手作" });
  });
});
