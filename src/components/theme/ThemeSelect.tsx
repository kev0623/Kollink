"use client";

import { useId, useSyncExternalStore } from "react";
import { Moon } from "lucide-react";
import { applyThemePref, parseThemePref, THEME_OPTIONS, type ThemePref } from "@/lib/theme";

function subscribe(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-pref"] });
  return () => mo.disconnect();
}
const getSnapshot = (): ThemePref => parseThemePref(document.documentElement.getAttribute("data-theme-pref"));
const getServerSnapshot = (): ThemePref => "system";

/** 窄版用的短標籤（「跟隨系統」四個字在 88px 側欄放不下） */
const SHORT: Record<ThemePref, string> = { system: "系統", dark: "深色", light: "淺色" };

/** 主題選擇（規格 §4）：原生 select。compact 用在 88px 寬的側欄；bar 用在手機頂列（單行、不另顯示標籤，與旁邊的 44px 按鈕等高）。 */
export function ThemeSelect({ compact = false, bar = false }: { compact?: boolean; bar?: boolean }) {
  const id = useId();
  const pref = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const short = compact || bar;
  if (bar) {
    return (
      <div className="flex items-center">
        <label htmlFor={id} className="sr-only">主題</label>
        <select
          id={id} value={pref}
          onChange={(e) => applyThemePref(parseThemePref(e.target.value), true)}
          className="h-11 rounded-input border border-line-strong bg-surface px-3 text-base text-ink"
        >
          {THEME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{SHORT[o.value]}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div className={compact ? "flex w-full flex-col items-center gap-1" : "flex items-center gap-3"}>
      <label htmlFor={id} className={compact ? "flex items-center gap-1 text-[11px] text-muted" : "text-sm font-semibold text-ink"}>
        {compact && <Moon size={12} strokeWidth={1.5} aria-hidden="true" />}主題
      </label>
      <select
        id={id}
        value={pref}
        onChange={(e) => applyThemePref(parseThemePref(e.target.value), true)}
        className={`h-11 rounded-input border border-line-strong bg-surface text-base text-ink ${compact ? "w-[80px] px-1 text-center" : "px-3"}`}
      >
        {THEME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{short ? SHORT[o.value] : o.label}</option>)}
      </select>
    </div>
  );
}
