import Link from "next/link";
import { SUPPORT_EMAIL, SUPPORT_LINE_URL, SUPPORT_PAGE, isSupportPlaceholder, supportMailto } from "@/lib/site";

/** 「聯絡我們」：信箱（mailto）＋（有設定時）LINE＋說明頁。subject 帶入信件主旨；onHelpPage 時不再顯示指向 /help 的連結。
 * 信箱還是佔位值時不顯示會寄不出去的 mailto，改顯示「聯絡方式準備中」。 */
export function SupportLink({ subject, compact = false, onHelpPage = false }: { subject?: string; compact?: boolean; onHelpPage?: boolean }) {
  const link = "inline-flex min-h-11 min-w-11 items-center justify-center font-semibold text-ink underline underline-offset-4 hover:text-accent";
  if (compact) return <Link href={SUPPORT_PAGE} className={link}>聯絡我們</Link>;
  const placeholder = isSupportPlaceholder();
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3">
      {placeholder ? (
        <span className="inline-flex min-h-11 items-center text-muted">聯絡方式準備中</span>
      ) : (
        <a href={supportMailto(subject)} className={link}>寄信給 {SUPPORT_EMAIL}</a>
      )}
      {SUPPORT_LINE_URL && <a href={SUPPORT_LINE_URL} target="_blank" rel="noopener noreferrer" className={link}>LINE 客服</a>}
      {!onHelpPage && <Link href={SUPPORT_PAGE} className={link}>常見問題</Link>}
    </span>
  );
}
