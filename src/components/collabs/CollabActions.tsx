"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { brandCollabAction, startPaymentAction } from "@/app/brand/collabs/actions";
import { creatorCollabAction } from "@/app/creator/collabs/actions";
import { ConfirmAction } from "@/components/briefs/ConfirmAction";
import type { CollabSide, CollabStatus } from "@/lib/collabs/view";
import { formatTwd } from "@/lib/format";
import type { CheckoutForm, PaymentMethod } from "@/lib/payments/checkout";
import type { PaymentAvailability } from "@/lib/payments/config";
import { ATM_EXPIRE_DAYS } from "@/lib/payments/limits";
import { atmDeadlineLabel, formatVAccount, type AtmPending, type PaymentSummary } from "@/lib/payments/view";
import { PublishForm } from "./PublishForm";
import { RevisionForm } from "./RevisionForm";
import { SubmitPanel } from "./SubmitPanel";
import { useCollabAction } from "./useCollabAction";

type Props = {
  collabId: string; status: CollabStatus; side: CollabSide; uid: string;
  /** 來自招募報名（invited 代表錄取金額低於報價、等待創作者確認），按鈕文字不寫「邀約」 */
  fromApplication: boolean;
  devPaymentEnabled: boolean; payment: PaymentAvailability; summary: PaymentSummary;
};

const primary = "h-11 w-full rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 sm:w-auto";

/** 「現在要做什麼」卡片裡的按鈕（依狀態與視角）。 */
export function CollabActions({ collabId, status, side, uid, fromApplication, devPaymentEnabled, payment, summary }: Props) {
  if (side === "creator" && status === "invited") return <InviteReply collabId={collabId} fromApplication={fromApplication} />;
  if (side === "brand" && (status === "invited" || status === "awaiting_payment")) {
    return (
      <BrandPayment
        collabId={collabId} status={status} fromApplication={fromApplication}
        devPaymentEnabled={devPaymentEnabled} payment={payment} summary={summary}
      />
    );
  }
  if (side === "creator" && status === "awaiting_payment") return <CreatorLeave collabId={collabId} devPaymentEnabled={devPaymentEnabled} />;
  if (side === "creator" && status === "awaiting_submission") return <SubmitPanel collabId={collabId} uid={uid} />;
  if (side === "brand" && status === "in_review") return <Review collabId={collabId} />;
  if (side === "creator" && status === "awaiting_publish") return <PublishForm collabId={collabId} />;
  return null;
}

function Feedback({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted">{notice}</p>}
    </>
  );
}

function InviteReply({ collabId, fromApplication }: { collabId: string; fromApplication: boolean }) {
  const { pending, error, notice, run } = useCollabAction();
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={pending} onClick={() => run(() => creatorCollabAction(collabId, "accept"))} className={primary}>
          {pending ? "處理中…" : fromApplication ? "接受條件" : "接受邀約"}
        </button>
        <ConfirmAction
          label="婉拒" danger confirmLabel="確定婉拒"
          message={fromApplication
            ? "婉拒後這個合作案就結束了，品牌可以重新邀請你。確定要婉拒嗎？"
            : "婉拒後品牌需要重新發出邀約，確定要婉拒嗎？"}
          onConfirm={() => creatorCollabAction(collabId, "decline")}
        />
      </div>
      <Feedback error={error} notice={notice} />
    </div>
  );
}

/** 品牌還沒付款前，創作者可以退出合作（transition_collaboration 的 cancel）；付款之後資料庫不允許。 */
function CreatorLeave({ collabId, devPaymentEnabled }: { collabId: string; devPaymentEnabled: boolean }) {
  return (
    <div className="space-y-3">
      <ConfirmAction
        label="退出合作" danger confirmLabel="確定退出"
        message="退出後這個合作案就結束了，不能復原；品牌可以重新邀請你或改找其他創作者。確定要退出嗎？"
        onConfirm={() => creatorCollabAction(collabId, "cancel")}
      />
      {devPaymentEnabled && <DevMarkPaid collabId={collabId} />}
    </div>
  );
}

type BrandPaymentProps = {
  collabId: string; status: "invited" | "awaiting_payment"; fromApplication: boolean; devPaymentEnabled: boolean;
  payment: PaymentAvailability; summary: PaymentSummary;
};

function BrandPayment({ collabId, status, fromApplication, devPaymentEnabled, payment, summary }: BrandPaymentProps) {
  const [changeMethod, setChangeMethod] = useState(false);
  const atm = status === "awaiting_payment" ? summary.atm : null;
  const cancelMessage = atm
    ? "取消後這個合作案就結束了，不能復原。已取得的 ATM 帳號請不要再轉帳；如果已經轉帳，平台會退款。確定要取消嗎？"
    : "取消後這個合作案就結束了，不能復原。確定要取消嗎？";
  return (
    <div className="space-y-3">
      {status === "awaiting_payment" && payment.env === "stage" && (
        <p className="rounded-btn border border-danger p-3 text-sm text-danger">
          測試模式：目前使用綠界測試環境，不會真的扣款，付款完成也不會撥款給創作者。
        </p>
      )}
      {atm && <AtmCard atm={atm} />}
      {status === "awaiting_payment" && (!atm || changeMethod) && (
        <PayForm collabId={collabId} payment={payment} onCancel={atm ? () => setChangeMethod(false) : undefined} />
      )}
      {status === "awaiting_payment" && summary.recentCreditPending && (
        <p role="status" className="text-sm text-muted">剛完成付款？綠界確認款項可能需要幾分鐘，請稍後重新整理頁面。</p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        {atm && !changeMethod && (
          <button type="button" onClick={() => setChangeMethod(true)} className="h-11 rounded-btn border border-line px-4 text-sm font-semibold text-ink">
            改用其他方式付款
          </button>
        )}
        <ConfirmAction
          label={status !== "invited" ? "取消合作" : fromApplication ? "撤回錄取" : "撤回邀約"} danger confirmLabel="確定取消"
          message={cancelMessage}
          onConfirm={() => brandCollabAction(collabId, "cancel")}
        />
      </div>
      {status === "awaiting_payment" && devPaymentEnabled && <DevMarkPaid collabId={collabId} />}
    </div>
  );
}

/** ATM 待繳：銀行代碼、虛擬帳號、金額、期限（綠界取號通知寫進資料庫的值）。 */
function AtmCard({ atm }: { atm: AtmPending }) {
  return (
    <div className="rounded-btn border border-line bg-primary-soft p-4 text-sm text-ink">
      <p className="font-semibold">請在 {atmDeadlineLabel(atm.expireDate)}轉帳</p>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
        <dt className="text-muted">銀行代碼</dt>
        <dd className="font-mono">{atm.bankCode}</dd>
        <dt className="text-muted">虛擬帳號</dt>
        <dd className="break-all font-mono text-base font-semibold">{formatVAccount(atm.vAccount)}</dd>
        <dt className="text-muted">金額</dt>
        <dd className="font-semibold">{formatTwd(atm.amount)}</dd>
      </dl>
      <p className="mt-2 text-muted">金額必須完全相同。轉帳後通常幾分鐘內就會確認，確認後自動進入交稿。</p>
    </div>
  );
}

const METHODS: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: "credit", label: "信用卡", hint: "在綠界付款頁刷卡，完成後回到這裡。" },
  { value: "atm", label: "ATM 轉帳", hint: `取得虛擬帳號，${ATM_EXPIRE_DAYS} 天內轉帳。` },
];

/**
 * 選付款方式 →「前往付款」：Server Action 建單並回傳綠界表單（含 CheckMacValue），
 * 這裡渲染成隱藏表單後立刻 submit（整頁 POST 到綠界）。
 */
function PayForm({ collabId, payment, onCancel }: { collabId: string; payment: PaymentAvailability; onCancel?: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>("credit");
  const [form, setForm] = useState<CheckoutForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const name = useId();

  useEffect(() => {
    if (form) formRef.current?.submit();
  }, [form]);

  // 從綠界按瀏覽器「上一頁」回來時，頁面可能來自 bfcache：把「前往中」狀態清掉，按鈕才能再用
  useEffect(() => {
    function onShow(e: PageTransitionEvent) {
      if (e.persisted) setForm(null);
    }
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  if (!payment.enabled) {
    return (
      <div className="space-y-2">
        <button type="button" disabled className={primary}>確認並付款</button>
        <p role="status" className="text-sm text-muted">
          線上付款尚未開放。目前由平台人工確認款項，確認後會自動進入交稿階段。
        </p>
      </div>
    );
  }

  function start() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await startPaymentAction(collabId, method);
        if (res.ok) setForm(res.form);
        else setError(res.error);
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }

  const busy = pending || form !== null;
  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">付款方式</legend>
        {METHODS.map((m) => (
          <label key={m.value} className="flex items-start gap-2 text-sm text-ink">
            <input
              type="radio" name={name} value={m.value} checked={method === m.value} disabled={busy}
              onChange={() => setMethod(m.value)} className="mt-1 accent-ink"
            />
            <span>
              <span className="font-semibold">{m.label}</span>
              <span className="block text-muted">{m.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <button type="button" disabled={busy} onClick={start} className={primary}>
        {busy ? "前往綠界付款頁…" : "確認並付款"}
      </button>
      {onCancel && (
        <button type="button" disabled={busy} onClick={onCancel} className="h-11 rounded-btn border border-line px-4 text-sm font-semibold text-ink">
          取消
        </button>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {form && (
        <form ref={formRef} method="post" action={form.action} acceptCharset="UTF-8" className="hidden">
          {Object.entries(form.fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        </form>
      )}
    </div>
  );
}

/** 本機測試用：一般的 POST 表單，不需要 JS。只有伺服器判斷 isDevLoginEnabled() 為真時才會渲染。 */
function DevMarkPaid({ collabId }: { collabId: string }) {
  const [submitted, setSubmitted] = useState(false);
  return (
    <form method="post" action="/api/dev/mark-paid" onSubmit={() => setSubmitted(true)}>
      <input type="hidden" name="collabId" value={collabId} />
      <button type="submit" disabled={submitted} className="h-10 rounded-btn border border-dashed border-line px-4 text-sm font-semibold text-muted disabled:opacity-50">
        {submitted ? "送出中…" : "標記已付款（本機）"}
      </button>
    </form>
  );
}

function Review({ collabId }: { collabId: string }) {
  const { pending, error, notice, run } = useCollabAction();
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <button type="button" disabled={pending} onClick={() => run(() => brandCollabAction(collabId, "approve"))} className={primary}>
          {pending ? "處理中…" : "審核通過"}
        </button>
        <RevisionForm collabId={collabId} />
      </div>
      <Feedback error={error} notice={notice} />
    </div>
  );
}
