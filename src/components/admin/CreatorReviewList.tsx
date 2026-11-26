import { formatDateTimeTw } from "@/lib/briefs/dates";
import { formatNumber } from "@/lib/format";
import { CREATOR_STATUS_LABEL, creatorActions, igUrl, type AdminCreator } from "@/lib/admin/view";
import { CreatorReviewActions } from "./CreatorReviewActions";
import { emptyClassName } from "./styles";

/** 審核列表：一列一位創作者（手機也是直式卡片，不用表格）。 */
export function CreatorReviewList({ items }: { items: AdminCreator[] }) {
  if (items.length === 0) return <p className={emptyClassName}>沒有符合的創作者</p>;
  return (
    <ul className="mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {items.map((c) => (
        <li key={c.userId} className="space-y-2 p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 break-words font-semibold text-ink">{c.displayName}</p>
            <span className="rounded-full bg-subtle px-2.5 py-0.5 text-xs font-semibold text-ink">{CREATOR_STATUS_LABEL[c.status]}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">網址代稱</dt><dd className="min-w-0 break-all">@{c.handle}</dd>
            <dt className="text-muted">IG</dt>
            <dd className="min-w-0 break-all">
              <a href={igUrl(c.igUsername)} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                {c.igUsername}
              </a>
              <span className="text-muted">（自填粉絲 {formatNumber(c.followerCount)}）</span>
            </dd>
            {c.verificationCode && (
              <>
                <dt className="text-muted">驗證碼</dt>
                <dd><b className="rounded-btn bg-ink px-2 py-0.5 tracking-widest text-on-ink">{c.verificationCode}</b></dd>
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
