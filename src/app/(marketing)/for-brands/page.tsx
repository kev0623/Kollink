import type { Metadata } from "next";
import { ClosingCta, CTA, FeatureBlock, PageHero } from "@/components/site/MarketingParts";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "給品牌",
  description: `品牌在 ${SITE_NAME} 找通過審核的 IG 創作者、刊登招募、付款與驗收。`,
  alternates: { canonical: "/for-brands" },
};

export default function ForBrandsPage() {
  return (
    <>
      <PageHero
        title={{ zh: "找到對的創作者，錢在驗收之後才出去", en: "Find the right creator, and pay out only after you approve" }}
        body={{ zh: "每位創作者都經過人工審核。你付的款項由平台保管，創作者交稿通過、貼文發佈之後才撥出。", en: "Every creator is reviewed by a person. We hold your payment and release it only after the work is approved and the post is live." }}
        primary={CTA.brandSignup} secondary={{ href: "/creators", label: { zh: "先看創作者", en: "Browse creators first" } }}
      />
      <FeatureBlock
        title={{ zh: "兩種找人的方式", en: "Two ways to find people" }}
        body={{ zh: "主動找，或是讓人來找你。兩種可以同時用。", en: "Go looking, or let them come to you. You can do both." }}
        points={[
          { zh: "到創作者廣場篩選，看作品、數據與報價後直接邀請", en: "Filter the creator directory, check work, numbers and rates, then invite directly" },
          { zh: "刊登招募，收齊報名後在同一頁錄取或婉拒", en: "Post a brief, collect applications, and accept or decline on one page" },
          { zh: "把適合的人加入收藏", en: "Save the people who fit" },
        ]}
      />
      <FeatureBlock
        title={{ zh: "合作進度不用追", en: "No chasing for status" }}
        body={{ zh: "每個合作案都看得到現在輪到誰。輪到你的時候，頁面會直接告訴你要做什麼。", en: "Every collaboration shows whose turn it is. When it's yours, the page tells you exactly what to do." }}
        points={[
          { zh: "邀約、確認、付款、交稿、審核、發佈、撥款，七個步驟一條線", en: "Invite, confirm, pay, deliver, approve, post, payout: seven steps on one line" },
          { zh: "交稿在平台上看、在平台上審，修改意見對著稿件寫", en: "View and approve deliveries here, with change requests next to the work" },
          { zh: "付款紀錄集中在一頁，可以依月份查看", en: "All your payments on one page, viewable by month" },
        ]}
      />
      <FeatureBlock
        title={{ zh: "出問題的時候有依據", en: "A record when things go wrong" }}
        body={{ zh: "條件、訊息、交稿和付款都留在平台上，不是散在聊天截圖裡。", en: "Terms, messages, deliveries and payments all live here, not scattered across chat screenshots." }}
        points={[
          { zh: "創作者沒有交稿時，款項還在平台，可以申請取消並退款", en: "If a creator doesn't deliver, the money is still with us and you can ask to cancel and be refunded" },
          { zh: "合作完成後可以評價創作者，其他品牌看得到", en: "Review creators after you finish; other brands can see it" },
          { zh: "目前平台不收手續費", en: "There is currently no platform fee" },
        ]}
      />
      <ClosingCta title={{ zh: "第一個合作，從搜尋開始", en: "Your first collaboration starts with a search" }} primary={CTA.brandSignup} secondary={CTA.findCreators} />
    </>
  );
}
