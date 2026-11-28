import Link from "next/link";
import { ThreadFallback } from "@/components/thread/ThreadFallback";
import { btn } from "@/components/ui/styles";
import { SearchBar } from "@/components/directory/SearchBar";
import { directoryHref } from "@/lib/creators/directory";
import { CategoryIcon } from "@/components/directory/CategoryIcon";
import { T } from "@/components/i18n/T";
import { optionLabel } from "@/lib/lang";
import { HERO_HEADLINE } from "@/lib/site";

/** 首頁搜尋列下方的捷徑（類別清單的前幾個） */
const QUICK = ["美妝", "保養", "美食", "旅遊", "穿搭", "親子", "寵物", "3C"];

/**
 * 主視覺：狀態徽章（badge，公開的創作者人數）→ 置中的大標 → 搜尋列 → 類別捷徑 → 創作者卡片（cards，沒有公開的創作者時不佔位置），
 * 都在第一屏。文字是伺服器渲染的 HTML（LCP 是大標），紅線在背景。
 */
export function Hero({ scene, cards, badge }: { scene?: React.ReactNode; cards?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate -mt-[68px] overflow-hidden md:-mt-[76px]">
      <div className="absolute inset-x-0 top-0 -z-10 h-[max(100svh,640px)]">{scene ?? <ThreadFallback variant="hero" />}</div>
      {/* 紅線在上半部，往下淡到底色，卡片與搜尋列才讀得清楚 */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-[max(100svh,640px)] bg-gradient-to-b from-transparent via-bg/40 to-bg" />
      <div aria-hidden="true" className="hero-glow absolute inset-x-0 top-0 -z-10 h-[720px]" />
      <div className="mx-auto w-full max-w-[1280px] px-5 pb-12 pt-28 md:px-16 md:pb-20 md:pt-36">
        <div className="mx-auto max-w-[900px] text-center">
          {badge}
          <h1 id="hero-title" className="font-serif text-[clamp(38px,5.4vw,72px)] font-black leading-[1.14] tracking-[-0.03em] text-ink [text-wrap:balance]">
            <span data-l="zh">
              {HERO_HEADLINE.split("，").map((part, i, a) => (
                <span key={part} className="block">{part}{i < a.length - 1 ? "，" : ""}</span>
              ))}
            </span>
            <span data-l="en" lang="en">
              <span className="block">The right brand,</span>
              <span className="block">tied to the right creator.</span>
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-[620px] text-base text-muted [text-wrap:pretty] md:text-lg">
            <T
              zh="在同一個地方找創作者、談條件、付款、交稿到撥款。款項由平台保管，交稿通過才撥出。"
              en="Find creators, agree terms, pay, review the work and release payment in one place. We hold the money until the work is approved."
            />
          </p>
        </div>
        <div className="mx-auto mt-8 max-w-[1040px] md:mt-10">
          <SearchBar />
          <nav aria-label="熱門類別" className="scroll-fade-x mt-3 flex gap-2 overflow-x-auto pb-1 md:justify-center">
            {QUICK.map((c) => (
              <Link key={c} href={directoryHref({ category: c })} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-btn border border-line bg-bg/60 px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:border-ink hover:bg-subtle">
                <CategoryIcon category={c} size={16} /><T {...optionLabel(c)} />
              </Link>
            ))}
          </nav>
        </div>
        {cards}
        <div className="mt-8 flex flex-col items-center gap-3 md:mt-10">
          <EntryButtons />
          <p className="text-sm text-muted">
            <T zh="已經有帳號？" en="Already have an account? " /><Link href="/login" className="inline-flex min-h-11 min-w-11 items-center justify-center font-bold text-ink underline underline-offset-4"><T zh="登入" en="Log in" /></Link>
          </p>
        </div>
      </div>
    </section>
  );
}

/** 兩個入口就是紅線的兩端：data-thread-pull 讓 3D 線往那一端收緊。 */
export function EntryButtons({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:flex ${className}`}>
      <Link href="/signup?role=brand" data-thread-pull="brand" className={btn.secondaryLg}><T zh="我是品牌" en="I'm a brand" /></Link>
      <Link href="/signup?role=creator" data-thread-pull="creator" className={btn.secondaryLg}><T zh="我是創作者" en="I'm a creator" /></Link>
    </div>
  );
}
