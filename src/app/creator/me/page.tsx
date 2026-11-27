import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { loadOwnPublicProfile } from "@/lib/creators/own-profile";
import { loadHasPayoutAccount } from "@/lib/creators/payout-status";
import { HelpLink } from "@/components/shell/HelpLink";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { btn } from "@/components/ui/styles";
import { CreatorSettingsForm } from "./CreatorSettingsForm";
import { PortfolioForm } from "./profile/PortfolioForm";
import { ProfileAndRates } from "./profile/ProfileAndRates";

export const metadata: Metadata = { title: "我的" };

const SECTIONS = [
  { id: "profile", label: "公開頁" },
  { id: "portfolio", label: "作品" },
  { id: "account", label: "帳號" },
  { id: "payout", label: "收款帳戶" },
];

export default function CreatorMePage() {
  return (
    <>
      <PageHeader title="我的" description="這裡的資料會出現在你的公開頁；作品、自介、類別與報價對所有人公開；粉絲數與作品的貼文連結，登入的人才看得到。" />
      <nav aria-label="本頁段落" className="scroll-fade-x -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="inline-flex h-11 shrink-0 items-center rounded-btn border border-line-strong px-4 text-sm font-bold text-ink hover:bg-subtle">{s.label}</a>)}
      </nav>
      <Suspense fallback={<div className="space-y-6"><Skeleton className="h-96 w-full" /><Skeleton className="h-64 w-full" /></div>}>
        <Editor />
      </Suspense>
      <section aria-labelledby="look-title" className="mt-10 max-w-xl space-y-3 border-t border-line pt-6">
        <h2 id="look-title" className="text-lg font-bold text-ink">帳號</h2>
        <div className="-ml-3 flex flex-wrap gap-2"><HelpLink /><SignOutButton /></div>
      </section>
    </>
  );
}

async function Editor() {
  const me = await requireRole("creator");
  if (!me.creator || !me.profile) return null;
  const c = me.creator;
  const [own, hasAccount] = await Promise.all([loadOwnPublicProfile(me.id), loadHasPayoutAccount(me.id)]);
  return (
    <div className="max-w-2xl space-y-10">
      <section id="profile" aria-labelledby="profile-title" className="scroll-mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="profile-title" className="font-serif text-2xl font-bold text-ink">公開頁</h2>
          <Link href={`/c/${c.handle}`} className={btn.secondary}>預覽公開頁</Link>
        </div>
        <ProfileAndRates userId={me.id} displayName={me.profile.displayName} profile={own.profile} rates={own.rates} />
      </section>
      <section id="portfolio" aria-labelledby="portfolio-title" className="scroll-mt-6 space-y-4">
        <h2 id="portfolio-title" className="font-serif text-2xl font-bold text-ink">作品</h2>
        <PortfolioForm userId={me.id} initial={own.portfolio} />
      </section>
      <section id="account" aria-labelledby="account-title" className="scroll-mt-6 space-y-4">
        <h2 id="account-title" className="font-serif text-2xl font-bold text-ink">帳號</h2>
        <CreatorSettingsForm
          displayName={me.profile.displayName} handle={c.handle} igUsername={c.igUsername}
          followerCount={c.followerCount} region={c.region} categories={c.categories}
          handleEditable={!c.handleLocked}
        />
      </section>
      <section id="payout" aria-labelledby="payout-title" className="scroll-mt-6 max-w-2xl space-y-3">
        <h2 id="payout-title" className="font-serif text-2xl font-bold text-ink">收款帳戶</h2>
        {hasAccount
          ? <Notice tone="success">已設定收款帳戶。</Notice>
          : <Notice tone="warning">還沒有收款帳戶。合作完成後平台需要它才能撥款。</Notice>}
        <Link href="/creator/me/payout" className={btn.secondary}>{hasAccount ? "查看或修改" : "設定收款帳戶"}</Link>
      </section>
    </div>
  );
}
