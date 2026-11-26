import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const metadata: Metadata = { title: { absolute: `${SITE_NAME}｜${SITE_TAGLINE}` } };

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:py-16">
      <div className="rounded-card border border-line bg-surface p-5 md:p-12">
        <h1 className="text-[32px] font-bold leading-tight text-ink md:text-5xl">{SITE_NAME}</h1>
        <p className="mt-3 text-muted">{SITE_TAGLINE}</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link href="/signup?role=brand" className="rounded-card bg-ink p-6 text-on-ink md:p-8">
            <p className="text-lg font-bold">我是品牌</p>
            <p className="mt-1 text-sm opacity-80">找到適合的創作者，安心付款、追蹤每一步進度。</p>
          </Link>
          <Link href="/signup?role=creator" className="rounded-card border border-line bg-surface p-6 text-ink hover:bg-subtle md:p-8">
            <p className="text-lg font-bold">我是創作者</p>
            <p className="mt-1 text-sm text-muted">接到品牌合作，款項由平台託管，完成就撥款。</p>
          </Link>
        </div>
        <p className="mt-8 text-sm text-muted">
          已經有帳號？<Link href="/login" className="font-semibold text-ink underline">登入</Link>
        </p>
      </div>
    </main>
  );
}
