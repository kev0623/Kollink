import { inputClassName } from "./styles";

/** 關鍵字搜尋（GET 表單；送出後回到第 1 頁，其他篩選放在 hidden 欄位）。 */
export function SearchForm({ action, q, placeholder, hidden }: {
  action: string; q: string; placeholder: string; hidden: Record<string, string>;
}) {
  return (
    <form action={action} method="get" role="search" className="flex w-full max-w-md gap-2">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label className="sr-only" htmlFor="admin-q">搜尋</label>
      <input id="admin-q" name="q" defaultValue={q} maxLength={50} placeholder={placeholder} className={inputClassName} />
      <button type="submit" className="h-[42px] shrink-0 rounded-btn bg-ink px-4 text-sm font-semibold text-on-ink">搜尋</button>
    </form>
  );
}
