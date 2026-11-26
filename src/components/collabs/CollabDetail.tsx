import type { CollabDetailData } from "@/lib/collabs/load";
import type { CollabSide } from "@/lib/collabs/view";
import { messagesHref } from "@/lib/messages/view";
import type { PaymentAvailability } from "@/lib/payments/config";
import { summarizePayments, summaryForSide } from "@/lib/payments/view";
import { ActionCard } from "./ActionCard";
import { PaymentStatusPoller } from "./PaymentStatusPoller";
import { PayoutPrompt } from "./PayoutPrompt";
import { CollabHeader } from "./CollabHeader";
import { EventList } from "./EventList";
import { Stepper } from "./Stepper";
import { SubmissionList } from "./SubmissionList";

type Props = {
  data: CollabDetailData; side: CollabSide; uid: string; nowMs: number; devPaymentEnabled: boolean; payment: PaymentAvailability;
  /** 創作者還沒有收款帳戶、而這個合作案已付款未撥款：行動卡上方提醒（QA m19） */
  payoutPrompt?: boolean;
};

/** 合作案詳情：品牌與創作者共用，只差在視角。 */
export function CollabDetail({ data, side, uid, nowMs, devPaymentEnabled, payment, payoutPrompt }: Props) {
  const { collab: c, submissions, events } = data;
  const fullSummary = summarizePayments(data.payments, nowMs);
  const summary = summaryForSide(fullSummary, side);
  const latest = submissions.length > 0 ? submissions[submissions.length - 1] : null;
  return (
    <div className="space-y-6">
      <CollabHeader c={c} testPayment={fullSummary.testPaid} />
      <Stepper status={c.status} />
      {payoutPrompt && <PayoutPrompt />}
      {side === "brand" && c.status === "awaiting_payment" && summary.recentCreditPending && <PaymentStatusPoller />}
      <ActionCard
        c={c} side={side} uid={uid} latest={latest} nowMs={nowMs}
        devPaymentEnabled={devPaymentEnabled} payment={payment} summary={summary}
        adminCancelled={events.some((e) => e.action === "admin_cancel")} payoutPrompt={payoutPrompt}
      />
      <SubmissionList submissions={submissions} />
      <EventList events={events} chatHref={c.conversationId ? messagesHref(side, c.conversationId) : null} fromApplication={c.briefId !== null} />
    </div>
  );
}
