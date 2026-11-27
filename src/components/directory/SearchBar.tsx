import { Search } from "lucide-react";
import { CATEGORIES } from "@/lib/options";
import { DIRECTORY_PATH, DIRECTORY_QUERY_MAX } from "@/lib/creators/directory";

/**
 * 搜尋列（首頁與 /creators 共用）：一般的 GET 表單，沒有 JavaScript 也能用。
 * 一個膠囊裡放類別、關鍵字、送出；手機上類別收到第二行。
 */
export function SearchBar({ q = "", category = null, autoFocus }: { q?: string; category?: string | null; autoFocus?: boolean }) {
  return (
    <form action={DIRECTORY_PATH} method="get" role="search" aria-label="搜尋創作者"
      className="flex flex-wrap items-stretch gap-2 rounded-card border border-line-strong bg-surface p-2 sm:flex-nowrap sm:rounded-btn">
      <label className="sr-only" htmlFor="dir-category">類別</label>
      <select
        id="dir-category" name="category" defaultValue={category ?? ""}
        className="h-11 min-w-0 flex-1 rounded-btn bg-subtle px-3 text-sm font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-32 sm:flex-none"
      >
        <option value="">全部類別</option>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <label className="sr-only" htmlFor="dir-q">關鍵字</label>
      <input
        id="dir-q" name="q" type="search" defaultValue={q} maxLength={DIRECTORY_QUERY_MAX} autoFocus={autoFocus}
        placeholder="輸入名字或 IG 帳號" autoComplete="off" enterKeyHint="search"
        className="order-first h-11 w-full min-w-0 rounded-btn bg-transparent px-3 text-base text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-focus sm:order-none sm:w-auto sm:flex-1"
      />
      <button type="submit" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-btn bg-primary px-6 font-bold text-on-primary hover:bg-primary-hover active:scale-[0.98]">
        <Search size={18} strokeWidth={2} aria-hidden="true" />搜尋
      </button>
    </form>
  );
}
