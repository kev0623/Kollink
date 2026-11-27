import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser, getIsAdminAccount } from "@/lib/auth/current-user";
import { homeFor } from "@/lib/auth/post-login";
import { T } from "@/components/i18n/T";

const login = <T zh="登入" en="Log in" />;
const enter = <T zh="進入後台" en="Dashboard" />;

const cls = "inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-btn border border-line-strong px-5 text-sm font-bold text-ink hover:bg-subtle";

/** 會讀 session：自己帶 <Suspense>；fallback 是同尺寸的「登入」，不跳動。（QA m4：首頁辨識登入狀態） */
export function AccountLink() {
  return (
    <Suspense fallback={<Link href="/login" className={cls}>{login}</Link>}>
      <Resolved />
    </Suspense>
  );
}

async function Resolved() {
  const me = await getCurrentUser();
  if (!me) return <Link href="/login" className={cls}>{login}</Link>;
  if (me.profile) return <Link href={homeFor(me.profile.role)} className={cls}>{enter}</Link>;
  const href = (await getIsAdminAccount()) ? "/admin" : "/onboarding";
  return <Link href={href} className={cls}>{enter}</Link>;
}
