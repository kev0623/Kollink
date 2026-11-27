"use client";

import { useId, useRef, useState } from "react";
import { Check, FileImage, Lock, Search, Star } from "lucide-react";

type Step = { key: string; tab: string; title: string; body: string; points: string[]; Mock: () => React.ReactNode };

const STEPS: Step[] = [
  {
    key: "find", tab: "找人", title: "先看清楚，再開口",
    body: "品牌用類別、地區、粉絲數篩選創作者，看作品、互動率與過去合作的評價。也可以刊登招募，讓有興趣的創作者自己來報名。",
    points: ["每位創作者都經過人工審核", "作品與報價公開，粉絲數登入後看", "搜尋與瀏覽不用錢"], Mock: FindMock,
  },
  {
    key: "terms", tab: "談條件", title: "條件寫成一張單，雙方都同意才開始",
    body: "交付內容、金額、期限寫在合作案上。創作者接受之後才成立，之後誰該做什麼，頁面上一眼就看得到。",
    points: ["站內訊息討論細節", "條件與紀錄都留在平台", "創作者可以婉拒"], Mock: TermsMock,
  },
  {
    key: "pay", tab: "付款", title: "款項先交給平台保管",
    body: "品牌付款後創作者才開始製作。錢不會直接到對方手上：交稿通過、貼文發佈之後，平台才把款項撥出去。",
    points: ["信用卡或 ATM 轉帳", "付款前創作者可以退出", "沒交稿可以申請退款"], Mock: PayMock,
  },
  {
    key: "review", tab: "交稿審核", title: "在平台上交稿，在平台上審",
    body: "創作者上傳圖片、影片或連結。品牌按通過，或寫下要修改的地方。品牌超過 3 天沒有回覆，系統會自動通過，創作者不會被晾著。",
    points: ["每一輪交稿都有紀錄", "修改意見對著稿件寫", "3 天沒審自動通過"], Mock: ReviewMock,
  },
  {
    key: "payout", tab: "撥款與評價", title: "發佈之後撥款，然後互相評價",
    body: "創作者貼上貼文連結，平台確認後轉帳給創作者。合作完成 14 天內雙方互評；兩邊都寫完才公開，所以可以放心說實話。",
    points: ["撥款金額就是合作案報價", "評價只來自完成的合作", "雙方寫完才一起公開"], Mock: PayoutMock,
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
    <section id="how" aria-labelledby="how-title" className="mx-auto max-w-[1280px] px-5 py-14 md:px-16 md:py-28">
      <h2 id="how-title" className="font-serif text-[28px] font-bold text-ink [text-wrap:balance] md:text-[40px]">從找人到撥款，一條線走完</h2>
      <p className="mt-3 max-w-[560px] text-base text-muted [text-wrap:pretty]">不用在 IG 私訊、試算表和匯款截圖之間來回。五個步驟都在同一個地方。</p>

      {/* 15 秒的流程短片（沒有聲音）：不自動播放，按下去才載入影片檔 */}
      <video
        controls muted playsInline loop preload="none" poster="/video/kollink-flow.jpg" width={1280} height={720}
        aria-label="15 秒看完合作流程：邀約、確認、付款、交稿、審核、發佈、撥款"
        className="mt-8 aspect-video h-auto w-full rounded-card border border-line bg-bg md:mt-12"
      >
        <source src="/video/kollink-flow.mp4" type="video/mp4" />
      </video>

      <div role="tablist" aria-label="合作流程" onKeyDown={onKey} className="scroll-fade-x relative mt-8 flex overflow-x-auto pb-2 md:mt-12">
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
              <span className={`whitespace-nowrap text-sm ${on ? "font-bold text-ink" : "font-semibold text-muted group-hover:text-ink"}`}>{s.tab}</span>
            </button>
          );
        })}
      </div>

      <div
        id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${step.key}`} tabIndex={0}
        className="mt-6 grid gap-8 rounded-card border border-line bg-panel p-5 outline-none focus-visible:ring-2 focus-visible:ring-focus md:mt-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-center md:gap-12 md:p-10"
      >
        <div className="min-w-0">
          <h3 className="font-serif text-2xl font-bold text-ink [text-wrap:balance] md:text-[28px]">{step.title}</h3>
          <p className="mt-3 text-base text-muted [text-wrap:pretty]">{step.body}</p>
          <ul className="mt-5 space-y-2">
            {step.points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-ink">
                <Check size={16} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />{p}
              </li>
            ))}
          </ul>
        </div>
        {/* 示意畫面：不是截圖，內容是虛構的，螢幕閱讀器略過 */}
        <div aria-hidden="true" key={step.key} className="min-w-0 rounded-card border border-line bg-bg p-4 motion-safe:animate-[fade-in_240ms_ease-out] md:p-5">
          <step.Mock />
        </div>
      </div>
    </section>
  );
}

const mockCard = "rounded-input border border-line bg-surface";
const mockLabel = "text-[11px] text-muted";

function FindMock() {
  const people = [["滿", "小滿", "美妝・保養", "2.4 萬"], ["禾", "阿禾", "美食・旅遊", "8,600"], ["青", "青青", "穿搭・生活", "5.1 萬"]];
  return (
    <div>
      <div className={`${mockCard} flex items-center gap-2 px-3 py-2 text-xs text-muted`}>
        <Search size={14} strokeWidth={1.5} />美妝・台北市・粉絲 1 萬以上
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {people.map(([ch, name, cat, fans], i) => (
          <div key={name} className={`${mockCard} overflow-hidden`}>
            <div className={`flex aspect-square items-center justify-center font-serif text-3xl font-bold ${i === 0 ? "bg-primary-soft text-ink" : "bg-panel text-line-strong"}`}>{ch}</div>
            <div className="p-2">
              <p className="flex items-center justify-between text-xs font-bold text-ink">{name}{i === 0 && <span className="inline-flex items-center gap-0.5 font-semibold"><Star size={10} className="fill-current text-primary" />4.9</span>}</p>
              <p className={`${mockLabel} truncate`}>{cat}</p>
              <p className={`${mockLabel} tabular-nums`}>{fans} 粉絲</p>
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
      <p className="text-sm font-bold text-ink">春季新品開箱</p>
      <dl className="mt-3 space-y-2 text-xs">
        <div><dt className={mockLabel}>交付內容</dt><dd className="text-ink">IG 貼文 1 則＋限時動態 2 則</dd></div>
        <div className="flex gap-6">
          <div><dt className={mockLabel}>金額</dt><dd className="text-base font-bold tabular-nums text-ink">NT$6,000</dd></div>
          <div><dt className={mockLabel}>狀態</dt><dd className="font-semibold text-ink">等創作者確認</dd></div>
        </div>
      </dl>
      <div className="mt-4 flex gap-2">
        <span className="inline-flex h-8 items-center rounded-btn bg-primary px-4 text-xs font-bold text-on-primary">接受</span>
        <span className="inline-flex h-8 items-center rounded-btn border border-line-strong px-4 text-xs font-bold text-ink">婉拒</span>
      </div>
    </div>
  );
}

function PayMock() {
  return (
    <div className={`${mockCard} p-4`}>
      <p className="flex items-center gap-2 text-sm font-bold text-ink"><Lock size={15} strokeWidth={1.5} className="text-success" />款項由平台保管中</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">NT$6,000</p>
      <ol className="mt-4 space-y-2 text-xs">
        {[["品牌已付款", true], ["創作者交稿", false], ["貼文發佈", false], ["撥款給創作者", false]].map(([t, done]) => (
          <li key={String(t)} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full border-2 ${done ? "border-thread bg-thread" : "border-line-strong"}`} />
            <span className={done ? "font-semibold text-ink" : "text-muted"}>{t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ReviewMock() {
  return (
    <div className={`${mockCard} p-4`}>
      <p className="text-sm font-bold text-ink">第 1 次交稿</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex aspect-square items-center justify-center rounded-input bg-panel text-line-strong"><FileImage size={22} strokeWidth={1.5} /></div>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold text-ink">還有 2 天 5 小時，沒審核會自動通過</p>
      <div className="mt-3 flex gap-2">
        <span className="inline-flex h-8 items-center rounded-btn bg-primary px-4 text-xs font-bold text-on-primary">通過</span>
        <span className="inline-flex h-8 items-center rounded-btn border border-line-strong px-4 text-xs font-bold text-ink">要求修改</span>
      </div>
    </div>
  );
}

function PayoutMock() {
  return (
    <div className="space-y-3">
      <div className={`${mockCard} flex items-center justify-between p-4`}>
        <div><p className={mockLabel}>已撥款</p><p className="text-xl font-bold tabular-nums text-ink">NT$6,000</p></div>
        <span className="inline-flex items-center gap-1 rounded-btn bg-success-soft px-3 py-1 text-xs font-bold text-success"><Check size={12} strokeWidth={2.5} />已完成</span>
      </div>
      <div className={`${mockCard} p-4`}>
        <p className="flex items-center gap-2 text-xs font-bold text-ink">
          品牌的評價
          <span className="inline-flex gap-0.5">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={12} className="fill-current text-primary" />)}</span>
        </p>
        <p className="mt-1.5 text-xs text-muted">準時交稿，溝通很順利，成品比預期好。</p>
      </div>
    </div>
  );
}
