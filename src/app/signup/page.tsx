import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { RolePicker } from "@/components/auth/RolePicker";
import { isRole } from "@/lib/auth/post-login";
import { safeNextPath } from "@/lib/auth/safe-next";
import { SITE_NAME } from "@/lib/site";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function SignupPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-bold">加入 {SITE_NAME}</h1>
      <div className="mt-6">
        <Suspense fallback={null}>
          <Signup searchParams={searchParams} />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <SwitchLink searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Signup({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const role = isRole(sp.role) ? sp.role : null;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  if (!role) {
    return (
      <>
        <p className="mb-4 text-muted">第 1 步：你是品牌還是創作者？</p>
        <RolePicker hrefFor={(r) => `/signup?role=${r}${next ? `&next=${encodeURIComponent(next)}` : ""}`} />
      </>
    );
  }
  return (
    <>
      <p className="mb-4 text-muted">
        第 2 步：以{role === "brand" ? "品牌" : "創作者"}身分註冊
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="ml-2 text-sm text-primary">更改</Link>
      </p>
      <div className="max-w-md">
        <AuthForm role={role} next={next} googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"} />
      </div>
    </>
  );
}

async function SwitchLink({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  return (
    <p className="mt-6 text-sm text-muted">
      已經有帳號？
      <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-bold text-primary">登入</Link>
    </p>
  );
}
