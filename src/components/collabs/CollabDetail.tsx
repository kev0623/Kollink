import type { CollabDetailData } from "@/lib/collabs/load";
import type { CollabSide } from "@/lib/collabs/view";
import { messagesHref } from "@/lib/messages/view";
import type { PaymentAvailability } from "@/lib/payments/config";
import { summarizePayments, summaryForSide } from "@/lib/payments/view";
import { ActionCard } from "./ActionCard";
import { CollabHeader } from "./CollabHeader";
import { EventList } from "./EventList";
import { Stepper } from "./Stepper";
import { SubmissionList } from "./SubmissionList";

type Props = {
  data: CollabDetailData; side: CollabSide; uid: string; nowMs: number; devPaymentEnabled: boolean; payment: PaymentAvailability;
};

/** 合作案詳情：品牌與創作者共用，只差在視角。 */
export function CollabDetail({ data, side, uid, nowMs, devPaymentEnabled, payment }: Props) {
  const { collab: c, submissions, events } = data;
  const fullSummary = summarizePayments(data.payments, nowMs);
  const summary = summaryForSide(fullSummary, side);
  const latest = submissions.length > 0 ? submissions[submissions.length - 1] : null;
  return (
    <div className="space-y-6">
      <CollabHeader c={c} testPayment={fullSummary.testPaid} />
      <Stepper status={c.status} />
      <ActionCard
        c={c} side={side} uid={uid} latest={latest} nowMs={nowMs}
        devPaymentEnabled={devPaymentEnabled} payment={payment} summary={summary}
        adminCancelled={events.some((e) => e.action === "admin_cancel")}
      />
      <SubmissionList submissions={submissions} />
      <EventList events={events} chatHref={c.conversationId ? messagesHref(side, c.conversationId) : null} fromApplication={c.briefId !== null} />
    </div>
  );
}
