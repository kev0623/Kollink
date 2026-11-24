import Link from "next/link";
import { Check } from "lucide-react";
import { deadlineLabel } from "@/lib/briefs/dates";
import { audienceLabel, rewardLabel, type Opportunity } from "@/lib/briefs/view";
import { formatNumber } from "@/lib/format";
import { BrandMark } from "./BrandMark";
import { BriefCover } from "./BriefCover";

/** 機會卡片（ui-design §5.4）。整張可點，連到 /creator/briefs/<id>。 */
export function OpportunityCard({ o, today }: { o: Opportunity; today: string }) {
  const applied = o.myStatus !== null;
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface focus-within:ring-2 focus-within:ring-ink hover:border-ink">
      <BriefCover coverPath={o.coverPath} brandName={o.brandName} brandLogoPath={o.brandLogoPath} />
      {applied && (
        <span className="absolute right-3 top-3 rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-on-ink">
          {o.myStatus === "withdrawn" ? "已撤回" : "已報名"}
        </span>
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <BrandMark name={o.brandName} logoPath={o.brandLogoPath} size="sm" />
          <p className="min-w-0 truncate text-sm text-muted">{o.brandName}</p>
        </div>
        <div>
          <h3 className="break-words font-bold text-ink">
            <Link href={`/creator/briefs/${o.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
              {o.title}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted">{o.collabTypes.join("、")}</p>
        </div>
        <p className="text-lg font-bold text-primary">{rewardLabel(o)}</p>
        {o.isMatch && (
          <p className="inline-flex w-fit items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
            <Check size={14} strokeWidth={1.5} aria-hidden="true" />符合你的條件
          </p>
        )}
        <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div className="min-w-0"><dt className="sr-only">門檻</dt><dd className="truncate text-muted">{audienceLabel(o.minFollowers)}</dd></div>
          <div className="min-w-0"><dt className="sr-only">地區</dt><dd className="truncate text-muted">{o.region ?? "地區不限"}</dd></div>
          <div><dt className="sr-only">已報名</dt><dd className="text-muted">已報名 {formatNumber(o.applicantCount)} 人</dd></div>
          <div><dt className="sr-only">截止</dt><dd className="font-semibold text-ink">{deadlineLabel(o.deadline, today)}</dd></div>
        </dl>
      </div>
    </article>
  );
}
