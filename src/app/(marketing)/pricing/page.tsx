import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { ClosingCta, PageHero } from "@/components/site/MarketingParts";
import { btn, textLink } from "@/components/ui/styles";
import { formatTwd } from "@/lib/format";
import { PAYMENT_MAX_TWD } from "@/lib/payments/limits";
import { SITE_NAME, TERMS_PAGE } from "@/lib/site";

export const metadata: Metadata = {
  title: "收費",
  description: `${SITE_NAME} 目前不收平台手續費：註冊、瀏覽、刊登招募都免費，創作者收到的金額就是合作案的報價。`,
  alternates: { canonical: "/pricing" },
};

// 與服務條款（/terms「目前不收取平台手續費」）一致；開始收費時兩邊要一起改。
const PLANS: { name: string; price: string; unit: string; items: string[]; cta: { href: string; label: string } }[] = [
  {
    name: "品牌", price: "NT$0", unit: "平台手續費",
    items: ["瀏覽與搜尋創作者", "刊登招募、收報名", "站內訊息", "款項保管與交稿審核", "合作完成後的評價"],
    cta: { href: "/signup?role=brand", label: "註冊品牌帳號" },
  },
  {
    name: "創作者", price: "NT$0", unit: "平台手續費",
    items: ["公開頁（作品、報價、評價）", "報名招募、接受邀請", "站內訊息", "報價全額撥款", "收入紀錄"],
    cta: { href: "/signup?role=creator", label: "成為創作者" },
  },
];

const NOTES: { q: string; a: string }[] = [
  { q: "那品牌實際要付多少？", a: "就是合作案上寫的金額。這筆錢全額撥給創作者，平台目前不從中抽成。" },
  { q: "付款方式有哪些？", a: `信用卡或 ATM 轉帳（綠界）。單筆超過 ${formatTwd(PAYMENT_MAX_TWD)} 的合作案無法線上付款，請聯絡平台安排線下匯款。` },
  { q: "之後會開始收費嗎？", a: "有可能。如果要收，會事先公告並取得你的同意，已經成立的合作案不受影響。" },
  { q: "創作者收款要付轉帳手續費嗎？", a: "不用。平台以銀行轉帳撥款，撥款金額就是合作案的報價。" },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        title="目前不收平台手續費"
        body="註冊、瀏覽創作者、刊登招募都免費。品牌付的金額就是合作案的報價，全額撥給創作者。"
        primary={{ href: "/signup", label: "免費註冊" }} secondary={{ href: "/creators", label: "找創作者" }}
      />
      <section className="mx-auto grid max-w-[1280px] gap-4 px-5 pb-12 md:grid-cols-2 md:gap-6 md:px-16 md:pb-20">
        {PLANS.map((p) => (
          <div key={p.name} className="rounded-card border border-line bg-surface p-6 md:p-8">
            <h2 className="text-lg font-bold text-ink">{p.name}</h2>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-sans text-5xl font-bold tabular-nums text-ink">{p.price}</span>
              <span className="text-sm text-muted">{p.unit}</span>
            </p>
            <ul className="mt-6 space-y-3">
              {p.items.map((it) => (
                <li key={it} className="flex items-start gap-2 text-sm text-ink">
                  <Check size={16} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />{it}
                </li>
              ))}
            </ul>
            <Link href={p.cta.href} className={`${btn.secondary} mt-8 w-full`}>{p.cta.label}</Link>
          </div>
        ))}
      </section>
      <section aria-labelledby="pricing-notes" className="border-t border-line">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-12 md:px-16 md:py-16 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
          <h2 id="pricing-notes" className="font-serif text-2xl font-bold text-ink md:text-[32px]">關於費用</h2>
          <dl className="divide-y divide-line border-y border-line">
            {NOTES.map((n) => (
              <div key={n.q} className="py-5">
                <dt className="text-base font-bold text-ink">{n.q}</dt>
                <dd className="mt-1 text-sm text-muted [text-wrap:pretty]">{n.a}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="mx-auto max-w-[1280px] px-5 pb-12 text-sm text-muted md:px-16">
          完整的規則寫在<Link href={TERMS_PAGE} className={`${textLink} mx-1`}>服務條款</Link>。
        </p>
      </section>
      <ClosingCta title="不用錢，先試一個合作" primary={{ href: "/signup", label: "免費註冊" }} />
    </>
  );
}
