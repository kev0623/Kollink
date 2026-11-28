import type { Metadata } from "next";
import Link from "next/link";
import { PartyPopper } from "lucide-react";
import { OnboardingProgress } from "@/components/auth/OnboardingProgress";
import { btn, cardPad, h1 } from "@/components/ui/styles";

export const metadata: Metadata = { title: "資料已送出" };

/** 註冊完成後的說明頁。驗證碼在上方的審核橫幅（creator/layout 的 StatusBanner）。 */
const NEXT_STEPS = [
  { title: "把驗證碼加到 IG 自我介紹", body: "驗證碼在這一頁最上方。我們用它確認帳號是你本人的，審核通過後就可以刪掉。" },
  { title: "等待審核", body: "通過後你的頁面會公開，品牌可以搜尋到你、直接邀請合作，你也可以報名招募。" },
  { title: "接案、交稿、收款", body: "品牌付的款項先由平台保管，你交稿、品牌驗收通過後才撥款給你。" },
] as const;

export default function CreatorWelcomePage() {
  return (
    <div className="mx-auto max-w-xl">
      <OnboardingProgress current={3} />
      <section className={`${cardPad} text-center`}>
        <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-card bg-subtle text-ink"><PartyPopper size={26} strokeWidth={1.5} /></span>
        <h1 className={`${h1} mt-4`}>資料已送出審核</h1>
        <p className="mt-2 text-sm text-muted">等審核的時候，可以先上傳作品和自我介紹，品牌會先看這些。</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/creator/me/profile" className={btn.primary}>上傳作品</Link>
          <Link href="/creator" className={btn.secondary}>先逛逛招募</Link>
        </div>
      </section>
      <section aria-labelledby="next-steps" className="mt-8">
        <h2 id="next-steps" className="text-lg font-bold text-ink">接下來</h2>
        <ol className={`${cardPad} mt-3 space-y-5`}>
          {NEXT_STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle text-sm font-bold tabular-nums text-ink">{i + 1}</span>
              <div>
                <p className="font-bold text-ink">{s.title}</p>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
