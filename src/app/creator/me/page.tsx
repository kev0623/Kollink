import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { ThemeSelect } from "@/components/theme/ThemeSelect";
import { HelpLink } from "@/components/shell/HelpLink";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { CreatorSettingsForm } from "./CreatorSettingsForm";

export const metadata: Metadata = { title: "我的" };

export default function CreatorMePage() {
  return (
    <>
      <h1 className="mb-6 text-[32px] font-bold text-ink">我的</h1>
      <Suspense fallback={null}>
        <Settings />
      </Suspense>
      <section aria-labelledby="account-title" className="mt-10 max-w-xl space-y-3 border-t border-line pt-6">
        <h2 id="account-title" className="text-lg font-bold text-ink">外觀與帳號</h2>
        <ThemeSelect />
        <div className="flex flex-wrap gap-2"><HelpLink /><SignOutButton /></div>
      </section>
    </>
  );
}

async function Settings() {
  const me = await requireRole("creator");
  if (!me.creator || !me.profile) return null;
  const c = me.creator;
  return (
    <>
      <div className="mb-6 flex max-w-xl flex-wrap gap-3">
        <Link href="/creator/me/profile" className="inline-flex h-11 items-center rounded-btn bg-ink px-6 font-semibold text-on-ink">
          編輯公開頁
        </Link>
        <Link
          href={`/c/${c.handle}`}
          className="inline-flex h-11 items-center rounded-btn border border-line bg-surface px-6 font-semibold text-ink hover:bg-subtle"
        >
          查看我的公開頁
        </Link>
        <Link
          href="/creator/me/payout"
          className="inline-flex h-11 items-center rounded-btn border border-line bg-surface px-6 font-semibold text-ink hover:bg-subtle"
        >
          收款帳戶
        </Link>
      </div>
      <CreatorSettingsForm
        displayName={me.profile.displayName} handle={c.handle} igUsername={c.igUsername}
        followerCount={c.followerCount} region={c.region} categories={c.categories}
        handleEditable={!c.handleLocked}
      />
    </>
  );
}
