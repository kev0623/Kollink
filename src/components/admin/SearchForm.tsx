import { btn, input } from "@/components/ui/styles";

/** 關鍵字搜尋（GET 表單；送出後回到第 1 頁，其他篩選放在 hidden 欄位）。 */
export function SearchForm({ action, q, placeholder, hidden }: {
  action: string; q: string; placeholder: string; hidden: Record<string, string>;
}) {
  return (
    <form action={action} method="get" role="search" className="flex w-full max-w-md gap-2">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label className="sr-only" htmlFor="admin-q">搜尋</label>
      <input id="admin-q" name="q" defaultValue={q} maxLength={50} placeholder={placeholder} className={input} />
      <button type="submit" className={`${btn.secondary} shrink-0`}>搜尋</button>
    </form>
  );
}
