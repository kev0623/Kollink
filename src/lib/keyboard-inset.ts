// 手機螢幕鍵盤彈出時，固定在底部的面板可用的高度。純函式（hook 在 components/ui/useKeyboardInset.ts）。

/** 可視高度比版面高度少這麼多才算鍵盤開著（網址列收合、工具列的變化比這個小）。 */
export const KEYBOARD_MIN_INSET = 120;

export type ViewportMetrics = {
  /** window.innerHeight：版面高度（iOS 鍵盤彈出時不變；Android 依設定可能變小） */
  layoutHeight: number;
  /** visualViewport.height：真正看得到的高度 */
  visualHeight: number;
  /** visualViewport.offsetTop：可視區域被往下推了多少（iOS 鍵盤彈出時頁面會被推上去） */
  offsetTop: number;
};

export type KeyboardInset = {
  /** 鍵盤開著 */
  open: boolean;
  /** 被鍵盤（與瀏覽器工具列）蓋住的底部高度，px；固定在底部的元素要往上移這麼多 */
  bottom: number;
  /** 看得到的高度，px */
  visible: number;
};

export const NO_KEYBOARD: KeyboardInset = { open: false, bottom: 0, visible: 0 };

export function keyboardInset(m: ViewportMetrics): KeyboardInset {
  const visible = Math.max(0, Math.round(m.visualHeight));
  const bottom = Math.max(0, Math.round(m.layoutHeight - m.visualHeight - m.offsetTop));
  // 雙指放大時 visualHeight 也會變小：那不是鍵盤（offsetTop 之外還有 scale，由 hook 排除）
  return bottom >= KEYBOARD_MIN_INSET ? { open: true, bottom, visible } : { open: false, bottom: 0, visible };
}

/**
 * 底部面板的最大高度：鍵盤開著時是「看得到的高度 − 上方留白」，至少留 minPx；鍵盤沒開時回 null（用 CSS 原本的上限）。
 */
export function panelMaxHeight(k: KeyboardInset, topGap = 16, minPx = 200): number | null {
  if (!k.open) return null;
  return Math.max(minPx, k.visible - topGap);
}
