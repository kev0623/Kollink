import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE, pageCount, pageItems, pageSpan } from "@/lib/paging";
import { T } from "@/components/i18n/T";
import { LinkPending } from "./LinkPending";
import { linkPending } from "./styles";

const cell = "inline-flex h-11 min-w-11 items-center justify-center rounded-btn px-3 text-sm font-semibold tabular-nums";
const step = `${cell} ${linkPending} gap-1 border border-line-strong bg-surface text-ink hover:bg-subtle`;
const stepOff = `${cell} gap-1 border border-line text-muted opacity-50`;

/**
 * 分頁（頁數在網址 ?page=）：上一頁／下一頁，桌面多一排頁碼；下方是「第 21–40 筆，共 57 筆」。
 * bilingual：公開頁用，文字跟著中英文切換（登入後的列表只有中文）；unitEn 是英文的單位。
 * 只有一頁時不顯示。上一頁／下一頁到頭時留著位置（不可點），按鈕不會跳來跳去。
 */
export function Pagination({ page, total, hrefFor, size = PAGE_SIZE, label = "分頁", unit = "筆", bilingual = false, unitEn = "" }: {
  page: number; total: number; hrefFor: (page: number) => string; size?: number; label?: string; unit?: string;
  bilingual?: boolean; unitEn?: string;
}) {
  const tx = (zh: string, en: string) => (bilingual ? <T zh={zh} en={en} /> : zh);
  const pages = pageCount(total, size);
  if (pages <= 1) {
    // 網址的頁數超過範圍（資料變少、舊連結）：給一條回去的路
    return page > 1
      ? <nav aria-label={label} className="mt-6 flex justify-center"><Link href={hrefFor(1)} className={step}>{tx("回第一頁", "Back to first page")}<LinkPending /></Link></nav>
      : null;
  }
  const cur = Math.min(Math.max(1, page), pages);
  const span = pageSpan(cur, total, size);
  return (
    <nav aria-label={label} className="mt-6">
      <div className="flex items-center justify-between gap-2 sm:justify-center">
        {cur > 1 ? (
          <Link href={hrefFor(cur - 1)} rel="prev" className={step}>
            <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />{tx("上一頁", "Previous")}<LinkPending />
          </Link>
        ) : (
          <span aria-disabled="true" className={stepOff}><ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />{tx("上一頁", "Previous")}</span>
        )}
        <span className="text-sm tabular-nums text-muted sm:hidden">{tx(`第 ${cur} / ${pages} 頁`, `Page ${cur} of ${pages}`)}</span>
        <ol className="hidden items-center gap-1 sm:flex">
          {pageItems(cur, pages).map((it) => it.kind === "gap" ? (
            <li key={it.key} aria-hidden="true" className={`${cell} text-muted`}>…</li>
          ) : (
            <li key={it.page}>
              {it.page === cur ? (
                <span aria-current="page" className={`${cell} bg-ink text-on-ink`}><span className="sr-only">{tx("第 ", "Page ")}</span>{it.page}<span className="sr-only">{tx(" 頁，目前這一頁", ", current page")}</span></span>
              ) : (
                <Link href={hrefFor(it.page)} className={`${cell} ${linkPending} text-ink hover:bg-subtle`}><span className="sr-only">{tx("第 ", "Page ")}</span>{it.page}<span className="sr-only">{tx(" 頁", "")}</span><LinkPending /></Link>
              )}
            </li>
          ))}
        </ol>
        {cur < pages ? (
          <Link href={hrefFor(cur + 1)} rel="next" className={step}>
            {tx("下一頁", "Next")}<ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" /><LinkPending />
          </Link>
        ) : (
          <span aria-disabled="true" className={stepOff}>{tx("下一頁", "Next")}<ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" /></span>
        )}
      </div>
      {span && (
        <p className="mt-2 text-center text-xs tabular-nums text-muted">
          {tx(`第 ${span.first}–${span.last} ${unit}，共 ${total} ${unit}`, `${span.first}–${span.last} of ${total}${unitEn ? ` ${unitEn}` : ""}`)}
        </p>
      )}
    </nav>
  );
}
