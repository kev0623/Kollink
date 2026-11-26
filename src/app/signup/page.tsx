import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";
import { RolePicker } from "@/components/auth/RolePicker";
import { isRole } from "@/lib/auth/post-login";
import { safeNextPath } from "@/lib/auth/safe-next";
import { SITE_NAME } from "@/lib/site";
import { Skeleton } from "@/components/ui/Skeleton";
import { textLink } from "@/components/ui/styles";

type SP = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = { title: "註冊" };

export default function SignupPage({ searchParams }: { searchParams: SP }) {
  return (
    <AuthShell>
      <h1 className="font-serif text-[28px] font-bold text-ink">{`加入 ${SITE_NAME}`}</h1>
      <div className="mt-4">
        <Suspense fallback={<Skeleton className="h-[188px] w-full" />}>
          <Signup searchParams={searchParams} />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <SwitchLink searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function Signup({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const role = isRole(sp.role) ? sp.role : null;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  if (!role) {
    return (
      <>
        <p className="mb-4 text-sm text-muted">先選身分，下一步建立帳號。</p>
        <RolePicker hrefFor={(r) => `/signup?role=${r}${next ? `&next=${encodeURIComponent(next)}` : ""}`} />
      </>
    );
  }
  return (
    <>
      <p className="mb-4 flex flex-wrap items-center gap-x-2 text-sm text-muted">
        以{role === "brand" ? "品牌" : "創作者"}身分註冊
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className={textLink}>更改身分</Link>
      </p>
      <AuthForm
        role={role} next={next} googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"}
        lineEnabled={process.env.NEXT_PUBLIC_LINE_AUTH_ENABLED === "true"}
      />
    </>
  );
}

async function SwitchLink({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2 text-sm text-muted">
      已經有帳號？
      <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className={textLink}>登入</Link>
    </p>
  );
}
