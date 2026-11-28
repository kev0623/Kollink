import { BadgeCheck, LifeBuoy, MessagesSquare, ShieldCheck, type LucideIcon } from "lucide-react";
import { T } from "@/components/i18n/T";
import type { L } from "@/lib/lang";

type Tone = "ink" | "surface" | "soft";
type Item = { Icon: LucideIcon; title: L; body: L; note?: L; wide?: boolean; tone: Tone };

/** 三種底色輪流：反白（最重要的一格）、卡片色、淡紅。文字顏色跟著底色換。 */
const TONE: Record<Tone, { box: string; icon: string; body: string }> = {
  ink: { box: "bg-ink text-on-ink", icon: "bg-on-ink/10 text-on-ink", body: "text-on-ink/75" },
  surface: { box: "border border-line bg-surface text-ink", icon: "bg-primary-soft text-accent", body: "text-muted" },
  soft: { box: "bg-primary-soft text-ink", icon: "bg-bg/40 text-accent", body: "text-ink/75" },
};

/**
 * 安心的設計：只寫系統真的做到的事。版面是不等寬的便當格（最重要的「款項保管」佔兩欄），三種底色輪流。
 */
export function Trust() {
  const items: Item[] = [
    {
      Icon: ShieldCheck, wide: true, tone: "ink",
      title: { zh: "款項先交給平台", en: "The platform holds the money first" },
      body: { zh: "品牌付款後，款項由平台保管；創作者交稿通過、發佈貼文後，平台才轉給創作者。", en: "Once a brand pays, we hold the funds. They go to the creator only after the work is approved and the post is live." },
      note: { zh: "目前付款與撥款都由平台人工確認、銀行轉帳處理。", en: "For now, payments and payouts are confirmed by our team and sent by bank transfer." },
    },
    {
      Icon: BadgeCheck, tone: "surface",
      title: { zh: "真人審核", en: "Reviewed by a person" },
      body: { zh: "創作者要在 IG 自我介紹放上驗證碼，平台人工確認是本人帳號。", en: "Creators put a verification code in their Instagram bio, and our team checks that the account is really theirs." },
    },
    {
      Icon: MessagesSquare, tone: "surface",
      title: { zh: "訊息留在平台", en: "Conversations stay on the platform" },
      body: { zh: "討論訊息與交稿檔案都留在平台上；要分享電話或 LINE 前，系統會先提醒你。", en: "Messages and delivered files are kept here. If you are about to share a phone number or LINE ID, we remind you first." },
    },
    {
      Icon: LifeBuoy, wide: true, tone: "soft",
      title: { zh: "遇到問題", en: "When something goes wrong" },
      body: { zh: "頁尾的「需要協助？」會列出聯絡方式。", en: "The Help link in the footer lists how to reach us." },
    },
  ];
  return (
    <section aria-labelledby="trust-title" className="bg-panel">
      <div className="mx-auto max-w-[1280px] px-5 py-[72px] md:px-16 md:py-28">
        <h2 id="trust-title" className="max-w-[820px] font-serif text-[clamp(28px,3.4vw,40px)] font-extrabold leading-tight text-ink">
          <T zh="我們怎麼保護每一次合作" en="How we protect every collaboration" />
        </h2>
        <dl className="mt-10 grid gap-4 md:mt-14 md:grid-cols-3 md:gap-5">
          {items.map((it) => (
            <div key={it.title.zh} className={`rounded-[22px] p-6 md:rounded-panel md:p-9 ${TONE[it.tone].box} ${it.wide ? "md:col-span-2" : ""}`}>
              <span aria-hidden="true" className={`flex h-11 w-11 items-center justify-center rounded-input ${TONE[it.tone].icon}`}>
                <it.Icon size={22} strokeWidth={1.5} />
              </span>
              <dt className="mt-5 text-xl font-extrabold"><T {...it.title} /></dt>
              <dd className={`mt-2 max-w-[560px] text-sm [text-wrap:pretty] md:text-base ${TONE[it.tone].body}`}>
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
