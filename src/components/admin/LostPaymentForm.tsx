"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { recordLostPaymentAction } from "@/app/admin/actions";
import { useRouter } from "next/navigation";
import { isStaleStateMessage } from "@/lib/briefs/errors";
import { PROVIDER_TRADE_NO_RE, validateAdminNote } from "@/lib/admin/notes";
import { parseAmount } from "@/lib/validation/collab";
import { formatTwd } from "@/lib/format";
import { Field } from "@/components/forms/Field";
import { ErrorText } from "@/components/ui/ErrorText";
import { btn, input, textarea } from "@/components/ui/styles";

/**
 * 綠界已扣款、但沒收到通知：管理員在綠界廠商後台確認這張 KL 付款單成功後，
 * 填綠界交易編號與後台顯示的金額（與付款單金額不符時資料庫記錄為付款異常，不會標記已付款）。
 */
export function LostPaymentForm({ collabId, merchantTradeNo, amount }: { collabId: string; merchantTradeNo: string; amount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ptn, setPtn] = useState("");
  const [amt, setAmt] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<{ ptn?: string; amt?: string; memo?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ptnRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) ptnRef.current?.focus(); }, [open]);

  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => { setNotice(null); setOpen(true); }} aria-expanded={false}
          className={`${btn.secondary} h-auto min-h-11 w-full whitespace-normal break-all py-2 sm:w-auto`}>
          {merchantTradeNo}：綠界已扣款但沒收到通知
        </button>
        {notice && <p role="status" className="mt-2 break-words text-sm text-muted">{notice}</p>}
      </div>
    );
  }
  function submit() {
    const next: { ptn?: string; amt?: string; memo?: string } = {};
    if (!PROVIDER_TRADE_NO_RE.test(ptn.trim())) next.ptn = "綠界交易編號是 1–20 位英數字";
    if (parseAmount(amt) === null) next.amt = "請填綠界後台顯示的金額（整數）";
    const err = validateAdminNote(memo.trim(), "說明");
    if (err) next.memo = err;
    setErrs(next);
    if (next.ptn || next.amt || next.memo) {
      setError(null);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await recordLostPaymentAction(collabId, merchantTradeNo, ptn, amt, memo);
        if (res.ok) {
          setOpen(false);
          setNotice(res.notice ?? null);
        } else if (isStaleStateMessage(res.error)) {
          setOpen(false);
          setNotice("狀態已更新，已為你重新整理");
          router.refresh();
        } else {
          setError(res.error);
        }
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }
  return (
    <div role="group" aria-label={`補登 ${merchantTradeNo}`} className="w-full space-y-4 rounded-card border border-line-strong bg-surface p-4">
      <p className="text-sm text-ink">
        先在綠界廠商後台查 <b className="break-all font-mono">{merchantTradeNo}</b>，確認交易成功、金額是 {formatTwd(amount)}。
      </p>
      <Field label="綠界交易編號" error={errs.ptn}>
        {(c) => <input {...c} ref={ptnRef} value={ptn} onChange={(e) => { setPtn(e.target.value); setErrs((x) => ({ ...x, ptn: undefined })); }} disabled={pending} maxLength={20} autoComplete="off" className={`${input} font-mono`} />}
      </Field>
      <Field label="綠界後台顯示的金額" error={errs.amt}>
        {(c) => <input {...c} value={amt} onChange={(e) => { setAmt(e.target.value); setErrs((x) => ({ ...x, amt: undefined })); }} disabled={pending} inputMode="numeric" autoComplete="off" className={input} />}
      </Field>
      <Field label="說明（只有管理員看得到）" error={errs.memo}>
        {(c) => <textarea {...c} rows={2} value={memo} onChange={(e) => { setMemo(e.target.value); setErrs((x) => ({ ...x, memo: undefined })); }} disabled={pending} className={textarea} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={submit} disabled={pending} className={btn.primary}>
          {pending ? "處理中…" : "標記已付款"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null); setErrs({}); }} disabled={pending} className={btn.secondary}>
          取消
        </button>
      </div>
      <ErrorText message={error} />
    </div>
  );
}
