const BRAND = [
  "每位創作者都經過人工審核，才會出現在廣場。",
  "看得到粉絲數、互動率、作品與報價，用類別與地區篩選。",
  "一個招募收齊報名，錄取、婉拒都在同一頁。",
  "合作進度一條線看到底，現在輪到誰一眼就知道。",
];
const CREATOR = [
  "一個公開頁放作品與報價，報價只給品牌看。",
  "品牌找上門，或自己報名有興趣的招募。",
  "品牌付款後才開始工作；交稿通過、發佈後撥款。",
  "撥款全額轉到你的帳戶，平台不收手續費。",
];

function Column({ id, title, items }: { id: string; title: string; items: string[] }) {
  return (
    <div className="min-w-0">
      <h3 id={id} className="font-serif text-2xl font-bold text-ink">{title}</h3>
      <ul aria-labelledby={id} className="mt-4 divide-y divide-line border-y border-line">
        {items.map((t) => <li key={t} className="py-4 text-base text-ink">{t}</li>)}
      </ul>
    </div>
  );
}

export function ForBoth() {
  return (
    <section aria-label="品牌與創作者各得到什麼" className="mx-auto max-w-[1280px] px-5 pb-20 md:px-16 md:pb-28">
      <div className="grid gap-12 lg:grid-cols-[1fr_1px_1fr] lg:gap-16">
        <Column id="for-brand" title="給品牌" items={BRAND} />
        <div aria-hidden="true" className="hidden bg-thread opacity-60 lg:block" />
        <Column id="for-creator" title="給創作者" items={CREATOR} />
      </div>
    </section>
  );
}
