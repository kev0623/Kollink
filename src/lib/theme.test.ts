import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { parseThemePref, resolveTheme, THEME_OPTIONS, THEME_SCRIPT, THEME_STORAGE_KEY } from "./theme";

type Env = { stored: string | null; systemLight: boolean; throws?: boolean };

function runScript({ stored, systemLight, throws }: Env) {
  const attrs: Record<string, string> = {};
  const style: Record<string, string> = {};
  const ctx = {
    document: { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; }, style } },
    localStorage: {
      getItem: (k: string) => {
        if (throws) throw new Error("blocked");
        return k === THEME_STORAGE_KEY ? stored : null;
      },
    },
    window: { matchMedia: (q: string) => ({ matches: q.includes("light") ? systemLight : !systemLight }) },
  };
  runInNewContext(THEME_SCRIPT, ctx);
  return { attrs, style };
}

describe("parseThemePref", () => {
  it("只認得 dark／light／system，其他一律 system", () => {
    expect(parseThemePref("dark")).toBe("dark");
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("system")).toBe("system");
    expect(parseThemePref("blue")).toBe("system");
    expect(parseThemePref(null)).toBe("system");
    expect(parseThemePref(undefined)).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("system 依系統；手動選擇優先", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("light", false)).toBe("light");
  });
});

describe("THEME_OPTIONS", () => {
  it("三個選項都有中文標籤", () => {
    expect(THEME_OPTIONS.map((o) => o.label)).toEqual(["跟隨系統", "深色", "淺色"]);
  });
});

describe("THEME_SCRIPT（繪製前執行的內嵌腳本）", () => {
  it("沒有偏好時跟隨系統", () => {
    expect(runScript({ stored: null, systemLight: true }).attrs).toEqual({ "data-theme": "light", "data-theme-pref": "system" });
    expect(runScript({ stored: null, systemLight: false }).attrs).toEqual({ "data-theme": "dark", "data-theme-pref": "system" });
  });
  it("手動偏好優先，並設定 color-scheme", () => {
    const r = runScript({ stored: "light", systemLight: false });
    expect(r.attrs["data-theme"]).toBe("light");
    expect(r.style.colorScheme).toBe("light");
  });
  it("不認得的值當成 system；localStorage 被封鎖時不丟錯", () => {
    expect(runScript({ stored: "x", systemLight: false }).attrs["data-theme-pref"]).toBe("system");
    expect(() => runScript({ stored: null, systemLight: false, throws: true })).not.toThrow();
  });
});
