import { COLLAB_STATUS_LABEL, type CollabStatus, type ListBadge } from "@/lib/collabs/view";

const base = "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";

const STATUS_TONE: Record<CollabStatus, string> = {
  invited: "border border-line bg-surface text-ink",
  awaiting_payment: "border border-line bg-surface text-ink",
  awaiting_submission: "border border-line bg-surface text-ink",
  in_review: "border border-line bg-surface text-ink",
  awaiting_publish: "border border-line bg-surface text-ink",
  awaiting_payout: "bg-primary-soft text-ink",
  completed: "bg-success-soft text-success",
  declined: "bg-primary-soft text-muted",
  cancelled: "bg-primary-soft text-muted",
};

const TURN_TONE: Record<ListBadge["tone"], string> = {
  turn: "bg-ink text-on-ink",
  wait: "bg-primary-soft text-muted",
  platform: "bg-primary-soft text-ink",
};

export function CollabStatusBadge({ status }: { status: CollabStatus }) {
  return <span className={`${base} ${STATUS_TONE[status]}`}>{COLLAB_STATUS_LABEL[status]}</span>;
}

export function TurnBadge({ badge }: { badge: ListBadge }) {
  return <span className={`${base} ${TURN_TONE[badge.tone]}`}>{badge.label}</span>;
}
