import {
  BRAND_APPLICATION_LABEL, BRIEF_STATUS_LABEL, CREATOR_APPLICATION_LABEL,
  type ApplicationStatus, type BriefDisplayStatus,
} from "@/lib/briefs/view";

const base = "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";

const BRIEF_TONE: Record<BriefDisplayStatus, string> = {
  draft: "border border-line bg-surface text-ink",
  open: "bg-success-soft text-success",
  expired: "bg-subtle text-muted",
  closed: "bg-subtle text-muted",
};

const APPLICATION_TONE: Record<ApplicationStatus, string> = {
  applied: "border border-line bg-surface text-ink",
  accepted: "bg-success-soft text-success",
  rejected: "bg-subtle text-muted",
  withdrawn: "bg-subtle text-muted",
};

export function BriefStatusBadge({ status }: { status: BriefDisplayStatus }) {
  return <span className={`${base} ${BRIEF_TONE[status]}`}>{BRIEF_STATUS_LABEL[status]}</span>;
}

export function ApplicationStatusBadge({ status, viewer }: { status: ApplicationStatus; viewer: "brand" | "creator" }) {
  const label = (viewer === "brand" ? BRAND_APPLICATION_LABEL : CREATOR_APPLICATION_LABEL)[status];
  return <span className={`${base} ${APPLICATION_TONE[status]}`}>{label}</span>;
}
