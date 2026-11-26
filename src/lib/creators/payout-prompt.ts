import type { CollabStatus } from "@/lib/collabs/view";

/** 品牌已付款、還沒撥款的狀態：這時候沒有收款帳戶，之後平台就無法撥款。 */
const PAID_OPEN: readonly CollabStatus[] = ["awaiting_submission", "in_review", "awaiting_publish", "awaiting_payout"];

export function needsPayoutPrompt(status: CollabStatus, hasPayoutAccount: boolean): boolean {
  return !hasPayoutAccount && PAID_OPEN.includes(status);
}

export function anyNeedsPayoutPrompt(statuses: CollabStatus[], hasPayoutAccount: boolean): boolean {
  return statuses.some((s) => needsPayoutPrompt(s, hasPayoutAccount));
}
