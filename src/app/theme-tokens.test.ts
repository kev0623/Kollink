import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function block(start: string, end: string): string {
  const s = css.indexOf(start);
  const e = css.indexOf(end);
  if (s < 0 || e < 0) throw new Error(`找不到 ${start}`);
  return css.slice(s + start.length, e);
}

function vars(text: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const [, k, v] of text.matchAll(/(--color-[a-z-]+):\s*([^;]+);/g)) m.set(k, v.trim());
  return m;
}

const darkText = css.slice(css.indexOf("@theme static"), css.indexOf("/* light:start */"));
const dark = vars(darkText);
const light = vars(block("/* light:start */", "/* light:end */"));
const lightNoJs = vars(block("/* light-nojs:start */", "/* light-nojs:end */"));

describe("globals.css 的主題 token", () => {
  it("沒有 JS 的淺色與 [data-theme=light] 完全相同", () => {
    expect([...lightNoJs]).toEqual([...light]);
  });
  it("每個深色 token 都有淺色值", () => {
    expect([...light.keys()].sort()).toEqual([...dark.keys()].sort());
  });
  it("規格 §2.1 的 token 都在", () => {
    for (const k of ["bg", "panel", "surface", "subtle", "line", "line-strong", "ink", "on-ink", "muted", "primary", "primary-hover",
      "on-primary", "primary-soft", "accent", "thread", "thread-glow", "far", "success", "success-soft", "danger", "danger-soft", "focus"]) {
      expect(dark.has(`--color-${k}`), k).toBe(true);
    }
  });
  it("淺色 success 加深（QA m9）", () => {
    expect(light.get("--color-success")).toBe("#17705A");
  });
});
