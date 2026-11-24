import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { loadOwnPublicProfile } from "@/lib/creators/own-profile";
import { PublicProfileForm } from "./PublicProfileForm";
import { PortfolioForm } from "./PortfolioForm";
import { RatesForm } from "./RatesForm";

export default function CreatorProfileEditPage() {
  return (
    <>
      <div className="mb-6">
        <Link href="/creator/me" className="text-sm text-muted hover:text-ink">← 我的</Link>
        <h1 className="mt-2 text-[32px] font-bold text-ink">公開頁</h1>
      </div>
      <Suspense fallback={<p className="text-muted">載入中…</p>}>
        <Editor />
      </Suspense>
    </>
  );
}

async function Editor() {
  const me = await requireRole("creator");
  if (!me.creator || !me.profile) return null;
  const own = await loadOwnPublicProfile(me.id);
  return (
    <div className="space-y-6">
      <Link
        href={`/c/${me.creator.handle}`}
        className="inline-flex h-11 items-center rounded-btn border border-line bg-surface px-6 font-semibold text-ink hover:bg-primary-soft"
      >
        查看我的公開頁
      </Link>
      <PublicProfileForm userId={me.id} displayName={me.profile.displayName} initial={own.profile} />
      <PortfolioForm userId={me.id} initial={own.portfolio} />
      <RatesForm collabTypes={own.profile.collabTypes} initial={own.rates} />
    </div>
  );
}
