import Link from "next/link";
import { Check } from "lucide-react";
import { T } from "@/components/i18n/T";
import { btn } from "@/components/ui/styles";
import type { L } from "@/lib/lang";

/** 公開說明頁共用的區塊（功能、收費、給品牌、給創作者）。文字都是雙語（L）。 */
export type Cta = { href: string; label: L };

export function PageHero({ title, body, primary, secondary }: { title: L; body: L; primary: Cta; secondary?: Cta }) {
  return (
    <section className="relative isolate mx-auto max-w-[1280px] px-5 pb-10 pt-12 md:px-16 md:pb-20 md:pt-24">
      <div aria-hidden="true" className="hero-glow absolute inset-x-0 -top-20 -z-10 h-[420px]" />
      <h1 className="max-w-[880px] font-serif text-[36px] font-black leading-[1.15] tracking-[-0.01em] text-ink md:text-[60px]"><T {...title} /></h1>
      <p className="mt-5 max-w-[620px] text-base text-muted [text-wrap:pretty] md:text-lg"><T {...body} /></p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={primary.href} className={btn.primaryLg}><T {...primary.label} /></Link>
        {secondary && <Link href={secondary.href} className={btn.secondaryLg}><T {...secondary.label} /></Link>}
      </div>
    </section>
  );
}

/** 左文字右重點的一段；id 是頂列下拉選單的錨點。 */
export function FeatureBlock({ id, title, body, points }: { id?: string; title: L; body: L; points: L[] }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-line">
      <div className="mx-auto grid max-w-[1280px] gap-6 px-5 py-12 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-16 md:px-16 md:py-16">
        <div className="reveal min-w-0">
          <h2 className="font-serif text-2xl font-bold text-ink md:text-[36px]"><T {...title} /></h2>
          <p className="mt-3 text-base text-muted [text-wrap:pretty]"><T {...body} /></p>
        </div>
        <ul className="reveal min-w-0 divide-y divide-line border-y border-line">
          {points.map((p) => (
            <li key={p.zh} className="flex items-start gap-3 py-4 text-base text-ink">
              <Check size={18} strokeWidth={2} aria-hidden="true" className="mt-1 shrink-0 text-success" />
              <span className="min-w-0 [text-wrap:pretty]"><T {...p} /></span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ClosingCta({ title, primary, secondary }: { title: L; primary: Cta; secondary?: Cta }) {
  return (
    <section className="border-t border-line bg-panel">
      <div className="mx-auto max-w-[1280px] px-5 py-16 md:px-16 md:py-20">
        <h2 className="max-w-[720px] font-serif text-[28px] font-bold text-ink [text-wrap:balance] md:text-[40px]"><T {...title} /></h2>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={primary.href} className={btn.primaryLg}><T {...primary.label} /></Link>
          {secondary && <Link href={secondary.href} className={btn.secondaryLg}><T {...secondary.label} /></Link>}
        </div>
      </div>
    </section>
  );
}

// 常用的按鈕文字
export const CTA = {
  findCreators: { href: "/creators", label: { zh: "找創作者", en: "Find creators" } },
  signup: { href: "/signup", label: { zh: "免費註冊", en: "Sign up free" } },
  brandSignup: { href: "/signup?role=brand", label: { zh: "註冊品牌帳號", en: "Create a brand account" } },
  creatorSignup: { href: "/signup?role=creator", label: { zh: "成為創作者", en: "Join as a creator" } },
} satisfies Record<string, Cta>;
