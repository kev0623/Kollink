import Link from "next/link";
import { ThreadFallback } from "@/components/thread/ThreadFallback";
import { btn } from "@/components/ui/styles";
import { HERO_HEADLINE } from "@/lib/site";

/** 主視覺（規格 §5.1）：文字是伺服器渲染的 HTML（LCP 是大標），紅線在背景。 */
export function Hero({ scene }: { scene?: React.ReactNode }) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate flex min-h-[max(100svh,640px)] items-end overflow-hidden">
      <div className="absolute inset-0 -z-10">{scene ?? <ThreadFallback variant="hero" />}</div>
      <div className="mx-auto w-full max-w-[1280px] px-5 pb-10 md:px-16 md:pb-16">
        <div className="max-w-[640px]">
          <h1 id="hero-title" className="font-serif text-[40px] font-black leading-[1.15] text-ink md:text-[56px] xl:text-[64px]">
            {HERO_HEADLINE.split("，").map((part, i, a) => (
              <span key={part} className="block">{part}{i < a.length - 1 ? "，" : ""}</span>
            ))}
          </h1>
          <p className="mt-5 max-w-[520px] text-base text-muted md:text-lg">
            Kollink 是台灣品牌與 IG 創作者的合作平台。找人、談條件、付款、交稿到撥款，每一步都在同一條線上。
          </p>
          <EntryButtons className="mt-8" />
          <p className="mt-4 text-sm text-muted">
            已經有帳號？<Link href="/login" className="inline-flex min-h-11 items-center font-bold text-ink underline underline-offset-4">登入</Link>
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
      <Link href="/signup?role=brand" data-thread-pull="brand" className={btn.primaryLg}>我是品牌</Link>
      <Link href="/signup?role=creator" data-thread-pull="creator" className={btn.secondaryLg}>我是創作者</Link>
    </div>
  );
}
