"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { acceptApplicationAction, rejectApplicationAction } from "@/app/brand/briefs/actions";
import { OfferForm } from "@/components/collabs/OfferForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkPending } from "@/components/ui/LinkPending";
import { Pagination } from "@/components/ui/Pagination";
import { btn, chip, rows, textLink } from "@/components/ui/styles";
import { Avatar } from "@/components/square/Avatar";
import { acceptDefaults } from "@/lib/validation/collab";
import { APPLICANTS_ANCHOR } from "@/lib/briefs/query";
import { APPLICANT_EMPTY_TEXT, APPLICANT_FILTERS, proposedPriceLabel, type Applicant, type ApplicantCounts, type ApplicantFilter } from "@/lib/briefs/view";
import { formatDateTimeTw } from "@/lib/briefs/dates";
import { formatNumber, formatPercent } from "@/lib/format";
import { pageHref } from "@/lib/paging";
import { RatingBadge } from "@/components/reviews/RatingBadge";
import type { ReviewStats } from "@/lib/reviews/view";
import { ConfirmAction } from "./ConfirmAction";
import { ApplicationStatusBadge } from "./StatusBadges";

/** 錄取表單預設值需要的招募資料。 */
export type OfferBrief = { budgetMin: number | null; budgetMax: number | null; collabTypes: string[]; description: string };

/**
 * 報名者列表：篩選（全部、待處理、已錄取、已婉拒）與分頁都在網址（?applicants=、?page=），由伺服器取這一頁。
 * 換篩選時畫面不捲動（scroll={false}）；換頁時回到報名者區塊的開頭（#applicants）。
 */
export function ApplicantList({ briefId, brief, applicants, filter, counts, page, stats = {} }: {
  briefId: string; brief: OfferBrief; applicants: Applicant[]; filter: ApplicantFilter; counts: ApplicantCounts; page: number;
  /** 這一頁報名者的評分（creatorId → 統計）；沒有的人不顯示 */
  stats?: Record<string, ReviewStats>;
}) {
  const base = `/brand/briefs/${briefId}`;
  const hrefFor = (f: ApplicantFilter, p = 1) =>
    pageHref(base, { applicants: f === "all" ? undefined : f }, p, p > 1 || page > 1 ? `#${APPLICANTS_ANCHOR}` : "");

  return (
    <div>
      <nav aria-label="篩選報名者" className="scroll-fade-x flex gap-2 overflow-x-auto pb-1">
        {APPLICANT_FILTERS.map((f) => (
          <Link
            key={f.value} href={hrefFor(f.value)} scroll={false} replace
            aria-current={filter === f.value ? "page" : undefined} className={chip(filter === f.value)}
          >
            {f.label} <span className="tabular-nums opacity-80">{formatNumber(counts[f.value])}</span><LinkPending />
          </Link>
        ))}
      </nav>
      <div className="mt-4">
        {applicants.length === 0 ? (
          <EmptyState
            text={APPLICANT_EMPTY_TEXT[filter]}
            secondary={filter === "all" ? undefined : { href: hrefFor("all"), label: "看全部報名者" }}
          />
        ) : (
          <ul className={rows}>
            {applicants.map((a) => <li key={a.id} className="p-4 md:p-5"><ApplicantItem a={a} briefId={briefId} brief={brief} stats={stats[a.creatorId]} /></li>)}
          </ul>
        )}
      </div>
      <Pagination page={page} total={counts[filter]} hrefFor={(p) => hrefFor(filter, p)} label="報名者分頁" unit="人" />
    </div>
  );
}

function ApplicantItem({ a, briefId, brief, stats }: { a: Applicant; briefId: string; brief: OfferBrief; stats?: ReviewStats }) {
  const [accepting, setAccepting] = useState(false);

  return (
    <article>
      <div className="flex items-start gap-3">
        <Avatar path={a.avatarPath} name={a.displayName} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/c/${a.handle}`} className="inline-flex min-h-11 min-w-0 items-center break-words font-bold text-ink underline-offset-2 hover:underline">
              {a.displayName}
            </Link>
            <ApplicationStatusBadge status={a.status} viewer="brand" />
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
            <span>粉絲 {formatNumber(a.followerCount)}</span>
            <span>互動率 {formatPercent(a.engagementRate)}</span>
            <RatingBadge stats={stats} />
            {a.region && <span className="inline-flex items-center gap-0.5"><MapPin size={12} strokeWidth={1.5} aria-hidden="true" />{a.region}</span>}
            <span>報名於 {formatDateTimeTw(a.createdAt)}</span>
          </p>
        </div>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted">提出的報價</dt>
          <dd className="font-semibold text-ink">{proposedPriceLabel(a.proposedPrice)}</dd>
        </div>
        {a.message && (
          <div>
            <dt className="text-xs text-muted">給品牌的話</dt>
            <dd className="whitespace-pre-line break-words text-ink">{a.message}</dd>
          </div>
        )}
      </dl>
      {a.status === "applied" && !accepting && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
          <button type="button" onClick={() => setAccepting(true)} className={`${btn.primary} w-full shrink-0 sm:w-auto`}>錄取</button>
          <ConfirmAction
            label="婉拒報名" danger icon="x" confirmLabel="確定婉拒"
            message={`婉拒後不能復原，${a.displayName} 會看到「未錄取」。確定要婉拒嗎？`}
            onConfirm={() => rejectApplicationAction(a.id, briefId)}
          />
        </div>
      )}
      {a.status === "applied" && accepting && (
        <div className="mt-4 rounded-card border border-line bg-subtle p-4">
          <p className="mb-3 text-sm font-semibold text-ink">錄取 {a.displayName}：設定合作條件</p>
          <OfferForm
            action={acceptApplicationAction} hidden={{ applicationId: a.id, briefId }} withTitle={false}
            defaults={acceptDefaults(a.proposedPrice, brief)} submitLabel="錄取並建立合作案" proposedPrice={a.proposedPrice}
            onCancel={() => setAccepting(false)}
          />
        </div>
      )}
      {a.collaborationId && (
        <Link href={`/brand/collabs/${a.collaborationId}`} className={`mt-3 ${textLink}`}>
          查看合作案
        </Link>
      )}
    </article>
  );
}
