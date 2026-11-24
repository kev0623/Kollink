import { Check, X } from "lucide-react";
import { audienceLabel, deadlineText, matchItems, rewardLabel, type BriefDetailData, type MatchFlags } from "@/lib/briefs/view";
import { formatNumber } from "@/lib/format";
import { BrandMark } from "./BrandMark";
import { BriefCover } from "./BriefCover";

type Props = {
  brief: BriefDetailData;
  today: string;
  /** 創作者看時帶入：條件逐項顯示符合或不符合。品牌預覽時省略。 */
  match?: MatchFlags;
  /** 右欄（桌面）／底部（手機）：報名區塊。 */
  aside?: React.ReactNode;
  /** 標題層級：頁面已有自己的 h1 時用 2（標題 h2、段落 h3）。預設 1。 */
  headingLevel?: 1 | 2;
};

/** 招募詳情（創作者看到的樣子）。品牌表單第 4 步的預覽也用這個元件，所以不能用 hook。 */
export function BriefDetailView({ brief: b, today, match, aside, headingLevel = 1 }: Props) {
  const Title = headingLevel === 1 ? "h1" : "h2";
  const Section = headingLevel === 1 ? "h2" : "h3";
  return (
    <div className={aside ? "grid gap-4 md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-6" : ""}>
      <article className="min-w-0 overflow-hidden rounded-card border border-line bg-surface">
        <BriefCover coverPath={b.coverPath} brandName={b.brandName} brandLogoPath={b.brandLogoPath} />
        <div className="space-y-6 p-5 md:p-8">
          <div>
            <div className="flex items-center gap-2">
              <BrandMark name={b.brandName} logoPath={b.brandLogoPath} size="sm" />
              <p className="min-w-0 truncate text-sm font-semibold text-ink">{b.brandName}</p>
            </div>
            <Title className="mt-3 break-words text-2xl font-bold text-ink md:text-[28px]">{b.title}</Title>
            <p className="mt-2 text-xl font-bold text-primary">{rewardLabel(b)}</p>
            {b.collabTypes.length > 0 && (
              <ul aria-label="合作形式" className="mt-3 flex flex-wrap gap-2">
                {b.collabTypes.map((t) => (
                  <li key={t} className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink">{t}</li>
                ))}
              </ul>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">截止日</dt>
              <dd className="mt-0.5 font-semibold text-ink">
                {b.deadline ? deadlineText(b.status, b.deadline, today) : "未設定"}
              </dd>
            </div>
            {b.applicantCount !== null && (
              <div>
                <dt className="text-xs text-muted">已報名</dt>
                <dd className="mt-0.5 font-semibold text-ink">{formatNumber(b.applicantCount)} 人</dd>
              </div>
            )}
          </dl>
          <section>
            <Section className="text-sm font-bold text-ink">合作說明</Section>
            <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-ink">{b.description || "—"}</p>
          </section>
          <section>
            <Section className="text-sm font-bold text-ink">創作者條件</Section>
            {match ? (
              <ul className="mt-2 space-y-1.5 text-sm">
                {matchItems({ ...b, match }).map((it) => (
                  <li key={it.label} className="flex items-start gap-2">
                    {it.ok
                      ? <Check size={16} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
                      : <X size={16} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />}
                    <span className="min-w-0 break-words text-ink">{it.label}</span>
                    <span className="sr-only">{it.ok ? "（符合）" : "（不符合）"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm text-ink">
                <li>{audienceLabel(b.minFollowers)}</li>
                <li>{b.region ? `地區：${b.region}` : "地區不限"}</li>
                <li>{b.categories.length ? `內容領域：${b.categories.join("、")}` : "內容領域不限"}</li>
              </ul>
            )}
          </section>
        </div>
      </article>
      {aside}
    </div>
  );
}
