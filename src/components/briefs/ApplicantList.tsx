"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { rejectApplicationAction } from "@/app/brand/briefs/actions";
import { Avatar } from "@/components/square/Avatar";
import { isStaleStateMessage } from "@/lib/briefs/errors";
import { APPLICANT_FILTERS, filterApplicants, proposedPriceLabel, type Applicant, type ApplicantFilter } from "@/lib/briefs/view";
import { formatDateTimeTw } from "@/lib/briefs/dates";
import { formatNumber, formatPercent } from "@/lib/format";
import { ApplicationStatusBadge } from "./StatusBadges";

/** 報名者列表與篩選（全部、待處理、已錄取、已婉拒）。篩選只在畫面上，不寫進網址。 */
export function ApplicantList({ briefId, applicants }: { briefId: string; applicants: Applicant[] }) {
  const [filter, setFilter] = useState<ApplicantFilter>("all");
  const shown = filterApplicants(applicants, filter);
  return (
    <div>
      <div role="group" aria-label="篩選報名者" className="flex flex-wrap gap-2">
        {APPLICANT_FILTERS.map((f) => (
          <button
            key={f.value} type="button" onClick={() => setFilter(f.value)} aria-pressed={filter === f.value}
            className={`h-9 rounded-full border px-4 text-sm font-semibold ${filter === f.value ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-ink"}`}
          >
            {f.label} {filterApplicants(applicants, f.value).length}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-4 rounded-card border border-line bg-surface p-6 text-center text-sm text-muted">沒有符合的報名者</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((a) => <li key={a.id}><ApplicantItem a={a} briefId={briefId} /></li>)}
        </ul>
      )}
    </div>
  );
}

function ApplicantItem({ a, briefId }: { a: Applicant; briefId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(accept: boolean) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = accept ? { ok: false as const, error: "請重新整理頁面" } : await rejectApplicationAction(a.id, briefId);
        if (!res.ok) {
          if (isStaleStateMessage(res.error)) {
            // 連點或另一個分頁已處理：重新整理即可
            setNotice("這筆報名的狀態已更新，已為你重新整理");
            router.refresh();
          } else {
            setError(res.error);
          }
        }
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }

  return (
    <article className="rounded-card border border-line bg-surface p-4 md:p-5">
      <div className="flex items-start gap-3">
        <Avatar path={a.avatarPath} name={a.displayName} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/c/${a.handle}`} className="min-w-0 break-words font-bold text-ink underline-offset-2 hover:underline">
              {a.displayName}
            </Link>
            <ApplicationStatusBadge status={a.status} viewer="brand" />
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
            <span>粉絲 {formatNumber(a.followerCount)}</span>
            <span>互動率 {formatPercent(a.engagementRate)}</span>
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
      {a.status === "applied" && (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => decide(true)} disabled={pending}
            className="h-10 flex-1 rounded-btn bg-ink px-4 text-sm font-semibold text-on-ink disabled:opacity-60 sm:flex-none">
            {pending ? "處理中…" : "錄取"}
          </button>
          <button type="button" onClick={() => decide(false)} disabled={pending}
            className="h-10 flex-1 rounded-btn border border-line bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-60 sm:flex-none">
            婉拒
          </button>
        </div>
      )}
      {notice && <p role="status" className="mt-2 text-sm text-muted">{notice}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </article>
  );
}
