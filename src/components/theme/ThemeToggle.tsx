"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useLang } from "@/components/i18n/useLang";
import { applyThemePref, type Theme } from "@/lib/theme";

function subscribe(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
const getSnapshot = (): Theme => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
const getServerSnapshot = (): Theme => "dark";

/**
 * 主題切換（右上角的一顆圖示按鈕）：深色時顯示太陽（按下換淺色），淺色時顯示月亮（按下換深色）。
 * 沒按過之前跟隨系統（<head> 的腳本決定）；按了之後記在這台裝置上。
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const next: Theme = theme === "dark" ? "light" : "dark";
  const en = useLang() === "en";
  const label = next === "light" ? (en ? "Switch to light theme" : "切換成淺色主題") : (en ? "Switch to dark theme" : "切換成深色主題");
  return (
    <button
      type="button" onClick={() => applyThemePref(next, true)} title={label}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-btn text-ink outline-none hover:bg-subtle focus-visible:ring-2 focus-visible:ring-focus ${className}`}
    >
      {theme === "dark"
        ? <Sun size={20} strokeWidth={1.5} aria-hidden="true" />
        : <Moon size={20} strokeWidth={1.5} aria-hidden="true" />}
      <span className="sr-only">{label}</span>
    </button>
  );
}
