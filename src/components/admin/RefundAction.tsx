"use client";

import { resolveAnomalyAction, resolveRefundAction } from "@/app/admin/actions";
import { NoteAction } from "./NoteAction";

/** 需退款的款項：在綠界後台退款（或 ATM 另外轉帳）後，記錄退款說明。 */
export function RefundAction({ paymentId }: { paymentId: string }) {
  return (
    <NoteAction
      label="已退款" fieldLabel="退款說明（方式與日期）" noteName="退款說明" confirmLabel="記錄已退款"
      message="先在綠界廠商後台用付款單號辦理退款（信用卡刷退；ATM 要向品牌取得帳號另外轉帳），完成後再記錄。"
      onSubmit={(memo) => resolveRefundAction(paymentId, memo)}
    />
  );
}

/** 付款異常：在綠界後台確認並處理（退款或人工標記已付款）後，記錄處理說明。 */
export function AnomalyAction({ anomalyId }: { anomalyId: number }) {
  return (
    <NoteAction
      label="已處理" fieldLabel="處理說明" noteName="處理說明" confirmLabel="記錄已處理"
      onSubmit={(memo) => resolveAnomalyAction(anomalyId, memo)}
    />
  );
}
