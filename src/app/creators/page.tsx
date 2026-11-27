import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CREATOR_GRID, CreatorCard } from "@/components/directory/CreatorCard";
import { SearchBar } from "@/components/directory/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkPending } from "@/components/ui/LinkPending";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { btn, chip, h1 } from "@/components/ui/styles";
import {
  directorySortsFor, PUBLIC_CREATORS_PAGE_SIZE, directoryHeading, directoryHref, hasDirectoryFilter, parseDirectoryQuery,
  type DirectoryQuery,
} from "@/lib/creators/directory";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadPublicCreators } from "@/lib/creators/directory-load";
import { formatNumber } from "@/lib/format";
import { CATEGORIES } from "@/lib/options";
import { pageOverflow } from "@/lib/paging";
import { SITE_NAME } from "@/lib/site";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = {
  title: "找創作者",
  description: `瀏覽 ${SITE_NAME} 上通過審核的台灣 IG 創作者，依類別、地區、粉絲數與評價篩選。`,
  alternates: { canonical: "/creators" },
};

export default function CreatorsPage({ searchParams }: Props) {
  return (
    <div className="pt-4 md:pt-8">
      <h1 className={h1}>找創作者</h1>
      <p className="mt-2 max-w-[560px] text-sm text-muted">每一位都經過平台人工審核，作品與報價公開。粉絲數登入後顯示；邀請合作需要品牌帳號，註冊免費。</p>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: Props) {
  const q = parseDirectoryQuery(await searchParams);
  const [me, { items, total }] = await Promise.all([getCurrentUser(), loadPublicCreators(q)]);
  // 網址的頁數超過最後一頁：改到最後一頁
  const last = pageOverflow(q.page, total, PUBLIC_CREATORS_PAGE_SIZE);
  if (last !== null) redirect(directoryHref({ ...q, page: last }));
  const with_ = (over: Partial<DirectoryQuery>) => directoryHref({ ...q, page: 1, ...over });
  return (
    <>
      <div className="mt-6"><SearchBar q={q.q} category={q.category} /></div>
      <nav aria-label="類別" className="scroll-fade-x mt-3 flex gap-2 overflow-x-auto pb-1">
        <Link href={with_({ category: null })} aria-current={q.category === null ? "page" : undefined} className={chip(q.category === null)}>全部<LinkPending /></Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={with_({ category: c })} aria-current={q.category === c ? "page" : undefined} className={chip(q.category === c)}>
            {c}<LinkPending />
          </Link>
        ))}
      </nav>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h2 className="min-w-0 break-words text-lg font-bold text-ink">
          {directoryHeading(q)}<span className="ml-2 text-sm font-normal tabular-nums text-muted">{formatNumber(total)} 位</span>
        </h2>
        <nav aria-label="排序" className="flex gap-1 text-sm">
          {directorySortsFor(me !== null).map((s) => (
            <Link
              key={s.value} href={with_({ sort: s.value })} aria-current={q.sort === s.value ? "true" : undefined}
              className={`inline-flex min-h-11 items-center rounded-btn px-3 font-semibold ${q.sort === s.value ? "bg-subtle text-ink" : "text-muted hover:text-ink"}`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-3">
        {items.length === 0 ? (
          hasDirectoryFilter(q)
            ? <EmptyState text="沒有符合條件的創作者。換個關鍵字，或清除篩選看全部。" action={{ href: directoryHref({ sort: q.sort }), label: "清除篩選" }} />
            : <EmptyState text="目前還沒有公開的創作者。你是創作者嗎？現在加入，通過審核後就會出現在這裡。" action={{ href: "/signup?role=creator", label: "成為創作者" }} />
        ) : (
          <ul className={CREATOR_GRID}>
            {items.map((c, i) => <li key={c.handle} className="min-w-0"><CreatorCard c={c} priority={i < 4} /></li>)}
          </ul>
        )}
      </div>
      <Pagination
        page={q.page} total={total} size={PUBLIC_CREATORS_PAGE_SIZE} unit="位" label="創作者分頁"
        hrefFor={(p) => directoryHref({ ...q, page: p })}
      />
      <aside aria-labelledby="dir-cta" className="mt-12 rounded-card border border-line bg-panel p-6 md:flex md:items-center md:justify-between md:gap-8 md:p-8">
        <div className="min-w-0">
          <h2 id="dir-cta" className="font-serif text-xl font-bold text-ink md:text-2xl">找到適合的人了嗎？</h2>
          <p className="mt-2 text-sm text-muted">註冊品牌帳號就能看粉絲數、直接邀請，或刊登招募讓創作者來報名。款項由平台保管，交稿通過才撥出。</p>
        </div>
        <div className="mt-5 flex shrink-0 flex-wrap gap-3 md:mt-0">
          <Link href="/signup?role=brand" className={btn.primary}>註冊品牌帳號</Link>
          <Link href="/signup?role=creator" className={btn.secondary}>我是創作者</Link>
        </div>
      </aside>
    </>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-busy="true" className="mt-6">
      <p className="sr-only">載入中…</p>
      <Skeleton className="h-[60px] w-full rounded-btn" />
      <Skeleton className="mt-3 h-11 w-full" />
      <div className={`${CREATOR_GRID} mt-16`}>
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-[4/6] w-full rounded-card" />)}
      </div>
    </div>
  );
}
