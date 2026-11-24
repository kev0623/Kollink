import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">{SITE_NAME}</h1>
      <p className="mt-2 text-muted">{SITE_TAGLINE}</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link href="/signup?role=brand" className="rounded-card border border-line bg-surface p-6 shadow-sm hover:border-primary">
          <p className="text-lg font-bold">我是品牌</p>
          <p className="mt-1 text-sm text-muted">找到適合的創作者，安心付款、追蹤每一步進度。</p>
        </Link>
        <Link href="/signup?role=creator" className="rounded-card border border-line bg-surface p-6 shadow-sm hover:border-primary">
          <p className="text-lg font-bold">我是創作者</p>
          <p className="mt-1 text-sm text-muted">接到品牌合作，款項由平台託管，完成就撥款。</p>
        </Link>
      </div>
      <p className="mt-8 text-sm text-muted">
        已經有帳號？<Link href="/login" className="font-bold text-primary">登入</Link>
      </p>
    </main>
  );
}
