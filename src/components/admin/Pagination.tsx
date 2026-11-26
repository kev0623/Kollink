import Link from "next/link";
import { pageCount } from "@/lib/admin/query";
import { btn } from "@/components/ui/styles";

/** 上一頁／下一頁（頁數在網址 ?page=）。只有一頁時不顯示。 */
export function Pagination({ page, total, hrefFor }: { page: number; total: number; hrefFor: (page: number) => string }) {
  const pages = pageCount(total);
  if (pages <= 1 && page <= 1) return null;
  return (
    <nav aria-label="分頁" className="mt-4 flex items-center justify-between gap-3">
      {page > 1 ? <Link href={hrefFor(Math.min(page - 1, pages))} className={btn.secondary}>上一頁</Link> : <span />}
      <span className="text-center text-sm tabular-nums text-muted">第 {Math.min(page, pages)} / {pages} 頁，共 {total} 筆</span>
      {page < pages ? <Link href={hrefFor(page + 1)} className={btn.secondary}>下一頁</Link> : <span />}
    </nav>
  );
}
