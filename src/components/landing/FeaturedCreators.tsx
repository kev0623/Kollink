import Link from "next/link";
import { Suspense } from "react";
import { CreatorCard } from "@/components/directory/CreatorCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { textLink } from "@/components/ui/styles";
import { DIRECTORY_PATH } from "@/lib/creators/directory";
import { loadFeaturedCreators } from "@/lib/creators/directory-load";

const COUNT = 4;
const GRID = "grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4";

/** 首頁的創作者卡片：最新通過審核的幾位。還沒有任何公開的創作者時，整個區塊不顯示。 */
export function FeaturedCreators() {
  return (
    <Suspense fallback={<Frame><div aria-busy="true" className={GRID}>{Array.from({ length: COUNT }, (_, i) => <Skeleton key={i} className="aspect-[4/6] w-full rounded-card" />)}</div></Frame>}>
      <Loaded />
    </Suspense>
  );
}

async function Loaded() {
  const items = await loadFeaturedCreators(COUNT);
  if (items.length === 0) return null;
  return (
    <Frame>
      <ul className={GRID}>
        {items.map((c) => <li key={c.handle} className="min-w-0"><CreatorCard c={c} /></li>)}
      </ul>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="featured-title" className="mx-auto max-w-[1280px] px-5 pt-10 md:px-16 md:pt-16">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 id="featured-title" className="font-serif text-2xl font-bold text-ink md:text-[28px]">剛加入的創作者</h2>
        <Link href={DIRECTORY_PATH} className={`${textLink} shrink-0 text-sm`}>看全部</Link>
      </div>
      {children}
    </section>
  );
}
