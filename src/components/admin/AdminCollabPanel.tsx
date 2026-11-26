"use client";

import { useState } from "react";
import { adminCancelAction, markPayoutAction, recordOfflinePaymentAction } from "@/app/admin/actions";
import type { AdminCollabActions } from "@/lib/admin/view";
import { formatTwd } from "@/lib/format";
import { formatAccountNumber } from "@/lib/payout-account";
import { LostPaymentForm } from "./LostPaymentForm";
import { NoteAction } from "./NoteAction";

export type PayoutPanel = {
  blocker: string | null;
  account: { bankCode: string; branchCode: string | null; accountNumber: string; accountName: string } | null;
  changedRecently: boolean;
};

type Props = {
  collabId: string;
  amount: number;
  actions: AdminCollabActions;
  lost: { merchantTradeNo: string; amount: number }[];
  payout: PayoutPanel | null;
  paid: boolean;
};

/** 合作案詳情的管理員動作（「平台」卡片）：人工標記已付款、補登通知遺失的付款、撥款、平台取消。 */
export function AdminCollabPanel({ collabId, amount, actions, lost, payout, paid }: Props) {
  // 取消成功後 actions.cancel 變 false、NoteAction 會被卸載，所以結果提示放在面板這一層
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const none = !actions.offlinePayment && !actions.payout && !actions.cancel && !actions.lostPayment;
  return (
    <section aria-labelledby="admin-panel-title" className="space-y-4 rounded-card border-2 border-ink bg-surface p-4 md:p-6">
      <h2 id="admin-panel-title" className="text-lg font-bold text-ink">平台處理</h2>
      {cancelNotice && <p role="status" className="break-words text-sm font-semibold text-ink">{cancelNotice}</p>}
      {none && <p className="text-sm text-muted">這個狀態沒有需要平台處理的事。</p>}

      {actions.payout && payout && (
        <div className="space-y-3">
          <h3 className="font-semibold text-ink">撥款 {formatTwd(amount)}</h3>
          {payout.account && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-btn bg-primary-soft p-3 text-sm">
              <dt className="text-muted">銀行代碼</dt><dd>{payout.account.bankCode}{payout.account.branchCode ? `（分行 ${payout.account.branchCode}）` : ""}</dd>
              <dt className="text-muted">帳號</dt><dd className="min-w-0 break-all font-mono text-base font-semibold">{formatAccountNumber(payout.account.accountNumber)}</dd>
              <dt className="text-muted">戶名</dt><dd className="min-w-0 break-words">{payout.account.accountName}</dd>
            </dl>
          )}
          {payout.changedRecently && (
            <p className="text-sm font-semibold text-danger">創作者 7 天內改過收款帳戶，轉帳前請先跟創作者確認。</p>
          )}
          {payout.blocker || !payout.account ? (
            <p className="text-sm font-semibold text-danger">{payout.blocker ?? "創作者還沒填收款帳戶"}</p>
          ) : (
            <NoteAction
              label="已轉帳，標記撥款" fieldLabel="轉帳說明（日期、轉出帳戶、交易序號；只有管理員看得到）" noteName="轉帳說明"
              confirmLabel="確定已撥款"
              message="先在銀行轉帳給上面的帳戶，再標記。標記後合作案結案，不能復原。"
              onSubmit={(memo) => markPayoutAction(collabId, memo, payout.account ? payout.account.accountNumber.slice(-4) : "")}
            />
          )}
        </div>
      )}

      {actions.offlinePayment && (
        <div className="space-y-2">
          <h3 className="font-semibold text-ink">人工標記已付款</h3>
          <p className="text-sm text-muted">只用在超過線上付款上限、品牌線下匯款，已確認款項入帳時。</p>
          <NoteAction
            label="標記已付款（線下付款）" fieldLabel="說明（匯款日期、帳號末五碼；只有管理員看得到）" noteName="說明"
            confirmLabel="確定已收到款項"
            message={`確認已收到 ${formatTwd(amount)} 後再標記。標記後合作案進入交稿。`}
            onSubmit={(memo) => recordOfflinePaymentAction(collabId, memo)}
          />
        </div>
      )}

      {actions.lostPayment && lost.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-ink">綠界已扣款、但沒收到通知</h3>
          <p className="text-sm text-muted">綠界一天最多重送 4 次通知；全部失敗時，在綠界後台確認後在這裡補登。</p>
          {lost.map((p) => <LostPaymentForm key={p.merchantTradeNo} collabId={collabId} merchantTradeNo={p.merchantTradeNo} amount={p.amount} />)}
        </div>
      )}

      {actions.cancel && (
        <div className="space-y-2">
          <h3 className="font-semibold text-ink">平台取消（爭議處理）</h3>
          <NoteAction
            label="平台取消" fieldLabel="取消原因（品牌與創作者都看得到）" noteName="原因" confirmLabel="確定取消合作案" danger
            message={paid
              ? "取消後合作案結束，已付款的款項會標記為需退款（款項 → 需退款），退款要另外在綠界後台處理。"
              : "取消後合作案結束，雙方不能再操作。"}
            onSubmit={async (reason) => {
              const res = await adminCancelAction(collabId, reason);
              if (res.ok && res.notice) setCancelNotice(res.notice);
              return res;
            }}
          />
        </div>
      )}
    </section>
  );
}
