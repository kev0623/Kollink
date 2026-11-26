import { formatDateTimeTw } from "@/lib/briefs/dates";
import { formatNumber } from "@/lib/format";
import { CREATOR_STATUS_LABEL, creatorActions, igUrl, type AdminCreator } from "@/lib/admin/view";
import { CreatorReviewActions } from "./CreatorReviewActions";
import { CopyButton } from "@/components/ui/CopyButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { rows, textLink } from "@/components/ui/styles";

/** 審核列表：一列一位創作者（手機也是直式卡片，不用表格）。 */
export function CreatorReviewList({ items }: { items: AdminCreator[] }) {
  if (items.length === 0) return <EmptyState text="沒有符合的創作者" />;
  return (
    <ul className={rows}>
      {items.map((c) => (
        <li key={c.userId} className="space-y-3 px-4 py-4 md:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 break-words font-semibold text-ink">{c.displayName}</p>
            <span className="rounded-full bg-subtle px-2.5 py-0.5 text-xs font-semibold text-ink">{CREATOR_STATUS_LABEL[c.status]}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">網址代稱</dt><dd className="min-w-0 break-all">{c.handle ? `@${c.handle}` : "—"}</dd>
            <dt className="text-muted">IG</dt>
            <dd className="min-w-0 break-all">
              {c.igUsername ? (
                <a href={igUrl(c.igUsername)} target="_blank" rel="noopener noreferrer" className={textLink}>
                  {c.igUsername}
                </a>
              ) : "—"}
              <span className="text-muted">（自填粉絲 {formatNumber(c.followerCount)}）</span>
            </dd>
            {c.verificationCode && (
              <>
                <dt className="text-muted">驗證碼</dt>
                <dd className="flex flex-wrap items-center gap-1"><b className="rounded-btn border border-line-strong bg-subtle px-2 py-0.5 font-mono tracking-widest text-ink">{c.verificationCode}</b><CopyButton text={c.verificationCode} /></dd>
              </>
            )}
            <dt className="text-muted">地區／領域</dt>
            <dd className="min-w-0 break-words">{[c.region, ...c.categories].filter(Boolean).join("、") || "—"}</dd>
            <dt className="text-muted">申請時間</dt><dd>{c.createdAt ? formatDateTimeTw(c.createdAt) : "—"}</dd>
            {c.reviewNote && (
              <>
                <dt className="text-muted">原因</dt><dd className="min-w-0 whitespace-pre-wrap break-words">{c.reviewNote}</dd>
              </>
            )}
          </dl>
          <CreatorReviewActions userId={c.userId} handle={c.handle} actions={creatorActions(c.status)} />
        </li>
      ))}
    </ul>
  );
}
