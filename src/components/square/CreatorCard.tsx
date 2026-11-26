import Link from "next/link";
import { MapPin } from "lucide-react";
import { creatorMediaUrl } from "@/lib/creator-media";
import { formatNumber, formatPercent, initialOf } from "@/lib/format";
import { cardTags, startingPriceLabel, type SquareCreator } from "@/lib/creators/square-view";
import { Avatar } from "./Avatar";
import { FavoriteButton } from "./FavoriteButton";

const THUMB_COLS_SM = ["", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3"] as const;

export function CreatorCard({ c }: { c: SquareCreator }) {
  const thumbs = c.portfolioPaths.slice(0, 3);
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface focus-within:ring-2 focus-within:ring-focus hover:border-line-strong">
      {thumbs.length > 0 ? (
        // 外層固定 3:1，內層絕對定位：只有一兩張作品時，圖片的原始高度不會把卡片撐高
        <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[3/1]">
          <div className={`absolute inset-0 grid gap-0.5 grid-cols-1 ${THUMB_COLS_SM[thumbs.length]}`}>
            {thumbs.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p} src={creatorMediaUrl(p) ?? undefined} alt="" loading="lazy" className={`h-full min-h-0 w-full bg-subtle object-cover ${i > 0 ? "hidden sm:block" : ""}`} />
            ))}
          </div>
        </div>
      ) : (
        <div aria-hidden="true" className="flex aspect-[4/3] items-center sm:aspect-[3/1] justify-center bg-subtle text-4xl font-semibold text-muted">
          {initialOf(c.displayName)}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="hidden sm:block"><Avatar path={c.avatarPath} name={c.displayName} size="md" /></div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-ink sm:text-base">
              {/* after: 撐滿整張卡片，讓整張可點；♡ 在上層（z-10）不會觸發跳頁 */}
              <Link href={`/c/${c.handle}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                {c.displayName}
              </Link>
            </h3>
            {c.region && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
                <MapPin size={12} strokeWidth={1.5} aria-hidden="true" />{c.region}
              </p>
            )}
            {c.categories.length > 0 && <p className="mt-0.5 truncate text-xs text-muted">{c.categories.join("、")}</p>}
          </div>
          <FavoriteButton creatorId={c.userId} name={c.displayName} initial={c.isFavorite} />
        </div>
        <dl className="grid grid-cols-2 gap-1 text-center sm:grid-cols-3 tabular-nums">
          <div>
            <dt className="text-xs text-muted">粉絲</dt>
            <dd className="mt-0.5 whitespace-nowrap text-sm font-semibold text-ink">{formatNumber(c.followerCount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">互動率</dt>
            <dd className="mt-0.5 whitespace-nowrap text-sm font-semibold text-ink">{formatPercent(c.engagementRate)}</dd>
          </div>
          <div className="hidden sm:block">
            <dt className="text-xs text-muted">起價</dt>
            <dd className="mt-0.5 whitespace-nowrap text-sm font-bold text-accent">{startingPriceLabel(c.minPrice)}</dd>
          </div>
        </dl>
        {cardTags(c).length > 0 && (
          <ul aria-label="標籤" className="mt-auto hidden flex-wrap gap-1.5 sm:flex">
            {cardTags(c).map((t) => (
              <li key={t} className="rounded-btn bg-subtle px-2.5 py-0.5 text-xs text-ink">{t}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
