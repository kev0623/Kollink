import type { Metadata } from "next";
import { ClosingCta, FeatureBlock, PageHero } from "@/components/site/MarketingParts";
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
        title="找到對的創作者，錢在驗收之後才出去"
        body="每位創作者都經過人工審核。你付的款項由平台保管，創作者交稿通過、貼文發佈之後才撥出。"
        primary={{ href: "/signup?role=brand", label: "註冊品牌帳號" }} secondary={{ href: "/creators", label: "先看創作者" }}
      />
      <FeatureBlock
        title="兩種找人的方式"
        body="主動找，或是讓人來找你。兩種可以同時用。"
        points={["到創作者廣場篩選，看作品、數據與報價後直接邀請", "刊登招募，收齊報名後在同一頁錄取或婉拒", "把適合的人加入收藏"]}
      />
      <FeatureBlock
        title="合作進度不用追"
        body="每個合作案都看得到現在輪到誰。輪到你的時候，頁面會直接告訴你要做什麼。"
        points={["邀約、確認、付款、交稿、審核、發佈、撥款，七個步驟一條線", "交稿在平台上看、在平台上審，修改意見對著稿件寫", "付款紀錄集中在一頁，可以依月份查看"]}
      />
      <FeatureBlock
        title="出問題的時候有依據"
        body="條件、訊息、交稿和付款都留在平台上，不是散在聊天截圖裡。"
        points={["創作者沒有交稿時，款項還在平台，可以申請取消並退款", "合作完成後可以評價創作者，其他品牌看得到", "目前平台不收手續費"]}
      />
      <ClosingCta title="第一個合作，從搜尋開始" primary={{ href: "/signup?role=brand", label: "註冊品牌帳號" }} secondary={{ href: "/creators", label: "找創作者" }} />
    </>
  );
}
