"use client";

import { useSyncExternalStore, type CSSProperties, type FocusEvent } from "react";
import { keyboardInset, NO_KEYBOARD, panelMaxHeight, type KeyboardInset } from "@/lib/keyboard-inset";

let cached: KeyboardInset = NO_KEYBOARD;

function read(): KeyboardInset {
  const vv = window.visualViewport;
  // 雙指放大（scale > 1）時可視高度也會變小，那不是鍵盤
  if (!vv || vv.scale > 1.01) return NO_KEYBOARD;
  const next = keyboardInset({ layoutHeight: window.innerHeight, visualHeight: vv.height, offsetTop: vv.offsetTop });
  // useSyncExternalStore 要求內容沒變時回傳同一個物件
  if (next.open !== cached.open || next.bottom !== cached.bottom || next.visible !== cached.visible) cached = next;
  return cached;
}

function subscribe(cb: () => void) {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  vv.addEventListener("resize", cb);
  vv.addEventListener("scroll", cb);
  return () => {
    vv.removeEventListener("resize", cb);
    vv.removeEventListener("scroll", cb);
  };
}

/**
 * 螢幕鍵盤的狀態（手機）。iOS Safari 鍵盤彈出時版面高度不變，position: fixed／sticky 貼底的面板會被鍵盤蓋住，
 * 100vh／dvh 也不會跟著變；只能用 visualViewport 算出真正看得到的範圍。桌面與不支援的瀏覽器永遠回傳「沒開」。
 */
export function useKeyboardInset(): KeyboardInset {
  return useSyncExternalStore(subscribe, read, () => NO_KEYBOARD);
}

/**
 * 手機上貼在底部、裡面有輸入框的面板（報名、邀請合作）用：鍵盤彈出時把面板移到鍵盤上方、高度縮到看得到的範圍，
 * 並把正在輸入的欄位捲進面板的可視範圍。桌面（md 以上，面板在右欄）不套用。
 * 用法：<aside style={panel.style} onFocus={panel.onFocus} className="… overflow-y-auto">
 */
export function useKeyboardPanel(gapPx = 8): { style: CSSProperties | undefined; onFocus: (e: FocusEvent<HTMLElement>) => void } {
  const k = useKeyboardInset();
  const active = k.open && typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const max = active ? panelMaxHeight(k, 16) : null;
  return {
    style: active && max !== null ? { bottom: k.bottom + gapPx, maxHeight: max - gapPx } : undefined,
    onFocus: (e) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
      // 等鍵盤動畫與面板縮小之後再捲，否則會捲到舊的位置
      window.setTimeout(() => el.scrollIntoView({ block: "nearest", behavior: "smooth" }), 300);
    },
  };
}
