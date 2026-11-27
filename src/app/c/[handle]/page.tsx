import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadIsFavorite, loadPortfolio, loadPublicCreator, loadRates } from "@/lib/creators/public-profile";
import { profileMetadata } from "@/lib/creators/metadata";
import { viewerKindOf } from "@/lib/creators/view";
import { loadCreatorReviews, loadReviewStats } from "@/lib/reviews/load";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProfileView } from "./ProfileView";

type Props = { params: Promise<{ handle: string }> };

// 讀 cookie（本人預覽要加 noindex），在請求時解析；loadPublicCreator 有 React cache，與頁面共用同一次查詢
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  return profileMetadata(await loadPublicCreator(handle));
}

// 頁面殼是靜態的；資料在 <Suspense> 內逐次請求讀取，不快取（審核狀態在 SQL 改，App 無法觸發 revalidate；見計畫 3「快取決定」）。
export default function CreatorPublicPage({ params }: Props) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: Props) {
  const { handle } = await params;
  const creator = await loadPublicCreator(handle);
  // 不存在或未審核（且不是本人）一律 404，不透露任何資料
  if (!creator) notFound();
  const [me, portfolio, stats, reviews] = await Promise.all([
    getCurrentUser(), loadPortfolio(creator.userId), loadReviewStats(creator.userId), loadCreatorReviews(creator.userId),
  ]);
  const viewer = viewerKindOf(me?.profile?.role);
  // 報價與收藏狀態只有品牌需要（RLS 也只讓品牌與自己的收藏讀得到）
  const [rates, favorite] = viewer === "brand"
    ? await Promise.all([loadRates(creator.userId, creator.collabTypes), loadIsFavorite(creator.userId)])
    : [[], undefined];
  return (
    <ProfileView
      creator={creator} portfolio={portfolio} rates={rates} viewer={viewer} favorite={favorite}
      stats={stats} reviews={reviews.items} hasMoreReviews={reviews.hasMore}
    />
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4 pt-2 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6 md:pt-6">
      <p className="sr-only">載入中…</p>
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="h-24 bg-panel" />
        <div className="space-y-3 p-5"><Skeleton className="-mt-14 h-24 w-24 rounded-full" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-1/3" /></div>
      </div>
      <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div>
    </div>
  );
}
