/** 安心的設計（規格 §5.2）：只寫系統真的做到的事。 */
export function Trust() {
  const items: { title: string; body: string; note?: string }[] = [
    { title: "款項先交給平台", body: "品牌付款後，款項由平台保管；創作者交稿通過、發佈貼文後，平台才轉給創作者。", note: "目前付款與撥款都由平台人工確認、銀行轉帳處理。" },
    { title: "真人審核", body: "創作者要在 IG 自我介紹放上驗證碼，平台人工確認是本人帳號。" },
    { title: "訊息留在平台", body: "討論訊息與交稿檔案都留在平台上；要分享電話或 LINE 前，系統會先提醒你。" },
    { title: "遇到問題", body: "頁尾的「需要協助？」會列出聯絡方式。" },
  ];
  return (
    <section aria-labelledby="trust-title" className="border-y border-line bg-panel">
      <div className="mx-auto max-w-[1280px] px-5 py-20 md:px-16 md:py-24">
        <h2 id="trust-title" className="font-serif text-[28px] font-bold text-ink [text-wrap:balance] md:text-[40px]">我們怎麼保護每一次合作</h2>
        <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
          {items.map((it) => (
            <div key={it.title} className="border-l-2 border-thread pl-5">
              <dt className="text-lg font-bold text-ink">{it.title}</dt>
              <dd className="mt-1 text-sm text-muted [text-wrap:pretty]">
                {it.body}
                {it.note && <span className="mt-1 block">{it.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
