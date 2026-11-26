import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { loadPopularStyleTags, searchSquare } from "@/lib/creators/square";
import { parseSquareQuery } from "@/lib/creators/square-query";
import { SquareView } from "@/components/square/SquareView";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// 頁面殼（標題、骨架）是靜態的；searchParams 與 session 都在 <Suspense> 內讀（cacheComponents）
export const metadata: Metadata = { title: "創作者廣場" };

export default function BrandSquarePage({ searchParams }: Props) {
  return (
    <div>
      <h1 className="text-[32px] font-bold text-ink">創作者廣場</h1>
      <div className="mt-6">
        <Suspense fallback={<SquareSkeleton />}>
          <Square searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Square({ searchParams }: Props) {
  // layout 的 Gate 在用戶端換頁時不會重跑，頁面自己也要檢查
  await requireRole("brand");
  const query = parseSquareQuery(await searchParams);
  const [initial, popularTags] = await Promise.all([searchSquare(query, 0), loadPopularStyleTags()]);
  return <SquareView query={query} initial={initial} popularTags={popularTags} />;
}

function SquareSkeleton() {
  return (
    <div aria-busy="true" className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
      <p className="sr-only">載入中…</p>
      <div className="hidden h-96 rounded-card border border-line bg-surface lg:block" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-72 rounded-card border border-line bg-surface" />)}
      </div>
    </div>
  );
}
