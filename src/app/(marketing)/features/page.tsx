import type { Metadata } from "next";
import { ClosingCta, FeatureBlock, PageHero } from "@/components/site/MarketingParts";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "功能",
  description: `${SITE_NAME} 的功能：找創作者、刊登招募、站內訊息、款項保管、交稿審核、雙向評價。`,
  alternates: { canonical: "/features" },
};

// 只寫系統現在真的做到的事。id 對應 src/lib/site-nav.ts 的 FEATURE_SECTIONS。
const BLOCKS: { id: string; title: string; body: string; points: string[] }[] = [
  {
    id: "find", title: "找創作者",
    body: "所有人都能瀏覽通過審核的創作者；品牌登入後有更多篩選條件，還能收藏與直接邀請。",
    points: ["依類別、關鍵字搜尋，依粉絲數、評價、起價排序", "品牌可以再用地區、粉絲數、互動率、報價區間、合作形式篩選", "公開頁看得到作品、粉絲數、互動率與過去合作的評價", "把適合的人加入收藏，之後再邀請"],
  },
  {
    id: "briefs", title: "刊登招募",
    body: "不想一個一個找的時候，把需求寫成一則招募，讓有興趣的創作者自己來報名。",
    points: ["寫清楚合作形式、預算、條件與截止日期", "創作者報名時可以附上自己的報價與想說的話", "報名者在同一頁錄取或婉拒，可以依狀態篩選", "系統會標出哪些創作者符合你設的條件"],
  },
  {
    id: "chat", title: "訊息與條件",
    body: "細節在站內訊息談，談好的內容寫成一張合作案：交付內容、金額，創作者接受才成立。",
    points: ["品牌與創作者一對一的站內訊息", "合作案上隨時看得到現在輪到誰、要做什麼", "每一步都有時間紀錄，日後有爭議查得到", "訊息裡出現電話或 LINE 時，送出前會先提醒"],
  },
  {
    id: "pay", title: "款項保管",
    body: "品牌付款後，款項由平台保管，不會直接到創作者手上。交稿通過、貼文發佈之後才撥出。",
    points: ["信用卡或 ATM 轉帳付款（綠界）", "品牌付款前，創作者可以退出", "貼文發佈後，平台以銀行轉帳撥款給創作者", "目前付款確認與撥款由平台人工處理"],
  },
  {
    id: "review", title: "交稿審核",
    body: "創作者在平台上傳圖片、影片或附上連結；品牌按通過，或寫下要修改的地方。",
    points: ["每一輪交稿與修改意見都留著", "品牌 3 天內沒有回覆，系統自動通過", "交稿檔案只有這個合作案的雙方看得到", "通過後創作者發佈貼文，並把貼文連結貼回平台"],
  },
  {
    id: "reviews", title: "雙向評價",
    body: "合作完成後 14 天內，品牌與創作者互相評 1 到 5 星，可以再寫一段話。",
    points: ["只有完成合作的雙方能寫，每人一則", "兩邊都寫完才一起公開，寫的時候看不到對方的內容", "品牌給創作者的評價顯示在創作者的公開頁", "創作者看招募時看得到品牌的平均星等"],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        title="找人、談條件、付款、交稿、撥款，都在同一個地方"
        body="不用在 IG 私訊、試算表和匯款截圖之間來回。每一個合作案都是一條線，從邀約走到撥款。"
        primary={{ href: "/creators", label: "找創作者" }} secondary={{ href: "/signup", label: "免費註冊" }}
      />
      {BLOCKS.map((b) => <FeatureBlock key={b.id} {...b} />)}
      <ClosingCta title="先看看有哪些創作者" primary={{ href: "/creators", label: "找創作者" }} secondary={{ href: "/signup?role=creator", label: "我是創作者" }} />
    </>
  );
}
