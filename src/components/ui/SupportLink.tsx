import Link from "next/link";
import { SUPPORT_EMAIL, SUPPORT_LINE_URL, SUPPORT_PAGE, supportMailto } from "@/lib/site";

/** 「聯絡我們」：信箱（mailto）＋（有設定時）LINE＋說明頁。subject 帶入信件主旨。 */
export function SupportLink({ subject, compact = false }: { subject?: string; compact?: boolean }) {
  const link = "inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4 hover:text-accent";
  if (compact) return <Link href={SUPPORT_PAGE} className={link}>聯絡我們</Link>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3">
      <a href={supportMailto(subject)} className={link}>寄信給 {SUPPORT_EMAIL}</a>
      {SUPPORT_LINE_URL && <a href={SUPPORT_LINE_URL} target="_blank" rel="noopener noreferrer" className={link}>LINE 客服</a>}
      <Link href={SUPPORT_PAGE} className={link}>常見問題</Link>
    </span>
  );
}
