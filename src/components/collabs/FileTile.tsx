import { FileText, Film } from "lucide-react";
import type { SubmissionFile } from "@/lib/collabs/load";

/** 一個交稿檔案：圖片顯示縮圖；影片與 PDF 顯示圖示與名稱。點了用 signed URL 開新分頁（有效 1 小時）。 */
export function FileTile({ f }: { f: SubmissionFile }) {
  const inner = f.kind === "image" && f.url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={f.url} alt={f.label} className="h-24 w-24 rounded-input border border-line object-cover" />
  ) : (
    <span className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-input border border-line bg-subtle text-xs text-ink">
      {f.kind === "video"
        ? <Film size={24} strokeWidth={1.5} aria-hidden="true" />
        : <FileText size={24} strokeWidth={1.5} aria-hidden="true" />}
      {f.label.split("・")[1] ?? f.label}
    </span>
  );
  if (!f.url) return <span title="連結產生失敗，請重新整理">{inner}</span>;
  return (
    <a href={f.url} target="_blank" rel="noopener noreferrer" aria-label={`${f.label}（在新分頁開啟）`} className="block rounded-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
      {inner}
    </a>
  );
}
