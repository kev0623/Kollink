import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { LineLinkForm } from "@/components/auth/LineLinkForm";
import { isLineVerifyState, lineErrorMessage } from "@/lib/auth/line/messages";
import { AuthShell } from "@/components/auth/AuthShell";
import { DevLoginBox } from "@/components/auth/DevLoginBox";
import { safeNextPath } from "@/lib/auth/safe-next";
import { Skeleton } from "@/components/ui/Skeleton";
import { Notice } from "@/components/ui/Notice";
import { textLink } from "@/components/ui/styles";

type SP = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = { title: "登入" };

export default function LoginPage({ searchParams }: { searchParams: SP }) {
  return (
    <AuthShell>
      <h1 className="font-serif text-[28px] font-bold text-ink">登入</h1>
      <p className="mt-2 text-sm text-muted">我們會寄一組驗證碼到你的信箱，不用記密碼。</p>
      <div className="mt-6">
        <Suspense fallback={<Skeleton className="h-[188px] w-full" />}>
          <Login searchParams={searchParams} />
        </Suspense>
      </div>
      <DevLoginBox />
      <Suspense fallback={null}>
        <SwitchLink searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function Login({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const lineEnabled = process.env.NEXT_PUBLIC_LINE_AUTH_ENABLED === "true";
  // LINE 登入後要用 Email 驗證碼確認（/auth/line/callback 導過來）
  if (lineEnabled && isLineVerifyState(sp.line)) return <LineLinkForm onCancelHref="/login" />;
  const lineError = lineErrorMessage(sp.error);
  return (
    <>
      {sp.error === "callback" && <Notice tone="danger" className="mb-4">登入沒有完成，請再試一次</Notice>}
      {sp.error === "profile" && <Notice tone="danger" className="mb-4">讀取帳號資料失敗，請再試一次</Notice>}
      {lineError && <Notice tone="danger" className="mb-4">{lineError}</Notice>}
      <AuthForm role={null} next={next} googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"} lineEnabled={lineEnabled} />
    </>
  );
}

async function SwitchLink({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2 text-sm text-muted">
      還沒有帳號？
      <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className={textLink}>註冊</Link>
    </p>
  );
}
