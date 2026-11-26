// 主題（規格 §4）。THEME_SCRIPT 在 <head> 內嵌執行（繪製前）；其他函式只在瀏覽器呼叫。
// CSP 是靜態的 script-src 'self' 'unsafe-inline'（src/lib/security-headers.ts），內嵌腳本可以執行。

export const THEME_STORAGE_KEY = "kollink-theme";

export type ThemePref = "dark" | "light" | "system";
export type Theme = "dark" | "light";

export const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "system", label: "跟隨系統" },
  { value: "dark", label: "深色" },
  { value: "light", label: "淺色" },
];

export function parseThemePref(v: unknown): ThemePref {
  return v === "dark" || v === "light" ? v : "system";
}

export function resolveTheme(pref: ThemePref, systemPrefersLight: boolean): Theme {
  if (pref === "system") return systemPrefersLight ? "light" : "dark";
  return pref;
}

const LIGHT_QUERY = "(prefers-color-scheme: light)";

/** 與 parseThemePref／resolveTheme 相同的邏輯，寫成 ES5（在任何 bundle 之前執行）。 */
export const THEME_SCRIPT =
  `(function(){try{var d=document.documentElement,p=localStorage.getItem("${THEME_STORAGE_KEY}");` +
  `if(p!=="dark"&&p!=="light")p="system";` +
  `var t=p==="system"?(window.matchMedia("${LIGHT_QUERY}").matches?"light":"dark"):p;` +
  `d.setAttribute("data-theme",t);d.setAttribute("data-theme-pref",p);d.style.colorScheme=t}catch(e){}})();`;

/** 瀏覽器：讀使用者偏好（localStorage 被封鎖時當成 system）。 */
export function readThemePref(): ThemePref {
  try {
    return parseThemePref(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/** 瀏覽器：套用偏好到 <html>；persist 為 true 時寫回 localStorage。回傳實際主題。 */
export function applyThemePref(pref: ThemePref, persist: boolean): Theme {
  const theme = resolveTheme(pref, window.matchMedia(LIGHT_QUERY).matches);
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-theme-pref", pref);
  root.style.colorScheme = theme;
  if (persist) {
    try {
      if (pref === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      // 無痕模式等：只影響這一頁
    }
  }
  return theme;
}

export function watchSystemTheme(onChange: () => void): () => void {
  const mq = window.matchMedia(LIGHT_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
