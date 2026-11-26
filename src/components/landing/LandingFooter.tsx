import Link from "next/link";
import { ThemeSelect } from "@/components/theme/ThemeSelect";
import { SITE_NAME, SITE_TAGLINE, SUPPORT_PAGE } from "@/lib/site";
import { EntryButtons } from "./Hero";

export function LandingFooter() {
  const link = "inline-flex min-h-11 items-center text-sm text-muted hover:text-ink";
  return (
    <>
      <section aria-labelledby="closing-title" className="mx-auto max-w-[1280px] px-5 py-20 md:px-16 md:py-28">
        <h2 id="closing-title" className="font-serif text-[28px] font-bold text-ink md:text-[40px]">下一條線，可能就是你的。</h2>
        <EntryButtons className="mt-8 max-w-md" />
      </section>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-16">
          <p className="text-sm text-muted">
            <span className="font-extrabold text-ink">{SITE_NAME}</span>・{SITE_TAGLINE}
          </p>
          <nav aria-label="頁尾" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href={SUPPORT_PAGE} className={link}>需要協助？</Link>
            <Link href="/login" className={link}>登入</Link>
            <Link href="/signup" className={link}>註冊</Link>
            <ThemeSelect />
          </nav>
        </div>
      </footer>
    </>
  );
}
