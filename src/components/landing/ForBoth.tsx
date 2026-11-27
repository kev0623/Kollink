import Link from "next/link";
import { T } from "@/components/i18n/T";
import { btn } from "@/components/ui/styles";
import type { L } from "@/lib/lang";

const BRAND: L[] = [
  { zh: "每位創作者都經過人工審核，才會出現在廣場。", en: "Every creator is reviewed by a person before they are listed." },
  { zh: "登入後看得到粉絲數、互動率、作品與報價，用類別與地區篩選。", en: "Once logged in, see follower counts, engagement, work and rates, and filter by category and region." },
  { zh: "一個招募收齊報名，錄取、婉拒都在同一頁。", en: "One brief collects every application; accept or decline on the same page." },
  { zh: "合作進度一條線看到底，現在輪到誰一眼就知道。", en: "Each collaboration is one line from start to finish, so you always know whose turn it is." },
];
const CREATOR: L[] = [
  { zh: "一個公開頁放作品與報價；粉絲數與帳號連結登入後才顯示。", en: "One public page for your work and rates; follower count and account links are shown only to logged-in users." },
  { zh: "品牌找上門，或自己報名有興趣的招募。", en: "Brands come to you, or you apply to briefs you like." },
  { zh: "品牌付款後才開始工作；交稿通過、發佈後撥款。", en: "You start only after the brand has paid; you are paid once the work is approved and posted." },
  { zh: "撥款金額就是合作案報價，目前平台不收手續費。", en: "You receive the full agreed amount. There is currently no platform fee." },
];

function Column({ id, title, items, cta }: { id: string; title: L; items: L[]; cta: { href: string; label: L } }) {
  return (
    <div className="min-w-0">
      <h2 id={id} className="font-serif text-2xl font-bold text-ink"><T {...title} /></h2>
      <ul aria-labelledby={id} className="mt-4 divide-y divide-line border-y border-line">
        {items.map((t) => <li key={t.zh} className="py-4 text-base text-ink [text-wrap:pretty]"><T {...t} /></li>)}
      </ul>
      <Link href={cta.href} className={`${btn.secondary} mt-6`}><T {...cta.label} /></Link>
    </div>
  );
}

export function ForBoth() {
  return (
    <section aria-labelledby="for-brand for-creator" className="mx-auto max-w-[1280px] px-5 py-14 md:px-16 md:py-28">
      <div className="grid gap-12 lg:grid-cols-[1fr_1px_1fr] lg:gap-16">
        <Column id="for-brand" title={{ zh: "給品牌", en: "For brands" }} items={BRAND} cta={{ href: "/signup?role=brand", label: { zh: "註冊品牌帳號", en: "Create a brand account" } }} />
        <div aria-hidden="true" className="hidden bg-thread opacity-60 lg:block" />
        <Column id="for-creator" title={{ zh: "給創作者", en: "For creators" }} items={CREATOR} cta={{ href: "/signup?role=creator", label: { zh: "成為創作者", en: "Join as a creator" } }} />
      </div>
    </section>
  );
}
