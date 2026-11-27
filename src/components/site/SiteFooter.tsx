import Link from "next/link";
import { ThemeSelect } from "@/components/theme/ThemeSelect";
import { PRIVACY_PAGE, SITE_NAME, SITE_TAGLINE, SUPPORT_PAGE, TERMS_PAGE } from "@/lib/site";
import { FEATURES_PAGE, FOR_BRANDS_PAGE, FOR_CREATORS_PAGE, PRICING_PAGE } from "@/lib/site-nav";

const link = "inline-flex min-h-11 min-w-11 items-center text-sm text-muted hover:text-ink";

/** 公開頁共用的頁尾：三欄連結＋主題切換。 */
export function SiteFooter() {
  const cols: { title: string; links: { href: string; label: string }[] }[] = [
    { title: "產品", links: [{ href: "/creators", label: "找創作者" }, { href: FEATURES_PAGE, label: "功能" }, { href: PRICING_PAGE, label: "收費" }] },
    { title: "適合誰", links: [{ href: FOR_BRANDS_PAGE, label: "品牌" }, { href: FOR_CREATORS_PAGE, label: "創作者" }] },
    { title: "帳號與協助", links: [{ href: "/login", label: "登入" }, { href: "/signup", label: "註冊" }, { href: SUPPORT_PAGE, label: "需要協助？" }, { href: TERMS_PAGE, label: "服務條款" }, { href: PRIVACY_PAGE, label: "隱私權政策" }] },
  ];
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-12 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] md:px-16">
        <div>
          <p className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />{SITE_NAME}
          </p>
          <p className="mt-2 text-sm text-muted">{SITE_TAGLINE}</p>
          <div className="mt-4"><ThemeSelect /></div>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-sm font-bold text-ink">{c.title}</p>
            <ul className="mt-2">
              {c.links.map((l) => <li key={l.href}><Link href={l.href} className={link}>{l.label}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
