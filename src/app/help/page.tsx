import type { Metadata } from "next";
import Link from "next/link";
import { ThreadMark } from "@/components/ui/ThreadMark";
import { SupportLink } from "@/components/ui/SupportLink";
import { btn, h1 } from "@/components/ui/styles";
import { PAYMENT_MAX_TWD } from "@/lib/payments/limits";
import { formatTwd } from "@/lib/format";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "需要協助" };

const FAQ: { q: string; a: string }[] = [
  { q: "創作者帳號審核要多久？", a: "通常 1–2 個工作天。請先把驗證碼加到 IG 自我介紹，審核通過後就可以刪掉。" },
  { q: "帳號被暫停了怎麼辦？", a: "暫停期間不能報名、接案或傳訊息。請寄信給我們，附上你的網址代稱（@handle），我們會說明原因與後續。" },
  { q: `合作金額超過 ${formatTwd(PAYMENT_MAX_TWD)} 怎麼付款？`, a: "超過線上付款上限的合作案，請寄信給我們安排線下匯款；平台確認入帳後，合作案會自動進入交稿。" },
  { q: "品牌付款後，款項在哪裡？", a: "款項先由平台代管。創作者交稿、品牌審核通過、創作者發佈貼文後，平台才撥款給創作者。" },
  { q: "創作者多久會收到撥款？", a: "貼文連結送出後進入撥款處理。請先在「我的 → 收款帳戶」填好帳戶，沒有帳戶平台無法撥款。" },
];

export default function HelpPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-10 md:py-16">
      <Link href="/" className="inline-flex min-h-11 items-center font-bold text-ink">{SITE_NAME}</Link>
      <ThreadMark variant="tied" className="mt-6" />
      <h1 className={`${h1} mt-4`}>需要協助？</h1>
      <p className="mt-3 text-muted">寄信給我們，通常一個工作天內回覆。信裡附上你的帳號 Email 與相關的合作案名稱，會處理得比較快。</p>
      <div className="mt-4"><SupportLink /></div>
      <h2 className="mt-12 text-lg font-bold text-ink">常見問題</h2>
      <dl className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
        {FAQ.map((f) => (
          <div key={f.q} className="p-5">
            <dt className="font-bold text-ink">{f.q}</dt>
            <dd className="mt-2 text-sm text-muted">{f.a}</dd>
          </div>
        ))}
      </dl>
      <Link href="/" className={`${btn.secondary} mt-10`}>回首頁</Link>
    </main>
  );
}
