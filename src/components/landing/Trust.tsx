import { T } from "@/components/i18n/T";
import type { L } from "@/lib/lang";

/** 安心的設計（規格 §5.2）：只寫系統真的做到的事。 */
export function Trust() {
  const items: { title: L; body: L; note?: L }[] = [
    {
      title: { zh: "款項先交給平台", en: "The platform holds the money first" },
      body: { zh: "品牌付款後，款項由平台保管；創作者交稿通過、發佈貼文後，平台才轉給創作者。", en: "Once a brand pays, we hold the funds. They go to the creator only after the work is approved and the post is live." },
      note: { zh: "目前付款與撥款都由平台人工確認、銀行轉帳處理。", en: "For now, payments and payouts are confirmed by our team and sent by bank transfer." },
    },
    {
      title: { zh: "真人審核", en: "Reviewed by a person" },
      body: { zh: "創作者要在 IG 自我介紹放上驗證碼，平台人工確認是本人帳號。", en: "Creators put a verification code in their Instagram bio, and our team checks that the account is really theirs." },
    },
    {
      title: { zh: "訊息留在平台", en: "Conversations stay on the platform" },
      body: { zh: "討論訊息與交稿檔案都留在平台上；要分享電話或 LINE 前，系統會先提醒你。", en: "Messages and delivered files are kept here. If you are about to share a phone number or LINE ID, we remind you first." },
    },
    {
      title: { zh: "遇到問題", en: "When something goes wrong" },
      body: { zh: "頁尾的「需要協助？」會列出聯絡方式。", en: "The Help link in the footer lists how to reach us." },
    },
  ];
  return (
    <section aria-labelledby="trust-title" className="border-y border-line bg-panel">
      <div className="mx-auto max-w-[1280px] px-5 py-20 md:px-16 md:py-24">
        <h2 id="trust-title" className="font-serif text-[28px] font-bold text-ink [text-wrap:balance] md:text-[40px]">
          <T zh="我們怎麼保護每一次合作" en="How we protect every collaboration" />
        </h2>
        <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
          {items.map((it) => (
            <div key={it.title.zh} className="border-l-2 border-thread pl-5">
              <dt className="text-lg font-bold text-ink"><T {...it.title} /></dt>
              <dd className="mt-1 text-sm text-muted [text-wrap:pretty]">
                <T {...it.body} />
                {it.note && <span className="mt-1 block"><T {...it.note} /></span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
