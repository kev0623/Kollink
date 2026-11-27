"use client";

import { useLayoutEffect } from "react";
import { applyLang, readLang } from "@/lib/lang";
import { applyThemePref, readThemePref, watchSystemTheme } from "@/lib/theme";

/**
 * 內嵌腳本已在繪製前設定好主題；這裡只做兩件事：
 * 1. 開發模式 Strict Mode 重新掛載時 React 會清掉 <html> 上的屬性，再套用一次（正式環境是 no-op）。
 * 2. 偏好是「跟隨系統」時，系統切換深淺色就跟著換。
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyThemePref(readThemePref(), false);
    applyLang(readLang(), false); // 語言也是內嵌腳本設在 <html> 上的，同樣要補回來
    return watchSystemTheme(() => {
      if (readThemePref() === "system") applyThemePref("system", false);
    });
  }, []);
  return null;
}
