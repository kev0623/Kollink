import type { SubmissionView } from "@/lib/collabs/load";
import { textLink } from "@/components/ui/styles";
import { h2 } from "@/components/ui/styles";
import { eventTime } from "@/lib/collabs/view";
import { FILE_GRID, FileTile } from "./FileTile";

/** 交稿紀錄：依輪次排列；品牌要求修改的說明顯示在對應那一輪下方。 */
export function SubmissionList({ submissions }: { submissions: SubmissionView[] }) {
  return (
    <section aria-labelledby="submissions-title">
      <h2 id="submissions-title" className={h2}>交稿紀錄</h2>
      {submissions.length === 0 ? (
        <p className="mt-3 rounded-card border border-line bg-surface p-6 text-center text-sm text-muted">還沒有交稿</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {submissions.map((s) => (
            <li key={s.id} className="rounded-card border border-line bg-surface p-4 md:p-5">
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold text-ink">第 {s.round} 次交稿</span>
                <span className="text-xs text-muted">{eventTime(s.createdAt)}</span>
              </p>
              {s.files.length > 0 && (
                <ul className={`mt-3 ${FILE_GRID}`}>
                  {s.files.map((f) => <li key={f.path}><FileTile f={f} /></li>)}
                </ul>
              )}
              {s.links.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {s.links.map((l) => (
                    <li key={l} className="min-w-0 break-all">
                      <a href={l} target="_blank" rel="noopener noreferrer" className={`${textLink} break-all`}>{l}</a>
                    </li>
                  ))}
                </ul>
              )}
              {s.note && <p className="mt-3 whitespace-pre-line break-words text-sm text-ink">{s.note}</p>}
              {s.revisionNotes.map((n, i) => (
                <div key={i} className="mt-3 rounded-input border border-line bg-subtle p-3 text-sm">
                  <p className="text-xs font-bold text-muted">品牌要求修改</p>
                  <p className="mt-1 whitespace-pre-line break-words text-ink">{n}</p>
                </div>
              ))}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
