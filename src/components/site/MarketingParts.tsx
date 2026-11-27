import Link from "next/link";
import { Check } from "lucide-react";
import { btn } from "@/components/ui/styles";

/** 公開說明頁共用的區塊（功能、收費、給品牌、給創作者）。 */

export function PageHero({ title, body, primary, secondary }: {
  title: string; body: string; primary: { href: string; label: string }; secondary?: { href: string; label: string };
}) {
  return (
    <section className="mx-auto max-w-[1280px] px-5 pb-10 pt-12 md:px-16 md:pb-16 md:pt-20">
      <h1 className="max-w-[820px] font-serif text-[36px] font-black leading-[1.2] text-ink [text-wrap:balance] md:text-[52px]">{title}</h1>
      <p className="mt-5 max-w-[620px] text-base text-muted [text-wrap:pretty] md:text-lg">{body}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={primary.href} className={btn.primaryLg}>{primary.label}</Link>
        {secondary && <Link href={secondary.href} className={btn.secondaryLg}>{secondary.label}</Link>}
      </div>
    </section>
  );
}

/** 左文字右重點的一段；id 是頂列下拉選單的錨點。 */
export function FeatureBlock({ id, title, body, points }: { id?: string; title: string; body: string; points: string[] }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-line">
      <div className="mx-auto grid max-w-[1280px] gap-6 px-5 py-12 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-16 md:px-16 md:py-16">
        <div className="min-w-0">
          <h2 className="font-serif text-2xl font-bold text-ink [text-wrap:balance] md:text-[32px]">{title}</h2>
          <p className="mt-3 text-base text-muted [text-wrap:pretty]">{body}</p>
        </div>
        <ul className="min-w-0 divide-y divide-line border-y border-line">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 py-4 text-base text-ink">
              <Check size={18} strokeWidth={2} aria-hidden="true" className="mt-1 shrink-0 text-success" />
              <span className="min-w-0 [text-wrap:pretty]">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ClosingCta({ title, primary, secondary }: {
  title: string; primary: { href: string; label: string }; secondary?: { href: string; label: string };
}) {
  return (
    <section className="border-t border-line bg-panel">
      <div className="mx-auto max-w-[1280px] px-5 py-16 md:px-16 md:py-20">
        <h2 className="max-w-[720px] font-serif text-[28px] font-bold text-ink [text-wrap:balance] md:text-[40px]">{title}</h2>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={primary.href} className={btn.primaryLg}>{primary.label}</Link>
          {secondary && <Link href={secondary.href} className={btn.secondaryLg}>{secondary.label}</Link>}
        </div>
      </div>
    </section>
  );
}
