import type { Metadata } from "next";
import { ClosingCta, FeatureBlock, PageHero } from "@/components/site/MarketingParts";
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
        title="品牌先付款，你才開始做"
        body="合作款項在你動工之前就已經交給平台保管。交稿通過、發佈貼文之後，平台把報價全額轉給你。"
        primary={{ href: "/signup?role=creator", label: "成為創作者" }} secondary={{ href: "/features", label: "看功能" }}
      />
      <FeatureBlock
        title="一個公開頁，放你的作品與報價"
        body="通過審核後，你的頁面會出現在公開的創作者列表，品牌搜尋得到。"
        points={["放作品、類別、風格標籤、粉絲數與互動率", "各種合作形式分開報價；最低的一筆會以「起價」公開，完整報價只有品牌看得到", "合作完成後累積的評價會顯示在頁面上"]}
      />
      <FeatureBlock
        title="案子兩種來源"
        body="等品牌邀請，或是自己去報名。"
        points={["品牌直接邀請你：條件不合適可以婉拒", "瀏覽品牌刊登的招募，報名時附上你的報價", "系統會標出你符合哪些招募的條件"]}
      />
      <FeatureBlock
        title="不會做白工"
        body="付款、審核和撥款都有規則，不用自己催。"
        points={["品牌付款之後才進入交稿階段", "品牌 3 天沒有審核，系統自動通過", "撥款金額就是合作案的報價，目前平台不收手續費", "收入頁看得到每一筆合作的款項狀態"]}
      />
      <FeatureBlock
        title="怎麼加入"
        body="註冊免費，審核由平台人工處理。"
        points={["用 Email、Google 或 LINE 註冊，填 IG 帳號與基本資料", "把平台給的驗證碼放進 IG 自我介紹，證明帳號是你的", "通過審核後就能報名招募、接受邀請"]}
      />
      <ClosingCta title="把你的頁面放上來" primary={{ href: "/signup?role=creator", label: "成為創作者" }} />
    </>
  );
}
