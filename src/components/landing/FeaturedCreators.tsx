import Link from "next/link";
import { Suspense } from "react";
import { Star } from "lucide-react";
import { creatorMediaUrl } from "@/lib/creator-media";
import { formatNumber, formatTwd, initialOf } from "@/lib/format";
import { formatRating } from "@/lib/reviews/view";
import { DIRECTORY_PATH, type DirectoryCreator } from "@/lib/creators/directory";
import { loadFeaturedCreators } from "@/lib/creators/directory-load";

const COUNT = 4;
const GRID = "mx-auto mt-6 grid max-w-[1040px] grid-cols-2 gap-3 md:mt-8 md:gap-4 lg:grid-cols-4";

/**
 * 主視覺裡的創作者卡片：最新通過審核的幾位。還沒有任何公開的創作者時不顯示、也不佔位置
 * （fallback 是空的：資料晚一點到時卡片才出現，下面的按鈕往下移一次）。
 */
export function FeaturedCreators() {
  return (
    <Suspense fallback={null}>
      <Loaded />
    </Suspense>
  );
}

async function Loaded() {
  const items = await loadFeaturedCreators(COUNT);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="featured-title">
      <h2 id="featured-title" className="sr-only">剛加入的創作者</h2>
      <ul className={GRID}>
        {items.map((c) => <li key={c.handle} className="min-w-0"><HeroCard c={c} /></li>)}
      </ul>
      <p className="mt-4 text-center">
        <Link href={DIRECTORY_PATH} className="inline-flex min-h-11 items-center text-sm font-bold text-ink underline underline-offset-4 hover:text-accent">看全部創作者</Link>
      </p>
    </section>
  );
}

/** 整張都是圖的卡片：左上角粉絲數，名字與類別疊在下方的漸層上（漸層與文字都用底色／文字色 token，深淺色都讀得到）。 */
function HeroCard({ c }: { c: DirectoryCreator }) {
  const image = creatorMediaUrl(c.coverPath) ?? creatorMediaUrl(c.avatarPath);
  return (
    <Link
      href={`/c/${c.handle}`}
      className="group relative block aspect-[4/5] overflow-hidden rounded-card border border-line bg-panel outline-none transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-focus"
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center pb-10 font-serif text-7xl font-bold text-line-strong">
          {initialOf(c.displayName)}
        </div>
      )}
      <span className="absolute left-2 top-2 rounded-btn bg-bg/85 px-2.5 py-1 text-xs font-bold tabular-nums text-ink">
        {formatNumber(c.followerCount)} 粉絲
      </span>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg/85 to-transparent px-3 pb-3 pt-12 md:px-4 md:pb-4">
        <p className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate font-bold text-ink group-hover:underline group-hover:underline-offset-4">{c.displayName}</span>
          {c.rating !== null && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold tabular-nums text-ink">
              <Star size={13} strokeWidth={1.5} aria-hidden="true" className="fill-current text-primary" />
              {formatRating(c.rating)}<span className="sr-only"> 顆星</span>
            </span>
          )}
        </p>
        <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted">
          <span className="min-w-0 truncate">{c.categories.length > 0 ? c.categories.join("・") : c.region ?? ""}</span>
          {c.minPrice !== null && (
            <span className="shrink-0 text-sm font-bold tabular-nums text-ink">{formatTwd(c.minPrice)}<span className="ml-0.5 text-xs font-normal text-muted">起</span></span>
          )}
        </p>
      </div>
    </Link>
  );
}
