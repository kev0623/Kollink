import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadPortfolio, loadPublicCreator, loadRates } from "@/lib/creators/public-profile";
import { viewerKindOf } from "@/lib/creators/view";
import { ProfileView } from "./ProfileView";

type Props = { params: Promise<{ handle: string }> };

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
  const [me, portfolio] = await Promise.all([getCurrentUser(), loadPortfolio(creator.userId)]);
  const viewer = viewerKindOf(me?.profile?.role);
  // 報價只給品牌看（RLS 也只讓品牌與本人讀得到）；本人以創作者身分看到的是鎖定區塊
  const rates = viewer === "brand" ? await loadRates(creator.userId, creator.collabTypes) : [];
  return <ProfileView creator={creator} portfolio={portfolio} rates={rates} viewer={viewer} />;
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4 pt-2 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6 md:pt-6">
      <p className="sr-only">載入中…</p>
      <div className="h-64 rounded-card border border-line bg-surface" />
      <div className="h-64 rounded-card border border-line bg-surface" />
    </div>
  );
}
