import { BadgeCheck, LifeBuoy, MessagesSquare, ShieldCheck, type LucideIcon } from "lucide-react";
import { T } from "@/components/i18n/T";
import type { L } from "@/lib/lang";

type Item = { Icon: LucideIcon; title: L; body: L; note?: L; wide?: boolean };

/**
 * 安心的設計：只寫系統真的做到的事。版面是不等寬的方格（最重要的「款項保管」佔兩欄），
 * 背後一層往四周淡出的細格線。
 */
export function Trust() {
  const items: Item[] = [
    {
      Icon: ShieldCheck, wide: true,
      title: { zh: "款項先交給平台", en: "The platform holds the money first" },
      body: { zh: "品牌付款後，款項由平台保管；創作者交稿通過、發佈貼文後，平台才轉給創作者。", en: "Once a brand pays, we hold the funds. They go to the creator only after the work is approved and the post is live." },
      note: { zh: "目前付款與撥款都由平台人工確認、銀行轉帳處理。", en: "For now, payments and payouts are confirmed by our team and sent by bank transfer." },
    },
    {
      Icon: BadgeCheck,
      title: { zh: "真人審核", en: "Reviewed by a person" },
      body: { zh: "創作者要在 IG 自我介紹放上驗證碼，平台人工確認是本人帳號。", en: "Creators put a verification code in their Instagram bio, and our team checks that the account is really theirs." },
    },
    {
      Icon: MessagesSquare,
      title: { zh: "訊息留在平台", en: "Conversations stay on the platform" },
      body: { zh: "討論訊息與交稿檔案都留在平台上；要分享電話或 LINE 前，系統會先提醒你。", en: "Messages and delivered files are kept here. If you are about to share a phone number or LINE ID, we remind you first." },
    },
    {
      Icon: LifeBuoy, wide: true,
      title: { zh: "遇到問題", en: "When something goes wrong" },
      body: { zh: "頁尾的「需要協助？」會列出聯絡方式。", en: "The Help link in the footer lists how to reach us." },
    },
  ];
  return (
    <section aria-labelledby="trust-title" className="relative isolate border-y border-line bg-panel">
      <div aria-hidden="true" className="grid-fade absolute inset-0 -z-10" />
      <div className="mx-auto max-w-[1280px] px-5 py-20 md:px-16 md:py-28">
        <h2 id="trust-title" className="reveal max-w-[820px] font-serif text-[30px] font-bold text-ink md:text-[48px]">
          <T zh="我們怎麼保護每一次合作" en="How we protect every collaboration" />
        </h2>
        <dl className="mt-10 grid gap-4 md:mt-14 md:grid-cols-3 md:gap-5">
          {items.map((it) => (
            <div key={it.title.zh} className={`reveal rounded-card border border-line bg-surface p-6 elev-card md:p-8 ${it.wide ? "md:col-span-2" : ""}`}>
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-input bg-primary-soft text-accent">
                <it.Icon size={22} strokeWidth={1.5} />
              </span>
              <dt className="mt-5 text-xl font-bold text-ink"><T {...it.title} /></dt>
              <dd className="mt-2 max-w-[560px] text-sm text-muted [text-wrap:pretty] md:text-base">
                <T {...it.body} />
                {it.note && <span className="mt-2 block text-sm"><T {...it.note} /></span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
