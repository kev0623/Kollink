import Link from "next/link";
import { pageCount } from "@/lib/admin/query";

/** 上一頁／下一頁（頁數在網址 ?page=）。只有一頁時不顯示。 */
export function Pagination({ page, total, hrefFor }: { page: number; total: number; hrefFor: (page: number) => string }) {
  const pages = pageCount(total);
  if (pages <= 1 && page <= 1) return null;
  const btn = "inline-flex h-11 items-center rounded-btn border border-line bg-surface px-4 text-sm font-semibold text-ink";
  return (
    <nav aria-label="分頁" className="mt-4 flex items-center justify-between gap-3">
      {page > 1 ? <Link href={hrefFor(Math.min(page - 1, pages))} className={btn}>上一頁</Link> : <span />}
      <span className="text-sm text-muted">第 {Math.min(page, pages)} / {pages} 頁，共 {total} 筆</span>
      {page < pages ? <Link href={hrefFor(page + 1)} className={btn}>下一頁</Link> : <span />}
    </nav>
  );
}
