const STEPS = [
  { title: "媒合", body: "品牌在創作者廣場找人直接邀請，或刊登招募讓創作者報名。條件寫清楚：交付內容、金額、期限。" },
  { title: "確認並付款", body: "創作者接受條件後，品牌付款。款項先交給平台保管，創作者交稿通過後才撥出。" },
  { title: "交稿審核", body: "創作者在平台上交稿，品牌審核：通過，或寫下要修改的地方。品牌超過 3 天沒有審核，系統會自動通過。" },
  { title: "發佈撥款", body: "創作者發佈貼文並貼上連結，平台確認後，以銀行轉帳把款項撥給創作者。" },
];

function Knot() {
  return (
    <span aria-hidden="true" className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-thread bg-bg">
      <span className="h-2 w-2 rounded-full bg-thread" />
    </span>
  );
}

/** 怎麼運作（規格 §5.3）：一條隨捲動畫出來的紅線串起四個結。只有 CSS（globals.css 的 .thread-draw）。 */
export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="mx-auto max-w-[1280px] px-5 py-14 md:px-16 md:py-28">
      <h2 id="how-title" className="font-serif text-[28px] font-bold text-ink [text-wrap:balance] md:text-[40px]">從牽線到撥款，四個結</h2>
      <div className="relative mt-10 md:mt-14">
        {/* 桌面：水平波浪，在 12.5%／37.5%／62.5%／87.5% 經過 y=12（四個結的位置） */}
        <svg aria-hidden="true" viewBox="0 0 100 24" preserveAspectRatio="none" className="absolute inset-x-0 top-0 hidden h-6 w-full lg:block">
          <path d="M0 12 Q6.25 2 12.5 12 T25 12 T37.5 12 T50 12 T62.5 12 T75 12 T87.5 12 T100 12" pathLength={1}
            fill="none" stroke="var(--color-thread)" strokeWidth="2" className="thread-draw" />
        </svg>
        <ol className="space-y-10 lg:grid lg:grid-cols-4 lg:gap-8 lg:space-y-0">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative flex gap-5 lg:flex-col lg:items-center lg:text-center">
              {/* 手機：從這個結的中心畫到下一個結的中心（最後一個結不畫） */}
              {i < STEPS.length - 1 && (
                <svg aria-hidden="true" viewBox="0 0 2 100" preserveAspectRatio="none" className="absolute left-[11px] top-3 h-[calc(100%+40px)] w-[2px] lg:hidden">
                  <path d="M1 0 V100" pathLength={1} fill="none" stroke="var(--color-thread)" strokeWidth="2" className="thread-draw" />
                </svg>
              )}
              <Knot />
              <div className="min-w-0">
                <p className="text-sm text-muted"><span className="sr-only">第 </span>{i + 1}<span className="sr-only"> 步</span></p>
                <h3 className="mt-1 text-xl font-bold text-ink [text-wrap:balance]">{s.title}</h3>
                <p className="mt-2 text-sm text-muted [text-wrap:pretty] lg:mx-auto lg:max-w-[260px]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
