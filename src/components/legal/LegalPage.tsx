import Link from "next/link";
import { ThreadMark } from "@/components/ui/ThreadMark";
import { Notice } from "@/components/ui/Notice";
import { SupportLink } from "@/components/ui/SupportLink";
import { btn, h1, textLink } from "@/components/ui/styles";
import { LEGAL_DRAFT, PRIVACY_PAGE, SITE_NAME, SUPPORT_PAGE, TERMS_PAGE } from "@/lib/site";

/** 服務條款／隱私權政策的共用版面（與 /help 同一種公開頁）。草稿期間頂端顯示提示（LEGAL_DRAFT）。 */
export function LegalPage({ title, intro, children }: { title: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-10 md:py-16">
      <Link href="/" className="inline-flex min-h-11 items-center font-bold text-ink">{SITE_NAME}</Link>
      <ThreadMark variant="tied" className="mt-6" />
      <h1 className={`${h1} mt-4`}>{title}</h1>
      {LEGAL_DRAFT && <Notice tone="warning" className="mt-4">這份文件是草稿，正式上線前會再更新。</Notice>}
      <div className="mt-4 break-words text-muted">{intro}</div>
      <div className="mt-8 space-y-10">{children}</div>
      <section aria-labelledby="legal-contact" className="mt-10">
        <h2 id="legal-contact" className="text-lg font-bold text-ink">聯絡我們</h2>
        <p className="mt-2 text-sm text-muted">對這份文件或你的資料有任何問題，請聯絡我們，並附上你的帳號 Email。</p>
        <div className="mt-2"><SupportLink subject={title} /></div>
      </section>
      <nav aria-label="相關文件" className="mt-10 flex flex-wrap gap-x-6 border-t border-line pt-6 text-sm">
        <Link href={TERMS_PAGE} className={textLink}>服務條款</Link>
        <Link href={PRIVACY_PAGE} className={textLink}>隱私權政策</Link>
        <Link href={SUPPORT_PAGE} className={textLink}>需要協助？</Link>
      </nav>
      <Link href="/" className={`${btn.secondary} mt-8`}>回首頁</Link>
    </main>
  );
}

/** 條文段落：h2＋內文（內文用 text-sm text-muted，清單用 list-disc）。 */
export function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-bold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 break-words text-sm leading-relaxed text-muted [&_li]:mt-1.5 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
