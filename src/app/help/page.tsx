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
  { q: "創作者帳號怎麼通過審核？", a: "請先把驗證碼加到 IG 自我介紹，我們核對後就會處理審核；通過後驗證碼就可以刪掉。" },
  { q: "帳號被暫停了怎麼辦？", a: "帳號暫停期間，對話會暫停，也不能成立新的合作。想了解原因或要申訴，請聯絡我們，並附上你的帳號 Email。" },
  { q: `合作金額超過 ${formatTwd(PAYMENT_MAX_TWD)} 怎麼付款？`, a: "超過線上付款上限的合作案，請聯絡我們安排線下匯款；平台確認入帳後會標記已付款，合作案進入交稿。" },
  { q: "品牌付款後，款項在哪裡？", a: "款項付款後先由平台保管。創作者交稿、品牌審核通過、創作者發佈貼文後，平台才撥款給創作者。" },
  { q: "撥款需要什麼？", a: "品牌審核通過並完成發佈後，合作案進入撥款。創作者需要先在「我的」裡的「收款帳戶」填好帳戶，沒有帳戶平台無法撥款；平台以人工轉帳撥款。" },
];

export default function HelpPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-10 md:py-16">
      <Link href="/" className="inline-flex min-h-11 items-center font-bold text-ink">{SITE_NAME}</Link>
      <ThreadMark variant="tied" className="mt-6" />
      <h1 className={`${h1} mt-4`}>需要協助？</h1>
      <p className="mt-3 text-muted">聯絡我們，我們會盡快回覆。請附上你的帳號 Email 與相關的合作案名稱，會處理得比較快。</p>
      <div className="mt-4"><SupportLink onHelpPage /></div>
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
