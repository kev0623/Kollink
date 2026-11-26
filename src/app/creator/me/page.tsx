import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { CreatorSettingsForm } from "./CreatorSettingsForm";

export default function CreatorMePage() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[32px] font-bold text-ink">我的</h1>
        <div className="md:hidden"><SignOutButton /></div>
      </div>
      <Suspense fallback={null}>
        <Settings />
      </Suspense>
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
