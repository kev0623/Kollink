import type { Metadata } from "next";
import { ClosingCta, CTA, FeatureBlock, PageHero } from "@/components/site/MarketingParts";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "給創作者",
  description: `IG 創作者在 ${SITE_NAME} 建立公開頁、接品牌邀約或報名招募，品牌先付款才開始製作。`,
  alternates: { canonical: "/for-creators" },
};

export default function ForCreatorsPage() {
  return (
    <>
      <PageHero
        title={{ zh: "品牌先付款，你才開始做", en: "The brand pays first. Then you start." }}
        body={{ zh: "合作款項在你動工之前就已經交給平台保管。交稿通過、發佈貼文之後，平台把報價全額轉給你。", en: "The money is with us before you begin. Once your work is approved and posted, we transfer the full agreed amount to you." }}
        primary={CTA.creatorSignup} secondary={{ href: "/features", label: { zh: "看功能", en: "See features" } }}
      />
      <FeatureBlock
        title={{ zh: "一個公開頁，放你的作品與報價", en: "One public page for your work and rates" }}
        body={{ zh: "通過審核後，你的頁面會出現在公開的創作者列表，品牌搜尋得到。", en: "Once approved, your page appears in the public creator directory where brands can find it." }}
        points={[
          { zh: "放作品、類別、風格標籤與互動率；粉絲數與貼文連結只給登入的人看", en: "Show your work, categories, style tags and engagement; follower count and post links are for logged-in users only" },
          { zh: "各種合作形式分開報價，報價是公開的", en: "Price each collaboration type separately; rates are public" },
          { zh: "合作完成後累積的評價會顯示在頁面上", en: "Reviews from finished collaborations build up on your page" },
        ]}
      />
      <FeatureBlock
        title={{ zh: "案子兩種來源", en: "Two ways to get work" }}
        body={{ zh: "等品牌邀請，或是自己去報名。", en: "Wait to be invited, or go and apply." }}
        points={[
          { zh: "品牌直接邀請你：條件不合適可以婉拒", en: "Brands invite you directly, and you can decline if the terms don't fit" },
          { zh: "瀏覽品牌刊登的招募，報名時附上你的報價", en: "Browse briefs from brands and apply with your own price" },
          { zh: "系統會標出你符合哪些招募的條件", en: "We show which briefs you qualify for" },
        ]}
      />
      <FeatureBlock
        title={{ zh: "不會做白工", en: "No unpaid work" }}
        body={{ zh: "付款、審核和撥款都有規則，不用自己催。", en: "Payment, approval and payout follow set rules, so you don't have to chase." }}
        points={[
          { zh: "品牌付款之後才進入交稿階段", en: "Delivery begins only after the brand has paid" },
          { zh: "品牌 3 天沒有審核，系統自動通過", en: "If the brand doesn't review within 3 days, your work is approved automatically" },
          { zh: "撥款金額就是合作案的報價，目前平台不收手續費", en: "You receive the full agreed amount; there is currently no platform fee" },
          { zh: "收入頁看得到每一筆合作的款項狀態", en: "Your earnings page shows the payment status of every collaboration" },
        ]}
      />
      <FeatureBlock
        title={{ zh: "怎麼加入", en: "How to join" }}
        body={{ zh: "註冊免費，審核由平台人工處理。", en: "Signing up is free, and a person on our team reviews each application." }}
        points={[
          { zh: "用 Email、Google 或 LINE 註冊，填 IG 帳號與基本資料", en: "Sign up with email, Google or LINE, and add your Instagram account and basics" },
          { zh: "把平台給的驗證碼放進 IG 自我介紹，證明帳號是你的", en: "Put the code we give you in your Instagram bio to prove the account is yours" },
          { zh: "通過審核後就能報名招募、接受邀請", en: "Once approved, you can apply to briefs and accept invitations" },
        ]}
      />
      <ClosingCta title={{ zh: "把你的頁面放上來", en: "Put your page up" }} primary={CTA.creatorSignup} />
    </>
  );
}
