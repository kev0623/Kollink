import { ChevronDown } from "lucide-react";
import { T } from "@/components/i18n/T";
import type { L } from "@/lib/lang";

// 只寫系統現在真的做到的事（與 Trust、ForBoth 的說法一致）。
const ITEMS: { q: L; a: L }[] = [
  {
    q: { zh: "使用要收費嗎？", en: "Does it cost anything?" },
    a: { zh: "註冊、瀏覽創作者、刊登招募都免費。目前平台不收手續費，創作者收到的金額就是合作案的報價。之後如果調整，會先公告。", en: "Signing up, browsing creators and posting briefs are free. There is currently no platform fee, so creators receive the full agreed amount. If that changes, we will announce it first." },
  },
  {
    q: { zh: "創作者是怎麼審核的？", en: "How are creators reviewed?" },
    a: { zh: "創作者註冊後，要在 IG 自我介紹放上平台給的驗證碼，由平台人工確認帳號是本人的，通過後才會出現在列表上。", en: "After signing up, a creator adds a code we give them to their Instagram bio. Our team checks the account is theirs before they appear in the list." },
  },
  {
    q: { zh: "品牌付的錢什麼時候會到創作者手上？", en: "When does the creator get paid?" },
    a: { zh: "品牌付款後款項由平台保管。創作者交稿、品牌審核通過、貼文發佈之後，平台以銀行轉帳撥給創作者。目前付款確認與撥款由平台人工處理。", en: "We hold the brand's payment. After the creator delivers, the brand approves and the post is live, we pay the creator by bank transfer. For now our team handles confirmation and payout by hand." },
  },
  {
    q: { zh: "創作者沒有交稿怎麼辦？", en: "What if the creator never delivers?" },
    a: { zh: "款項還在平台手上，沒有撥出去。聯絡平台後，由平台取消合作案並安排退款。", en: "The money is still with us and has not been paid out. Contact us and we will cancel the collaboration and arrange a refund." },
  },
  {
    q: { zh: "可以私下聯絡、不透過平台嗎？", en: "Can we just deal with each other directly?" },
    a: { zh: "平台不會阻止你們交換聯絡方式，但只有在平台上成立的合作才有款項保管、交稿紀錄與評價。私下交易出了問題，平台幫不上忙。", en: "We don't stop you from exchanging contact details, but only collaborations made here get held payments, delivery records and reviews. If an off-platform deal goes wrong, we can't help." },
  },
  {
    q: { zh: "評價可信嗎？", en: "Can I trust the reviews?" },
    a: { zh: "評價只能由完成合作的雙方撰寫，而且兩邊都寫完才會一起公開，寫的時候看不到對方的內容。", en: "Only the two sides of a completed collaboration can write one, and both are published together once both are written, so neither side sees the other's first." },
  },
];

/** 常見問題：原生 <details>，不用 JavaScript，鍵盤與螢幕閱讀器都能用。 */
export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-[1280px] scroll-mt-20 px-5 py-16 md:px-16 md:py-28">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
        <h2 id="faq-title" className="reveal font-serif text-[30px] font-bold text-ink md:text-[44px]">
          <T zh="開始之前，你可能想問" en="Before you start" />
        </h2>
        <div className="reveal divide-y divide-line border-y border-line">
          {ITEMS.map((it) => (
            <details key={it.q.zh} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-base font-bold text-ink outline-none transition-colors duration-150 hover:text-accent focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
                <span><T {...it.q} /></span>
                <ChevronDown size={18} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-5 pr-8 text-sm text-muted [text-wrap:pretty]"><T {...it.a} /></p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
