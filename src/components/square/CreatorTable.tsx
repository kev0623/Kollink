import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { formatNumber, formatPercent } from "@/lib/format";
import { postPriceLabel, type SquareCreator } from "@/lib/creators/square-view";
import type { SquareSort } from "@/lib/creators/square-query";
import { Avatar } from "./Avatar";
import { FavoriteButton } from "./FavoriteButton";

type SortableColumn = { label: string; sort: Exclude<SquareSort, "newest">; dir: "descending" | "ascending"; hint: string };

// 只有這三欄可排序，分別對應 spec 的排序；再點一次目前的欄位回到「最新加入」
const SORTABLE: SortableColumn[] = [
  { label: "粉絲數", sort: "followers", dir: "descending", hint: "依粉絲數由高到低排序" },
  { label: "互動率", sort: "engagement", dir: "descending", hint: "依互動率由高到低排序" },
  { label: "貼文報價", sort: "price", dir: "ascending", hint: "依起價（所有報價中的最低價）由低到高排序" },
];

const th = "whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-muted";
const td = "whitespace-nowrap px-4 py-3";

type Props = { items: SquareCreator[]; sort: SquareSort; onSort: (s: SquareSort) => void };

export function CreatorTable({ items, sort, onSort }: Props) {
  return (
    <div>
    <div className="relative overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={th}>創作者</th>
            {SORTABLE.map((col) => {
              const active = sort === col.sort;
              return (
                <th key={col.sort} scope="col" aria-sort={active ? col.dir : undefined} className={th}>
                  <button
                    type="button"
                    data-sort={col.sort}
                    onClick={() => onSort(active ? "newest" : col.sort)}
                    title={active ? "改回最新加入" : col.hint}
                    className={`inline-flex items-center gap-1 rounded-btn hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${active ? "font-semibold text-ink" : ""}`}
                  >
                    {col.label}
                    {active && (col.dir === "descending"
                      ? <ArrowDown size={12} strokeWidth={1.5} aria-hidden="true" />
                      : <ArrowUp size={12} strokeWidth={1.5} aria-hidden="true" />)}
                  </button>
                </th>
              );
            })}
            <th scope="col" className={th}>地區</th>
            <th scope="col" className={th}><span className="sr-only">查看</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((c) => (
            <tr key={c.userId} className="hover:bg-subtle">
              <td className={td}>
                <div className="flex items-center gap-3">
                  <Avatar path={c.avatarPath} name={c.displayName} size="sm" />
                  <div className="min-w-0">
                    <Link href={`/c/${c.handle}`} className="inline-flex min-h-11 items-center font-semibold text-ink hover:underline">{c.displayName}</Link>
                    <p className="text-xs text-muted">@{c.handle}</p>
                    {/* 手機看不到右邊的欄位：把粉絲數與互動率放在第一欄 */}
                    <p className="text-xs text-muted md:hidden">粉絲 {formatNumber(c.followerCount)}・互動率 {formatPercent(c.engagementRate)}</p>
                  </div>
                </div>
              </td>
              <td className={td}>{formatNumber(c.followerCount)}</td>
              <td className={td}>{formatPercent(c.engagementRate)}</td>
              <td className={`${td} font-semibold`}>{postPriceLabel(c.postPrice)}</td>
              <td className={`${td} text-muted`}>{c.region ?? "—"}</td>
              <td className={td}>
                <div className="flex items-center justify-end gap-2">
                  <FavoriteButton creatorId={c.userId} name={c.displayName} initial={c.isFavorite} />
                  <Link
                    href={`/c/${c.handle}`}
                    className="inline-flex min-h-11 items-center rounded-btn border border-line-strong px-3 text-xs font-semibold text-ink hover:bg-subtle"
                  >
                    查看<span className="sr-only"> {c.displayName}</span>
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <p className="mt-2 text-xs text-muted md:hidden">表格可以左右滑動，看更多欄位。</p>
    </div>
  );
}
