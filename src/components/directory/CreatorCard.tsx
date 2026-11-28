import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { creatorMediaUrl } from "@/lib/creator-media";
import { formatNumber, formatTwd, initialOf } from "@/lib/format";
import { formatRating } from "@/lib/reviews/view";
import type { DirectoryCreator } from "@/lib/creators/directory";
import { T, TList } from "@/components/i18n/T";
import { optionLabel } from "@/lib/lang";

/**
 * 公開列表的創作者卡片：整張卡是一個連結，沒有外框、底色和陰影，滑過只有照片放大。
 * 上方是 4:5 的圓角作品（沒有作品用頭像，都沒有用名字第一個字），
 * 左上角是粉絲數（登入後才有）；下方是名字、類別、地區、評分與起價。
 */
export function CreatorCard({ c, priority }: { c: DirectoryCreator; priority?: boolean }) {
  const image = creatorMediaUrl(c.coverPath) ?? creatorMediaUrl(c.avatarPath);
  return (
    <Link
      href={`/c/${c.handle}`}
      className="group block min-w-0 rounded-card outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-panel">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading={priority ? "eager" : "lazy"} className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
        ) : (
          <div aria-hidden="true" className="flex h-full w-full items-center justify-center font-serif text-6xl font-bold text-line-strong">
            {initialOf(c.displayName)}
          </div>
        )}
        {c.followerCount !== null && (
          <span className="absolute left-2 top-2 rounded-btn bg-bg/85 px-2.5 py-1 text-xs font-bold tabular-nums text-ink">
            {formatNumber(c.followerCount)}<T zh=" 粉絲" en=" followers" />
          </span>
        )}
      </div>
      <div className="px-1 pt-3">
        <p className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate font-bold text-ink group-hover:underline group-hover:underline-offset-4">{c.displayName}</span>
          {c.rating !== null && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold tabular-nums text-ink">
              <Star size={13} strokeWidth={1.5} aria-hidden="true" className="fill-current text-primary" />
              {formatRating(c.rating)}<span className="sr-only"><T zh="顆星，" en=" stars, " /></span>
              <span className="font-normal text-muted">（{c.reviewCount}）</span>
            </span>
          )}
        </p>
        <p className="mt-1 truncate text-xs text-muted">{c.categories.length > 0 ? <TList items={c.categories.map(optionLabel)} /> : <T zh="尚未設定類別" en="No categories yet" />}</p>
        <p className="mt-2 flex min-h-5 items-center justify-between gap-2 text-xs text-muted">
          <span className="inline-flex min-w-0 items-center gap-0.5 truncate">
            {c.region && <><MapPin size={12} strokeWidth={1.5} aria-hidden="true" /><T {...optionLabel(c.region)} /></>}
          </span>
          {c.minPrice !== null && (
            <span className="shrink-0 text-sm font-bold tabular-nums text-ink">{formatTwd(c.minPrice)}<span className="ml-0.5 text-xs font-normal text-muted"><T zh="起" en="+" /></span></span>
          )}
        </p>
      </div>
    </Link>
  );
}

export const CREATOR_GRID = "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4";
