import Link from "next/link";
import { T } from "@/components/i18n/T";
import type { L } from "@/lib/lang";
import { PRIVACY_PAGE, SITE_NAME, SITE_TAGLINE, SUPPORT_PAGE, TERMS_PAGE } from "@/lib/site";
import { FEATURES_PAGE, FOR_BRANDS_PAGE, FOR_CREATORS_PAGE, PRICING_PAGE } from "@/lib/site-nav";

const link = "inline-flex min-h-11 min-w-11 items-center text-sm text-muted hover:text-ink";

/** 公開頁共用的頁尾：三欄連結。 */
export function SiteFooter() {
  const cols: { key: string; title: L; links: { href: string; label: L }[] }[] = [
    { key: "product", title: { zh: "產品", en: "Product" }, links: [
      { href: "/creators", label: { zh: "找創作者", en: "Find creators" } },
      { href: FEATURES_PAGE, label: { zh: "功能", en: "Features" } },
      { href: PRICING_PAGE, label: { zh: "收費", en: "Pricing" } },
    ] },
    { key: "audience", title: { zh: "適合誰", en: "Who it's for" }, links: [
      { href: FOR_BRANDS_PAGE, label: { zh: "品牌", en: "Brands" } },
      { href: FOR_CREATORS_PAGE, label: { zh: "創作者", en: "Creators" } },
    ] },
    { key: "account", title: { zh: "帳號與協助", en: "Account & help" }, links: [
      { href: "/login", label: { zh: "登入", en: "Log in" } },
      { href: "/signup", label: { zh: "註冊", en: "Sign up" } },
      { href: SUPPORT_PAGE, label: { zh: "需要協助？", en: "Help" } },
      { href: TERMS_PAGE, label: { zh: "服務條款", en: "Terms" } },
      { href: PRIVACY_PAGE, label: { zh: "隱私權政策", en: "Privacy" } },
    ] },
  ];
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-12 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] md:px-16">
        <div>
          <p className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />{SITE_NAME}
          </p>
          <p className="mt-2 text-sm text-muted"><T zh={SITE_TAGLINE} en="Where Taiwanese brands and creators work together" /></p>
        </div>
        {cols.map((c) => (
          <nav key={c.key} aria-labelledby={`foot-${c.key}`}>
            <p id={`foot-${c.key}`} className="text-sm font-bold text-ink"><T {...c.title} /></p>
            <ul className="mt-2">
              {c.links.map((l) => <li key={l.href}><Link href={l.href} className={link}><T {...l.label} /></Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
