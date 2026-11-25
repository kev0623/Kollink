// 合作案的狀態、輪到誰、進度條、各種顯示文字，以及資料庫 Row → 顯示用物件。
// 「輪到誰」與 supabase/migrations/20261125000300_collab_reads.sql 的 collab_turn 是同一條規則，改一邊要改另一邊。
import { formatDateTimeTw } from "@/lib/briefs/dates";
import { formatTwd } from "@/lib/format";

export type CollabStatus =
  | "invited" | "awaiting_payment" | "awaiting_submission" | "in_review"
  | "awaiting_publish" | "awaiting_payout" | "completed" | "declined" | "cancelled";
export type CollabSide = "brand" | "creator";
export type Turn = CollabSide | "platform" | null;

const STATUSES: readonly string[] = [
  "invited", "awaiting_payment", "awaiting_submission", "in_review",
  "awaiting_publish", "awaiting_payout", "completed", "declined", "cancelled",
];

/** 不認得的值當成「已取消」：畫面不會出現任何動作按鈕。 */
export function toCollabStatus(v: unknown): CollabStatus {
  return typeof v === "string" && STATUSES.includes(v) ? (v as CollabStatus) : "cancelled";
}

export function toCollabSide(v: unknown): CollabSide | "admin" {
  return v === "brand" || v === "creator" ? v : "admin";
}

export const COLLAB_STATUS_LABEL: Record<CollabStatus, string> = {
  invited: "邀約中",
  awaiting_payment: "等待付款",
  awaiting_submission: "待交稿",
  in_review: "審核中",
  awaiting_publish: "待發佈",
  awaiting_payout: "撥款處理中",
  completed: "已完成",
  declined: "已婉拒",
  cancelled: "已取消",
};

/** 輪到誰（與 SQL collab_turn 相同）。 */
export function turnOf(s: CollabStatus): Turn {
  switch (s) {
    case "invited":
    case "awaiting_submission":
    case "awaiting_publish":
      return "creator";
    case "awaiting_payment":
    case "in_review":
      return "brand";
    case "awaiting_payout":
      return "platform";
    default:
      return null;
  }
}

export const COLLAB_STEPS = ["邀約", "確認", "付款託管", "交稿", "審核", "發佈", "撥款"] as const;

// 目前步驟（0 起算）；completed = 7 代表全部完成；declined／cancelled 沒有進度條
const STEP_INDEX: Partial<Record<CollabStatus, number>> = {
  invited: 0,
  awaiting_payment: 1,
  awaiting_submission: 3,
  in_review: 4,
  awaiting_publish: 5,
  awaiting_payout: 6,
  completed: 7,
};

export type StepState = "done" | "current" | "todo";

export function stepStates(s: CollabStatus): StepState[] | null {
  const i = STEP_INDEX[s];
  if (i === undefined) return null;
  return COLLAB_STEPS.map((_, k) => (k < i ? "done" : k === i ? "current" : "todo"));
}

/** 手機版的「第 N / 7 步」；已完成是 7；沒有進度條時是 null。 */
export function stepNumber(s: CollabStatus): number | null {
  const i = STEP_INDEX[s];
  if (i === undefined) return null;
  return Math.min(i + 1, COLLAB_STEPS.length);
}

/** 金額與託管狀態：「NT$4,500 待付款」「NT$4,500 已託管」「NT$4,500 已撥款」「NT$4,500 未成立」。 */
export function escrowLabel(s: CollabStatus, amount: number): string {
  const money = formatTwd(amount);
  switch (s) {
    case "invited":
    case "awaiting_payment":
      return `${money} 待付款`;
    case "completed":
      return `${money} 已撥款`;
    case "declined":
    case "cancelled":
      return `${money} 未成立`;
    default:
      return `${money} 已託管`;
  }
}

/** 案號 = 合作案 id 的前 8 碼（README 的管理員 SQL 用這個找合作案）。 */
export function caseCode(id: string): string {
  return id.slice(0, 8);
}

// ── 列表 ──

export type CollabTab = "active" | "completed" | "cancelled";
export const COLLAB_TABS: { value: CollabTab; label: string }[] = [
  { value: "active", label: "進行中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

/** ?tab=completed|cancelled；其他任何值都是「進行中」。 */
export function parseCollabTab(v: string | string[] | undefined): CollabTab {
  const x = Array.isArray(v) ? v[0] : v;
  return x === "completed" || x === "cancelled" ? x : "active";
}

export type ListBadge = { label: string; tone: "turn" | "wait" | "platform" };

/** 列表每列的標記：輪到你／等對方；撥款中兩邊都是「撥款處理中」；已結束的沒有標記。 */
export function listBadge(s: CollabStatus, side: CollabSide): ListBadge | null {
  const t = turnOf(s);
  if (t === null) return null;
  if (t === "platform") return { label: "撥款處理中", tone: "platform" };
  return t === side ? { label: "輪到你", tone: "turn" } : { label: "等對方", tone: "wait" };
}

export type CollabListItem = {
  id: string;
  title: string;
  amount: number;
  status: CollabStatus;
  updatedAt: string;
  side: CollabSide;
  counterpartName: string;
  counterpartImagePath: string | null;
  counterpartHandle: string | null;
  myTurn: boolean;
};

export type CollabListRow = {
  id: string;
  title: string | null;
  amount_twd: number | null;
  status: string | null;
  updated_at: string | null;
  my_side: string | null;
  counterpart_name: string | null;
  counterpart_image_path: string | null;
  counterpart_handle: string | null;
  my_turn: boolean | null;
};

export function toCollabListItem(r: CollabListRow): CollabListItem {
  return {
    id: r.id,
    title: r.title ?? "",
    amount: r.amount_twd ?? 0,
    status: toCollabStatus(r.status),
    updatedAt: r.updated_at ?? "",
    side: r.my_side === "creator" ? "creator" : "brand",
    counterpartName: r.counterpart_name ?? "",
    counterpartImagePath: r.counterpart_image_path ?? null,
    counterpartHandle: r.counterpart_handle ?? null,
    myTurn: r.my_turn === true,
  };
}

// ── 詳情 ──

export type Collab = {
  id: string;
  title: string;
  deliverables: string;
  amount: number;
  status: CollabStatus;
  reviewDueAt: string | null;
  publishedUrl: string | null;
  createdAt: string;
  updatedAt: string;
  briefId: string | null;
  briefTitle: string | null;
  side: CollabSide | "admin";
  brandId: string;
  brandName: string;
  brandLogoPath: string | null;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatarPath: string | null;
};

export type CollabRow = {
  id: string;
  title: string | null;
  deliverables: string | null;
  amount_twd: number | null;
  status: string | null;
  review_due_at: string | null;
  published_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  brief_id: string | null;
  brief_title: string | null;
  my_side: string | null;
  brand_id: string | null;
  brand_name: string | null;
  brand_logo_path: string | null;
  creator_id: string | null;
  creator_name: string | null;
  creator_handle: string | null;
  creator_avatar_path: string | null;
};

export function toCollab(r: CollabRow): Collab {
  return {
    id: r.id,
    title: r.title ?? "",
    deliverables: r.deliverables ?? "",
    amount: r.amount_twd ?? 0,
    status: toCollabStatus(r.status),
    reviewDueAt: r.review_due_at ?? null,
    publishedUrl: r.published_url ?? null,
    createdAt: r.created_at ?? "",
    updatedAt: r.updated_at ?? "",
    briefId: r.brief_id ?? null,
    briefTitle: r.brief_title ?? null,
    side: toCollabSide(r.my_side),
    brandId: r.brand_id ?? "",
    brandName: r.brand_name ?? "",
    brandLogoPath: r.brand_logo_path ?? null,
    creatorId: r.creator_id ?? "",
    creatorName: r.creator_name ?? "",
    creatorHandle: r.creator_handle ?? "",
    creatorAvatarPath: r.creator_avatar_path ?? null,
  };
}

/** 來源：招募名稱，或「直接邀請」。 */
export function sourceLabel(c: { briefId: string | null; briefTitle: string | null }): string {
  return c.briefId ? `招募：${c.briefTitle ?? ""}` : "直接邀請";
}

export type ActionCardCopy = { mine: boolean; title: string; body: string };

/** 「現在要做什麼」卡片的標題與說明。輪到對方時一定寫「你不用做任何事」。 */
export function actionCardCopy(s: CollabStatus, side: CollabSide): ActionCardCopy {
  const none = "你不用做任何事。";
  const mine = turnOf(s) === side;
  switch (s) {
    case "invited":
      return mine
        ? { mine, title: "輪到你：回覆邀約", body: "接受後由品牌確認並付款託管，款項託管後再開始製作。" }
        : { mine, title: "等對方回覆邀約", body: `創作者接受後就輪到你確認並付款。${none}` };
    case "awaiting_payment":
      return mine
        ? { mine, title: "輪到你：確認並付款", body: "等待付款確認。款項由平台託管，創作者交稿並發佈後才撥款。" }
        : { mine, title: "等對方付款託管", body: `款項託管後就可以開始製作。${none}` };
    case "awaiting_submission":
      return mine
        ? { mine, title: "輪到你：交稿", body: "上傳作品檔案，或附上雲端連結與說明。" }
        : { mine, title: "等對方交稿", body: `創作者交稿後，你有 3 天可以審核。${none}` };
    case "in_review":
      return mine
        ? { mine, title: "輪到你：審核交稿", body: "通過後創作者就會發佈；需要調整時請寫下修改說明。期限內沒有回覆會自動通過。" }
        : { mine, title: "等對方審核", body: `品牌通過後你再發佈貼文。${none}` };
    case "awaiting_publish":
      return mine
        ? { mine, title: "輪到你：發佈並填入貼文連結", body: "依審核通過的內容發佈，再把貼文連結貼在這裡。" }
        : { mine, title: "等對方發佈貼文", body: `創作者填入貼文連結後，平台會撥款。${none}` };
    case "awaiting_payout":
      return { mine: false, title: "撥款處理中", body: `平台確認後會把款項撥給創作者。${none}` };
    case "completed":
      return { mine: false, title: "合作已完成", body: "款項已撥給創作者，謝謝你們的合作。" };
    case "declined":
      return { mine: false, title: "已婉拒", body: "創作者婉拒了這次邀約。" };
    case "cancelled":
      return { mine: false, title: "已取消", body: "品牌已取消這個合作案。" };
  }
}

const HOUR_MS = 3_600_000;

/** 現在時間（毫秒）。會讀時鐘：伺服器元件裡只能在 requireRole 之後呼叫，算好再當 prop 往下傳。 */
export function nowMs(): number {
  return Date.now();
}

/** 審核倒數：「剩 2 天 05 小時後自動通過」「不到 1 小時後自動通過」；到期後、Cron 還沒跑之前「即將自動通過」。 */
export function reviewCountdown(dueIso: string | null, nowMs: number): string | null {
  if (!dueIso) return null;
  const due = Date.parse(dueIso);
  if (Number.isNaN(due)) return null;
  const left = due - nowMs;
  if (left <= 0) return "即將自動通過";
  if (left < HOUR_MS) return "不到 1 小時後自動通過";
  const hours = Math.floor(left / HOUR_MS);
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return `剩 ${d} 天 ${String(h).padStart(2, "0")} 小時後自動通過`;
}

// ── 交稿與系統事件 ──

export type Submission = {
  id: string;
  round: number;
  note: string | null;
  links: string[];
  filePaths: string[];
  createdAt: string;
};

export type SubmissionRow = {
  id: string;
  round: number | null;
  note: string | null;
  links: string[] | null;
  file_paths: string[] | null;
  created_at: string | null;
};

export function toSubmission(r: SubmissionRow): Submission {
  return {
    id: r.id,
    round: r.round ?? 0,
    note: r.note ?? null,
    links: r.links ?? [],
    filePaths: r.file_paths ?? [],
    createdAt: r.created_at ?? "",
  };
}

export type CollabEvent = {
  id: number;
  action: string;
  actorKind: string;
  actorName: string;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
};

export type EventRow = {
  id: number | string;
  action: string | null;
  actor_kind: string | null;
  actor_name: string | null;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string | null;
};

export function toCollabEvent(r: EventRow): CollabEvent {
  return {
    id: Number(r.id),
    action: r.action ?? "",
    actorKind: r.actor_kind ?? "system",
    actorName: r.actor_name ?? "系統",
    toStatus: r.to_status ?? null,
    note: r.note ?? null,
    createdAt: r.created_at ?? "",
  };
}

/** 事件的一句話（不含日期）。 */
export function eventText(e: CollabEvent): string {
  const who = e.actorName;
  switch (e.action) {
    case "create":
      if (e.actorKind !== "brand") return "建立合作案";
      return e.toStatus === "invited" ? `${who} 發出邀約` : `${who} 錄取並建立合作案`;
    case "accept":
      return `${who} 接受邀約`;
    case "decline":
      return `${who} 婉拒邀約`;
    case "cancel":
      return `${who} 取消合作`;
    case "mark_paid":
      return "款項已託管";
    case "submit":
      return `${who} 已交稿`;
    case "approve":
      return `${who} 審核通過`;
    case "auto_approve":
      return "審核期限已到，自動通過";
    case "request_changes":
      return `${who} 要求修改：${e.note ?? ""}`;
    case "publish":
      return `${who} 已發佈貼文`;
    case "payout":
      return "平台已撥款，合作完成";
    case "payment_requires_refund":
      return "收到付款，但合作案已不在待付款，需退款";
    default:
      return `${who}：${e.action}`;
  }
}

/** 台灣時間 MM/DD HH:mm（事件列表用）。 */
export function eventTime(iso: string): string {
  if (Number.isNaN(Date.parse(iso))) return "";
  return formatDateTimeTw(iso).slice(5);
}

/** 每一輪交稿下方要顯示的修改說明：掛到「建立時間 ≤ 事件時間」的最後一輪。 */
export function revisionNotesByRound(subs: Submission[], events: CollabEvent[]): Record<number, string[]> {
  const sorted = [...subs].sort((a, b) => a.round - b.round);
  const out: Record<number, string[]> = {};
  for (const e of events) {
    if (e.action !== "request_changes" || !e.note) continue;
    const t = Date.parse(e.createdAt);
    let round: number | null = null;
    for (const s of sorted) if (Date.parse(s.createdAt) <= t) round = s.round;
    if (round === null) continue;
    (out[round] ??= []).push(e.note);
  }
  return out;
}
