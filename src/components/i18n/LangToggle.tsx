"use client";

import { applyLang } from "@/lib/lang";
import { useLang } from "./useLang";

/** 中英文切換（公開頁右上角）：顯示的是「按下去會換成的語言」。 */
export function LangToggle() {
  const lang = useLang();
  const next = lang === "zh" ? "en" : "zh";
  return (
    <button
      type="button" onClick={() => applyLang(next, true)} lang={next === "en" ? "en" : "zh-Hant"}
      aria-label={next === "en" ? "Switch to English" : "切換成中文"}
      className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-btn px-2 text-sm font-bold text-ink outline-none hover:bg-subtle focus-visible:ring-2 focus-visible:ring-focus"
    >
      {next === "en" ? "EN" : "中文"}
    </button>
  );
}
