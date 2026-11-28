"use client";

import { Search } from "lucide-react";
import { T } from "@/components/i18n/T";
import { useLang } from "@/components/i18n/useLang";
import { CATEGORIES } from "@/lib/options";
import { DIRECTORY_PATH, DIRECTORY_QUERY_MAX } from "@/lib/creators/directory";
import { optionLabel } from "@/lib/lang";

/**
 * 搜尋列（首頁與 /creators 共用）：一般的 GET 表單，沒有 JavaScript 也能用（那時是中文）。
 * 一個膠囊裡放類別、關鍵字、送出；手機上類別收到第二行。
 * <option> 與 placeholder 放不了雙語的 <span>，所以依目前語言輸出；送出的值永遠是中文的類別名稱。
 */
export function SearchBar({ q = "", category = null, autoFocus }: { q?: string; category?: string | null; autoFocus?: boolean }) {
  const en = useLang() === "en";
  return (
    <form action={DIRECTORY_PATH} method="get" role="search" aria-label={en ? "Search creators" : "搜尋創作者"}
      className="flex flex-wrap items-stretch gap-2 rounded-card border border-line-strong bg-surface p-2 elev-pop transition-[border-color] duration-150 focus-within:border-ink sm:flex-nowrap sm:rounded-btn">
      <label className="sr-only" htmlFor="dir-category"><T zh="類別" en="Category" /></label>
      <select
        id="dir-category" name="category" defaultValue={category ?? ""}
        className="h-11 min-w-0 flex-1 rounded-btn bg-subtle px-3 text-sm font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-36 sm:flex-none"
      >
        <option value="">{en ? "All categories" : "全部類別"}</option>
        {CATEGORIES.map((c) => <option key={c} value={c}>{optionLabel(c)[en ? "en" : "zh"]}</option>)}
      </select>
      <label className="sr-only" htmlFor="dir-q"><T zh="關鍵字" en="Keyword" /></label>
      <input
        id="dir-q" name="q" type="search" defaultValue={q} maxLength={DIRECTORY_QUERY_MAX} autoFocus={autoFocus}
        placeholder={en ? "Search by creator name" : "輸入創作者的名字"} autoComplete="off" enterKeyHint="search"
        className="order-first h-11 w-full min-w-0 rounded-btn bg-transparent px-3 text-base text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-focus sm:order-none sm:w-auto sm:flex-1"
      />
      <button type="submit" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-btn bg-primary px-6 font-bold text-on-primary elev-btn transition-[background-color,transform] duration-150 hover:bg-primary-hover active:scale-[0.98]">
        <Search size={18} strokeWidth={2} aria-hidden="true" /><T zh="搜尋" en="Search" />
      </button>
    </form>
  );
}
