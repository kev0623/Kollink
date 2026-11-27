import { ADMIN_PAGE_SIZE } from "@/lib/admin/query";
import { Pagination as BasePagination } from "@/components/ui/Pagination";

/** 管理後台的分頁：與前台同一個元件，每頁 50 筆。 */
export function Pagination({ page, total, hrefFor }: { page: number; total: number; hrefFor: (page: number) => string }) {
  return <BasePagination page={page} total={total} hrefFor={hrefFor} size={ADMIN_PAGE_SIZE} />;
}
