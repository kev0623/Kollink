import { COLLAB_STATUS_LABEL, type CollabStatus, type ListBadge } from "@/lib/collabs/view";

// 規格 §9.6：左側 6px 圓點；進行中＝primary 點＋subtle 底、成功＝success、需要注意＝danger、中性＝muted 點
const base = "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold";

type Tone = { box: string; dot: string };
const ACTIVE: Tone = { box: "bg-subtle text-ink", dot: "bg-primary" };
const NEUTRAL: Tone = { box: "bg-subtle text-muted", dot: "bg-muted" };
const SUCCESS: Tone = { box: "bg-success-soft text-success", dot: "bg-success" };

const STATUS_TONE: Record<CollabStatus, Tone> = {
  invited: ACTIVE,
  awaiting_payment: ACTIVE,
  awaiting_submission: ACTIVE,
  in_review: ACTIVE,
  awaiting_publish: ACTIVE,
  awaiting_payout: ACTIVE,
  completed: SUCCESS,
  declined: NEUTRAL,
  cancelled: NEUTRAL,
};

const TURN_TONE: Record<ListBadge["tone"], Tone> = {
  turn: { box: "bg-danger-soft text-danger", dot: "bg-danger" },
  wait: NEUTRAL,
  platform: ACTIVE,
};

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`${base} ${tone.box}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {children}
    </span>
  );
}

export function CollabStatusBadge({ status }: { status: CollabStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{COLLAB_STATUS_LABEL[status]}</Badge>;
}

/** 輪到誰：輪到你＝需要注意（danger 點＋文字「輪到你」）。 */
export function TurnBadge({ badge }: { badge: ListBadge }) {
  return <Badge tone={TURN_TONE[badge.tone]}>{badge.label}</Badge>;
}
