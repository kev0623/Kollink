import { describe, expect, it } from "vitest";
import { normalizePointer, readPalette, shouldLoadScene } from "./palette";

const style = (m: Record<string, string>) => ({ getPropertyValue: (n: string) => m[n] ?? "" });

describe("readPalette", () => {
  it("讀 CSS 變數（容許空白），knot 與 thread 同色", () => {
    const p = readPalette(style({ "--color-bg": " #F3F5F9", "--color-thread": "#D2342B", "--color-thread-glow": "#E8584E", "--color-far": "#C9D1E0" }), "light");
    expect(p).toEqual({ bg: "#F3F5F9", thread: "#D2342B", glow: "#E8584E", knot: "#D2342B", far: "#C9D1E0", light: true });
  });
  it("讀不到或格式不對時用深色預設值", () => {
    const p = readPalette(style({ "--color-thread": "red" }), null);
    expect(p.thread).toBe("#F0483E");
    expect(p.bg).toBe("#0D1424");
    expect(p.light).toBe(false);
  });
  it("沒有 data-theme 時以底色亮度判斷深淺；有 data-theme 時以它為準", () => {
    expect(readPalette(style({ "--color-bg": "#F3F5F9" }), null).light).toBe(true);
    expect(readPalette(style({ "--color-bg": "#F3F5F9" }), "dark").light).toBe(false);
    expect(readPalette(style({ "--color-bg": "#0D1424" }), "light").light).toBe(true);
  });
});

describe("shouldLoadScene", () => {
  const ok = { reducedMotion: false, saveData: false };
  it("reduced motion 或省流量時不載入", () => {
    expect(shouldLoadScene(ok)).toBe(true);
    expect(shouldLoadScene({ ...ok, reducedMotion: true })).toBe(false);
    expect(shouldLoadScene({ ...ok, saveData: true })).toBe(false);
  });
  it("低階裝置（≤ 2 核或記憶體 < 2GB）不載入；讀不到時照常載入", () => {
    expect(shouldLoadScene({ ...ok, cores: 2 })).toBe(false);
    expect(shouldLoadScene({ ...ok, memory: 1 })).toBe(false);
    expect(shouldLoadScene({ ...ok, cores: 8, memory: 8 })).toBe(true);
    expect(shouldLoadScene({ ...ok, cores: 0, memory: undefined })).toBe(true);
  });
});

describe("normalizePointer", () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };
  it("中心是 (0,0)，上方是 +1", () => {
    expect(normalizePointer(200, 100, rect)).toEqual([0, 0]);
    expect(normalizePointer(100, 50, rect)).toEqual([-1, 1]);
  });
  it("在 canvas 外或尺寸為 0 時是 null", () => {
    expect(normalizePointer(99, 100, rect)).toBeNull();
    expect(normalizePointer(0, 0, { left: 0, top: 0, width: 0, height: 0 })).toBeNull();
  });
});
