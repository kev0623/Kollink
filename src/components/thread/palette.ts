import type { ThreadPalette } from "./thread-scene";

type StyleLike = { getPropertyValue(name: string): string };

// 讀不到變數時（理論上不會）用規格 §2.1 的深色值
const FALLBACK = { bg: "#0D1424", thread: "#F0483E", glow: "#FF6B5E", far: "#2A3654" };

function pick(style: StyleLike, name: string, fallback: string): string {
  const v = style.getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}

/** #RRGGBB 的相對亮度（0..1，近似值，只用來分辨深淺底）。 */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

/**
 * 從 <html> 的計算樣式讀場景顏色；theme 是 data-theme 的值。
 * 沒有 data-theme 時（理論上主題腳本一定會設）以底色亮度判斷深淺，避免在淺底用加法混合。
 */
export function readPalette(style: StyleLike, theme: string | null): ThreadPalette {
  const thread = pick(style, "--color-thread", FALLBACK.thread);
  const bg = pick(style, "--color-bg", FALLBACK.bg);
  return {
    bg,
    thread,
    glow: pick(style, "--color-thread-glow", FALLBACK.glow),
    knot: thread,
    far: pick(style, "--color-far", FALLBACK.far),
    light: theme === "light" || (theme !== "dark" && luminance(bg) > 0.5),
  };
}

export type SceneEnv = {
  reducedMotion: boolean;
  saveData: boolean;
  /** navigator.hardwareConcurrency（不支援時 undefined） */
  cores?: number;
  /** navigator.deviceMemory，GB（只有 Chromium 有） */
  memory?: number;
};

/** 規格 §6.3：reduced motion、省流量、低階裝置（≤ 2 核或 < 2GB）不載入 three（只留 SVG）。 */
export function shouldLoadScene(env: SceneEnv): boolean {
  if (env.reducedMotion || env.saveData) return false;
  if (env.cores !== undefined && env.cores > 0 && env.cores <= 2) return false;
  if (env.memory !== undefined && env.memory > 0 && env.memory < 2) return false;
  return true;
}

/** 指標在 canvas 裡的位置 → -1..1（y 向上為正，thread-scene 的約定）。在 canvas 外回傳 null。 */
export function normalizePointer(x: number, y: number, rect: { left: number; top: number; width: number; height: number }): [number, number] | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const nx = ((x - rect.left) / rect.width) * 2 - 1;
  const ny = 1 - ((y - rect.top) / rect.height) * 2;
  return nx < -1 || nx > 1 || ny < -1 || ny > 1 ? null : [nx, ny];
}
