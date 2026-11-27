import Link from "next/link";
import { btn } from "@/components/ui/styles";

const BRAND = [
  "每位創作者都經過人工審核，才會出現在廣場。",
  "登入後看得到粉絲數、互動率、作品與報價，用類別與地區篩選。",
  "一個招募收齊報名，錄取、婉拒都在同一頁。",
  "合作進度一條線看到底，現在輪到誰一眼就知道。",
];
const CREATOR = [
  "一個公開頁放作品與報價；粉絲數與帳號連結登入後才顯示。",
  "品牌找上門，或自己報名有興趣的招募。",
  "品牌付款後才開始工作；交稿通過、發佈後撥款。",
  "撥款金額就是合作案報價，目前平台不收手續費。",
];

function Column({ id, title, items, cta }: { id: string; title: string; items: string[]; cta: { href: string; label: string } }) {
  return (
    <div className="min-w-0">
      <h2 id={id} className="font-serif text-2xl font-bold text-ink">{title}</h2>
      <ul aria-labelledby={id} className="mt-4 divide-y divide-line border-y border-line">
        {items.map((t) => <li key={t} className="py-4 text-base text-ink [text-wrap:pretty]">{t}</li>)}
      </ul>
      <Link href={cta.href} className={`${btn.secondary} mt-6`}>{cta.label}</Link>
    </div>
  );
}

export function ForBoth() {
  return (
    <section aria-label="品牌與創作者各得到什麼" className="mx-auto max-w-[1280px] px-5 py-14 md:px-16 md:py-28">
      <div className="grid gap-12 lg:grid-cols-[1fr_1px_1fr] lg:gap-16">
        <Column id="for-brand" title="給品牌" items={BRAND} cta={{ href: "/signup?role=brand", label: "註冊品牌帳號" }} />
        <div aria-hidden="true" className="hidden bg-thread opacity-60 lg:block" />
        <Column id="for-creator" title="給創作者" items={CREATOR} cta={{ href: "/signup?role=creator", label: "成為創作者" }} />
      </div>
    </section>
  );
}
