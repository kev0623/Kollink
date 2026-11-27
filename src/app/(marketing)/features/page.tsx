import type { Metadata } from "next";
import { ClosingCta, CTA, FeatureBlock, PageHero } from "@/components/site/MarketingParts";
import type { L } from "@/lib/lang";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "功能",
  description: `${SITE_NAME} 的功能：找創作者、刊登招募、站內訊息、款項保管、交稿審核、雙向評價。`,
  alternates: { canonical: "/features" },
};

// 只寫系統現在真的做到的事。id 對應 src/lib/site-nav.ts 的 FEATURE_SECTIONS。
const BLOCKS: { id: string; title: L; body: L; points: L[] }[] = [
  {
    id: "find", title: { zh: "找創作者", en: "Find creators" },
    body: { zh: "所有人都能瀏覽通過審核的創作者；品牌登入後有更多篩選條件，還能收藏與直接邀請。", en: "Anyone can browse vetted creators. Brands who log in get more filters and can save and invite them directly." },
    points: [
      { zh: "依類別、關鍵字搜尋，依評價、起價排序（登入後可依粉絲數）", en: "Search by category or keyword; sort by rating or starting price (by followers once logged in)" },
      { zh: "品牌可以再用地區、粉絲數、互動率、報價區間、合作形式篩選", en: "Brands can also filter by region, followers, engagement, price range and collaboration type" },
      { zh: "公開頁看得到作品、報價與過去合作的評價；登入後再看粉絲數", en: "Public pages show work, rates and past reviews; follower counts appear after login" },
      { zh: "把適合的人加入收藏，之後再邀請", en: "Save the right people and invite them later" },
    ],
  },
  {
    id: "briefs", title: { zh: "刊登招募", en: "Post a brief" },
    body: { zh: "不想一個一個找的時候，把需求寫成一則招募，讓有興趣的創作者自己來報名。", en: "When you'd rather not search one by one, write up what you need and let interested creators apply." },
    points: [
      { zh: "寫清楚合作形式、預算、條件與截止日期", en: "State the format, budget, requirements and deadline" },
      { zh: "創作者報名時可以附上自己的報價與想說的話", en: "Creators can apply with their own price and a note" },
      { zh: "報名者在同一頁錄取或婉拒，可以依狀態篩選", en: "Accept or decline applicants on one page, filtered by status" },
      { zh: "系統會標出哪些創作者符合你設的條件", en: "We flag which creators match your requirements" },
    ],
  },
  {
    id: "chat", title: { zh: "訊息與條件", en: "Chat & terms" },
    body: { zh: "細節在站內訊息談，談好的內容寫成一張合作案：交付內容、金額，創作者接受才成立。", en: "Talk details through in messages, then put what you agreed into a collaboration: deliverables and amount. It only starts when the creator accepts." },
    points: [
      { zh: "品牌與創作者一對一的站內訊息", en: "One-to-one messaging between brand and creator" },
      { zh: "合作案上隨時看得到現在輪到誰、要做什麼", en: "The collaboration always shows whose turn it is and what to do" },
      { zh: "每一步都有時間紀錄，日後有爭議查得到", en: "Every step is time-stamped, so there is a record if a dispute comes up" },
      { zh: "訊息裡出現電話或 LINE 時，送出前會先提醒", en: "We warn you before you send a phone number or LINE ID" },
    ],
  },
  {
    id: "pay", title: { zh: "款項保管", en: "Held payments" },
    body: { zh: "品牌付款後，款項由平台保管，不會直接到創作者手上。交稿通過、貼文發佈之後才撥出。", en: "After the brand pays, we hold the money rather than passing it straight to the creator. It is released once the work is approved and posted." },
    points: [
      { zh: "信用卡或 ATM 轉帳付款（綠界）", en: "Pay by credit card or ATM transfer (ECPay)" },
      { zh: "品牌付款前，創作者可以退出", en: "Creators can withdraw before the brand pays" },
      { zh: "貼文發佈後，平台以銀行轉帳撥款給創作者", en: "After the post is live, we pay the creator by bank transfer" },
      { zh: "目前付款確認與撥款由平台人工處理", en: "For now, our team confirms payments and sends payouts by hand" },
    ],
  },
  {
    id: "review", title: { zh: "交稿審核", en: "Delivery & approval" },
    body: { zh: "創作者在平台上傳圖片、影片或附上連結；品牌按通過，或寫下要修改的地方。", en: "Creators upload images or video, or attach links. Brands approve, or write down what needs to change." },
    points: [
      { zh: "每一輪交稿與修改意見都留著", en: "Every round of delivery and feedback is kept" },
      { zh: "品牌 3 天內沒有回覆，系統自動通過", en: "If the brand doesn't respond within 3 days, the work is approved automatically" },
      { zh: "交稿檔案只有這個合作案的雙方看得到", en: "Delivered files are visible only to the two sides of that collaboration" },
      { zh: "通過後創作者發佈貼文，並把貼文連結貼回平台", en: "After approval the creator posts and adds the post link here" },
    ],
  },
  {
    id: "reviews", title: { zh: "雙向評價", en: "Two-way reviews" },
    body: { zh: "合作完成後 14 天內，品牌與創作者互相評 1 到 5 星，可以再寫一段話。", en: "Within 14 days of finishing, brand and creator rate each other from 1 to 5 stars, with an optional comment." },
    points: [
      { zh: "只有完成合作的雙方能寫，每人一則", en: "Only the two sides of a completed collaboration can write one, once each" },
      { zh: "兩邊都寫完才一起公開，寫的時候看不到對方的內容", en: "Both are published together, so neither side sees the other's first" },
      { zh: "品牌給創作者的評價顯示在創作者的公開頁", en: "Reviews of creators appear on their public page" },
      { zh: "創作者看招募時看得到品牌的平均星等", en: "Creators see a brand's average rating when viewing its briefs" },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        title={{ zh: "找人、談條件、付款、交稿、撥款，都在同一個地方", en: "Find, agree, pay, deliver and get paid, all in one place" }}
        body={{ zh: "不用在 IG 私訊、試算表和匯款截圖之間來回。每一個合作案都是一條線，從邀約走到撥款。", en: "No more bouncing between Instagram DMs, spreadsheets and transfer screenshots. Every collaboration is one thread, from invitation to payout." }}
        primary={CTA.findCreators} secondary={CTA.signup}
      />
      {BLOCKS.map((b) => <FeatureBlock key={b.id} {...b} />)}
      <ClosingCta title={{ zh: "先看看有哪些創作者", en: "See who's here first" }} primary={CTA.findCreators} secondary={{ href: "/signup?role=creator", label: { zh: "我是創作者", en: "I'm a creator" } }} />
    </>
  );
}
