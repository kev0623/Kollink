import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { safeNextPath } from "@/lib/auth/safe-next";
import { SITE_NAME } from "@/lib/site";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function LoginPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">登入 {SITE_NAME}</h1>
      <div className="mt-6">
        <Suspense fallback={null}>
          <Login searchParams={searchParams} />
        </Suspense>
      </div>
      <p className="mt-6 text-sm text-muted">
        還沒有帳號？<Link href="/signup" className="font-bold text-primary">註冊</Link>
      </p>
    </main>
  );
}

async function Login({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  return (
    <>
      {sp.error === "callback" && <p role="alert" className="mb-4 text-sm text-primary">登入沒有完成，請再試一次</p>}
      {sp.error === "profile" && <p role="alert" className="mb-4 text-sm text-primary">讀取帳號資料失敗，請再試一次</p>}
      <AuthForm role={null} next={next} googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"} />
    </>
  );
}
