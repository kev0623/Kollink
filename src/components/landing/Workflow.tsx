"use client";

import { useId, useRef, useState } from "react";
import { Check, FileImage, Lock, Search, Star } from "lucide-react";
import { T } from "@/components/i18n/T";
import { useLang } from "@/components/i18n/useLang";
import type { L } from "@/lib/lang";

type Step = { key: string; tab: L; title: L; body: L; points: L[]; Mock: () => React.ReactNode };

const STEPS: Step[] = [
  {
    key: "find", tab: { zh: "找人", en: "Find" },
    title: { zh: "先看清楚，再開口", en: "Look closely before you reach out" },
    body: { zh: "品牌用類別、地區、粉絲數篩選創作者，看作品、互動率與過去合作的評價。也可以刊登招募，讓有興趣的創作者自己來報名。", en: "Brands filter creators by category, region and audience size, then check their work, engagement and past reviews. Or post a brief and let interested creators apply." },
    points: [
      { zh: "每位創作者都經過人工審核", en: "Every creator is reviewed by a person" },
      { zh: "作品與報價公開，粉絲數登入後看", en: "Work and rates are public; follower counts after login" },
      { zh: "搜尋與瀏覽不用錢", en: "Searching and browsing are free" },
    ],
    Mock: FindMock,
  },
  {
    key: "terms", tab: { zh: "談條件", en: "Agree terms" },
    title: { zh: "條件寫成一張單，雙方都同意才開始", en: "Terms on one page, agreed by both sides" },
    body: { zh: "交付內容、金額、期限寫在合作案上。創作者接受之後才成立，之後誰該做什麼，頁面上一眼就看得到。", en: "Deliverables, amount and deadline are written on the collaboration. It starts only when the creator accepts, and the page always shows who does what next." },
    points: [
      { zh: "站內訊息討論細節", en: "Work out details in on-platform messages" },
      { zh: "條件與紀錄都留在平台", en: "Terms and history stay on the platform" },
      { zh: "創作者可以婉拒", en: "Creators can decline" },
    ],
    Mock: TermsMock,
  },
  {
    key: "pay", tab: { zh: "付款", en: "Pay" },
    title: { zh: "款項先交給平台保管", en: "The platform holds the payment" },
    body: { zh: "品牌付款後創作者才開始製作。錢不會直接到對方手上：交稿通過、貼文發佈之後，平台才把款項撥出去。", en: "Creators start once the brand has paid. The money doesn't go straight to them: we release it after the work is approved and the post is live." },
    points: [
      { zh: "信用卡或 ATM 轉帳", en: "Credit card or ATM transfer" },
      { zh: "付款前創作者可以退出", en: "Creators can withdraw before payment" },
      { zh: "沒交稿可以申請退款", en: "Refund available if nothing is delivered" },
    ],
    Mock: PayMock,
  },
  {
    key: "review", tab: { zh: "交稿審核", en: "Deliver & approve" },
    title: { zh: "在平台上交稿，在平台上審", en: "Deliver here, approve here" },
    body: { zh: "創作者上傳圖片、影片或連結。品牌按通過，或寫下要修改的地方。品牌超過 3 天沒有回覆，系統會自動通過，創作者不會被晾著。", en: "Creators upload images, video or links. Brands approve or say what to change. If a brand doesn't respond within 3 days the work is approved automatically, so creators are never left waiting." },
    points: [
      { zh: "每一輪交稿都有紀錄", en: "Every round of delivery is recorded" },
      { zh: "修改意見對著稿件寫", en: "Change requests sit next to the work" },
      { zh: "3 天沒審自動通過", en: "Auto-approved after 3 days" },
    ],
    Mock: ReviewMock,
  },
  {
    key: "payout", tab: { zh: "撥款與評價", en: "Payout & reviews" },
    title: { zh: "發佈之後撥款，然後互相評價", en: "Paid after posting, then both sides review" },
    body: { zh: "創作者貼上貼文連結，平台確認後轉帳給創作者。合作完成 14 天內雙方互評；兩邊都寫完才公開，所以可以放心說實話。", en: "The creator adds the post link, we confirm it and transfer the payment. Both sides have 14 days to review each other; reviews go public only once both are written, so you can be honest." },
    points: [
      { zh: "撥款金額就是合作案報價", en: "Creators receive the full agreed amount" },
      { zh: "評價只來自完成的合作", en: "Reviews come only from completed work" },
      { zh: "雙方寫完才一起公開", en: "Published together once both are written" },
    ],
    Mock: PayoutMock,
  },
];

/**
 * 一條流程走完：五個步驟的分頁（真的有先後，所以編號）。分頁列是一條紅線串起五個結，
 * 選到的結點亮。鍵盤：左右鍵換分頁、Home／End 到頭尾（WAI-ARIA tabs）。不自動輪播。
 */
export function Workflow() {
  const [active, setActive] = useState(0);
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const step = STEPS[active];
  const lang = useLang();

  function onKey(e: React.KeyboardEvent) {
    const n = STEPS.length;
    const to = e.key === "ArrowRight" ? (active + 1) % n : e.key === "ArrowLeft" ? (active + n - 1) % n
      : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    setActive(to);
    tabs.current[to]?.focus();
  }

  return (
    <section id="how" aria-labelledby="how-title" className="mx-auto max-w-[1280px] scroll-mt-20 px-5 py-16 md:px-16 md:py-32">
      <h2 id="how-title" className="max-w-[820px] font-serif text-[clamp(28px,3.4vw,40px)] font-extrabold leading-tight text-ink"><T zh="從找人到撥款，一條線走完" en="From first search to payout, on one thread" /></h2>
      <p className="mt-4 max-w-[560px] text-base text-muted [text-wrap:pretty] md:text-lg"><T zh="不用在 IG 私訊、試算表和匯款截圖之間來回。五個步驟都在同一個地方。" en="No more bouncing between Instagram DMs, spreadsheets and transfer screenshots. All five steps happen in one place." /></p>

      {/* 15 秒的流程短片（沒有聲音）：不自動播放，按下去才載入影片檔 */}
      <video
        controls muted playsInline loop preload="none" poster="/video/kollink-flow.jpg" width={1280} height={720}
        aria-label={lang === "en" ? "The collaboration flow in 15 seconds (captions in Chinese)" : "15 秒看完合作流程：邀約、確認、付款、交稿、審核、發佈、撥款"}
        className="mt-8 aspect-video h-auto w-full rounded-[22px] md:rounded-panel border border-line bg-bg elev-pop md:mt-12"
      >
        <source src="/video/kollink-flow.mp4" type="video/mp4" />
      </video>

      <div role="tablist" aria-label={lang === "en" ? "Collaboration steps" : "合作流程"} onKeyDown={onKey} className="scroll-fade-x relative mt-8 flex overflow-x-auto pb-2 md:mt-12">
        {STEPS.map((s, i) => {
          const on = i === active;
          return (
            <button
              key={s.key} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab"
              id={`${id}-tab-${s.key}`} aria-selected={on} aria-controls={`${id}-panel`} tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              className="group relative flex min-w-[112px] flex-1 flex-col items-center gap-2 px-2 pb-1 pt-1 outline-none"
            >
              {/* 結與結之間的線：走過的是紅線，還沒到的是暗線 */}
              {i > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-[15px] h-0.5 w-full ${i <= active ? "bg-thread" : "bg-line"}`} />}
              <span
                aria-hidden="true"
                className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-focus ${
                  on ? "border-thread bg-thread text-on-primary shadow-[0_0_0_6px_var(--color-primary-soft)]"
                    : i < active ? "border-thread bg-bg text-ink" : "border-line-strong bg-bg text-muted"}`}
              >
                {i + 1}
              </span>
              <span className={`whitespace-nowrap text-sm ${on ? "font-bold text-ink" : "font-semibold text-muted group-hover:text-ink"}`}><T {...s.tab} /></span>
            </button>
          );
        })}
      </div>

      <div
        id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${step.key}`} tabIndex={0}
        className="mt-6 grid gap-8 rounded-card border border-line bg-panel p-5 elev-card outline-none focus-visible:ring-2 focus-visible:ring-focus md:mt-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-center md:gap-12 md:p-10"
      >
        <div className="min-w-0">
          <h3 className="font-serif text-2xl font-bold text-ink [text-wrap:balance] md:text-[28px]"><T {...step.title} /></h3>
          <p className="mt-3 text-base text-muted [text-wrap:pretty]"><T {...step.body} /></p>
          <ul className="mt-5 space-y-2">
            {step.points.map((p) => (
              <li key={p.zh} className="flex items-start gap-2 text-sm text-ink">
                <Check size={16} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-success" /><span><T {...p} /></span>
              </li>
            ))}
          </ul>
        </div>
        {/* 示意畫面：不是截圖，內容是虛構的，螢幕閱讀器略過 */}
        <div aria-hidden="true" key={step.key} className="min-w-0 rounded-card border border-line bg-bg p-4 elev-pop motion-safe:animate-[fade-in_240ms_ease-out] md:p-5">
          <step.Mock />
        </div>
      </div>
    </section>
  );
}

const mockCard = "rounded-input border border-line bg-surface";
const mockLabel = "text-[11px] text-muted";

function FindMock() {
  const people: [string, L, L, L][] = [
    ["滿", { zh: "小滿", en: "Man" }, { zh: "美妝・保養", en: "Beauty, Skincare" }, { zh: "2.4 萬 粉絲", en: "24K followers" }],
    ["禾", { zh: "阿禾", en: "He" }, { zh: "美食・旅遊", en: "Food, Travel" }, { zh: "8,600 粉絲", en: "8.6K followers" }],
    ["青", { zh: "青青", en: "Qing" }, { zh: "穿搭・生活", en: "Fashion, Lifestyle" }, { zh: "5.1 萬 粉絲", en: "51K followers" }],
  ];
  return (
    <div>
      <div className={`${mockCard} flex items-center gap-2 px-3 py-2 text-xs text-muted`}>
        <Search size={14} strokeWidth={1.5} /><T zh="美妝・台北市・粉絲 1 萬以上" en="Beauty, Taipei, 10K+ followers" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {people.map(([ch, name, cat, fans], i) => (
          <div key={ch} className={`${mockCard} overflow-hidden`}>
            <div className={`flex aspect-square items-center justify-center font-serif text-3xl font-bold ${i === 0 ? "bg-primary-soft text-ink" : "bg-panel text-line-strong"}`}>{ch}</div>
            <div className="p-2">
              <p className="flex items-center justify-between text-xs font-bold text-ink"><span><T {...name} /></span>{i === 0 && <span className="inline-flex items-center gap-0.5 font-semibold"><Star size={10} className="fill-current text-primary" />4.9</span>}</p>
              <p className={`${mockLabel} truncate`}><T {...cat} /></p>
              <p className={`${mockLabel} tabular-nums`}><T {...fans} /></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TermsMock() {
  return (
    <div className={`${mockCard} p-4`}>
      <p className="text-sm font-bold text-ink"><T zh="春季新品開箱" en="Spring launch unboxing" /></p>
      <dl className="mt-3 space-y-2 text-xs">
        <div><dt className={mockLabel}><T zh="交付內容" en="Deliverables" /></dt><dd className="text-ink"><T zh="IG 貼文 1 則＋限時動態 2 則" en="1 Instagram post + 2 stories" /></dd></div>
        <div className="flex gap-6">
          <div><dt className={mockLabel}><T zh="金額" en="Amount" /></dt><dd className="text-base font-bold tabular-nums text-ink">NT$6,000</dd></div>
          <div><dt className={mockLabel}><T zh="狀態" en="Status" /></dt><dd className="font-semibold text-ink"><T zh="等創作者確認" en="Waiting for the creator" /></dd></div>
        </div>
      </dl>
      <div className="mt-4 flex gap-2">
        <span className="inline-flex h-8 items-center rounded-btn bg-primary px-4 text-xs font-bold text-on-primary"><T zh="接受" en="Accept" /></span>
        <span className="inline-flex h-8 items-center rounded-btn border border-line-strong px-4 text-xs font-bold text-ink"><T zh="婉拒" en="Decline" /></span>
      </div>
    </div>
  );
}

function PayMock() {
  return (
    <div className={`${mockCard} p-4`}>
      <p className="flex items-center gap-2 text-sm font-bold text-ink"><Lock size={15} strokeWidth={1.5} className="text-success" /><T zh="款項由平台保管中" en="Held by the platform" /></p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">NT$6,000</p>
      <ol className="mt-4 space-y-2 text-xs">
        {([
          [{ zh: "品牌已付款", en: "Brand has paid" }, true], [{ zh: "創作者交稿", en: "Creator delivers" }, false],
          [{ zh: "貼文發佈", en: "Post goes live" }, false], [{ zh: "撥款給創作者", en: "Creator is paid" }, false],
        ] as [L, boolean][]).map(([t, done]) => (
          <li key={t.zh} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full border-2 ${done ? "border-thread bg-thread" : "border-line-strong"}`} />
            <span className={done ? "font-semibold text-ink" : "text-muted"}><T {...t} /></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ReviewMock() {
  return (
    <div className={`${mockCard} p-4`}>
      <p className="text-sm font-bold text-ink"><T zh="第 1 次交稿" en="Delivery 1" /></p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex aspect-square items-center justify-center rounded-input bg-panel text-line-strong"><FileImage size={22} strokeWidth={1.5} /></div>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold text-ink"><T zh="還有 2 天 5 小時，沒審核會自動通過" en="Auto-approved in 2 days 5 hours" /></p>
      <div className="mt-3 flex gap-2">
        <span className="inline-flex h-8 items-center rounded-btn bg-primary px-4 text-xs font-bold text-on-primary"><T zh="通過" en="Approve" /></span>
        <span className="inline-flex h-8 items-center rounded-btn border border-line-strong px-4 text-xs font-bold text-ink"><T zh="要求修改" en="Request changes" /></span>
      </div>
    </div>
  );
}

function PayoutMock() {
  return (
    <div className="space-y-3">
      <div className={`${mockCard} flex items-center justify-between p-4`}>
        <div><p className={mockLabel}><T zh="已撥款" en="Paid out" /></p><p className="text-xl font-bold tabular-nums text-ink">NT$6,000</p></div>
        <span className="inline-flex items-center gap-1 rounded-btn bg-success-soft px-3 py-1 text-xs font-bold text-success"><Check size={12} strokeWidth={2.5} /><T zh="已完成" en="Completed" /></span>
      </div>
      <div className={`${mockCard} p-4`}>
        <p className="flex items-center gap-2 text-xs font-bold text-ink">
          <span><T zh="品牌的評價" en="Review from the brand" /></span>
          <span className="inline-flex gap-0.5">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={12} className="fill-current text-primary" />)}</span>
        </p>
        <p className="mt-1.5 text-xs text-muted"><T zh="準時交稿，溝通很順利，成品比預期好。" en="On time, easy to work with, and better than we expected." /></p>
      </div>
    </div>
  );
}
