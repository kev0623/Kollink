import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { T } from "@/components/i18n/T";
import { ClosingCta, CTA, PageHero, type Cta } from "@/components/site/MarketingParts";
import { btn, textLink } from "@/components/ui/styles";
import { formatTwd } from "@/lib/format";
import type { L } from "@/lib/lang";
import { PAYMENT_MAX_TWD } from "@/lib/payments/limits";
import { SITE_NAME, TERMS_PAGE } from "@/lib/site";

export const metadata: Metadata = {
  title: "收費",
  description: `${SITE_NAME} 目前不收平台手續費：註冊、瀏覽、刊登招募都免費，創作者收到的金額就是合作案的報價。`,
  alternates: { canonical: "/pricing" },
};

const FEE: L = { zh: "平台手續費", en: "platform fee" };

// 與服務條款（/terms「目前不收取平台手續費」）一致；開始收費時兩邊要一起改。
const PLANS: { name: L; items: L[]; cta: Cta }[] = [
  {
    name: { zh: "品牌", en: "Brands" },
    items: [
      { zh: "瀏覽與搜尋創作者", en: "Browse and search creators" }, { zh: "刊登招募、收報名", en: "Post briefs and receive applications" },
      { zh: "站內訊息", en: "Messaging" }, { zh: "款項保管與交稿審核", en: "Held payments and delivery approval" },
      { zh: "合作完成後的評價", en: "Reviews after each collaboration" },
    ],
    cta: CTA.brandSignup,
  },
  {
    name: { zh: "創作者", en: "Creators" },
    items: [
      { zh: "公開頁（作品、報價、評價）", en: "Public page (work, rates, reviews)" }, { zh: "報名招募、接受邀請", en: "Apply to briefs and accept invitations" },
      { zh: "站內訊息", en: "Messaging" }, { zh: "報價全額撥款", en: "Paid the full agreed amount" }, { zh: "收入紀錄", en: "Earnings history" },
    ],
    cta: CTA.creatorSignup,
  },
];

const LIMIT = formatTwd(PAYMENT_MAX_TWD);
const NOTES: { q: L; a: L }[] = [
  {
    q: { zh: "那品牌實際要付多少？", en: "So what does a brand actually pay?" },
    a: { zh: "就是合作案上寫的金額。這筆錢全額撥給創作者，平台目前不從中抽成。", en: "Exactly the amount on the collaboration. All of it goes to the creator; we currently take no cut." },
  },
  {
    q: { zh: "付款方式有哪些？", en: "How can I pay?" },
    a: { zh: `信用卡或 ATM 轉帳（綠界）。單筆超過 ${LIMIT} 的合作案無法線上付款，請聯絡平台安排線下匯款。`, en: `Credit card or ATM transfer (ECPay). Collaborations over ${LIMIT} can't be paid online; contact us to arrange a bank transfer.` },
  },
  {
    q: { zh: "之後會開始收費嗎？", en: "Will you start charging later?" },
    a: { zh: "有可能。如果要收，會事先公告並取得你的同意，已經成立的合作案不受影響。", en: "Possibly. If we do, we will announce it and ask for your consent first, and existing collaborations won't be affected." },
  },
  {
    q: { zh: "創作者收款要付轉帳手續費嗎？", en: "Do creators pay a transfer fee?" },
    a: { zh: "不用。平台以銀行轉帳撥款，撥款金額就是合作案的報價。", en: "No. We pay by bank transfer, and you receive the full agreed amount." },
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        title={{ zh: "目前不收平台手續費", en: "No platform fee, for now" }}
        body={{ zh: "註冊、瀏覽創作者、刊登招募都免費。品牌付的金額就是合作案的報價，全額撥給創作者。", en: "Signing up, browsing creators and posting briefs are free. What the brand pays is the agreed amount, and all of it goes to the creator." }}
        primary={CTA.signup} secondary={CTA.findCreators}
      />
      <section className="mx-auto grid max-w-[1280px] gap-4 px-5 pb-12 md:grid-cols-2 md:gap-6 md:px-16 md:pb-20">
        {PLANS.map((p) => (
          <div key={p.name.zh} className="rounded-card border border-line bg-surface p-6 md:p-8">
            <h2 className="text-lg font-bold text-ink"><T {...p.name} /></h2>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-sans text-5xl font-bold tabular-nums text-ink">NT$0</span>
              <span className="text-sm text-muted"><T {...FEE} /></span>
            </p>
            <ul className="mt-6 space-y-3">
              {p.items.map((it) => (
                <li key={it.zh} className="flex items-start gap-2 text-sm text-ink">
                  <Check size={16} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-success" /><span><T {...it} /></span>
                </li>
              ))}
            </ul>
            <Link href={p.cta.href} className={`${btn.secondary} mt-8 w-full`}><T {...p.cta.label} /></Link>
          </div>
        ))}
      </section>
      <section aria-labelledby="pricing-notes" className="border-t border-line">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-12 md:px-16 md:py-16 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
          <h2 id="pricing-notes" className="font-serif text-2xl font-bold text-ink md:text-[32px]"><T zh="關於費用" en="About fees" /></h2>
          <dl className="divide-y divide-line border-y border-line">
            {NOTES.map((n) => (
              <div key={n.q.zh} className="py-5">
                <dt className="text-base font-bold text-ink"><T {...n.q} /></dt>
                <dd className="mt-1 text-sm text-muted [text-wrap:pretty]"><T {...n.a} /></dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="mx-auto max-w-[1280px] px-5 pb-12 text-sm text-muted md:px-16">
          <T zh="完整的規則寫在" en="The full rules are in the " /><Link href={TERMS_PAGE} className={`${textLink} mx-1`}><T zh="服務條款" en="Terms of Service" /></Link><T zh="。" en=" (Chinese only)." />
        </p>
      </section>
      <ClosingCta title={{ zh: "不用錢，先試一個合作", en: "It's free. Try one collaboration." }} primary={CTA.signup} />
    </>
  );
}
