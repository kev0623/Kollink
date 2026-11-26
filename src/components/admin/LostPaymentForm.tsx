"use client";

import { useId, useState, useTransition } from "react";
import { recordLostPaymentAction } from "@/app/admin/actions";
import { validateAdminNote } from "@/lib/admin/notes";
import { formatTwd } from "@/lib/format";
import { inputClassName } from "./styles";

/**
 * 綠界已扣款、但沒收到通知：管理員在綠界廠商後台確認這張 KL 付款單成功後，
 * 填綠界交易編號與後台顯示的金額（與付款單金額不符時資料庫記錄為付款異常，不會標記已付款）。
 */
export function LostPaymentForm({ collabId, merchantTradeNo, amount }: { collabId: string; merchantTradeNo: string; amount: number }) {
  const [open, setOpen] = useState(false);
  const [ptn, setPtn] = useState("");
  const [amt, setAmt] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = useId();

  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => { setNotice(null); setOpen(true); }} aria-expanded={false}
          className="h-10 w-full rounded-btn border border-line bg-surface px-4 text-sm font-semibold text-ink sm:w-auto">
          {merchantTradeNo}：綠界已扣款但沒收到通知
        </button>
        {notice && <p role="status" className="mt-2 break-words text-sm text-muted">{notice}</p>}
      </div>
    );
  }
  function submit() {
    const err = validateAdminNote(memo.trim(), "說明");
    if (err) return setError(err);
    setError(null);
    startTransition(async () => {
      try {
        const res = await recordLostPaymentAction(collabId, merchantTradeNo, ptn, amt, memo);
        if (res.ok) {
          setOpen(false);
          setNotice(res.notice ?? null);
        } else {
          setError(res.error);
        }
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }
  return (
    <div role="group" aria-label={`補登 ${merchantTradeNo}`} className="w-full space-y-3 rounded-card border border-line bg-surface p-4">
      <p className="text-sm text-ink">
        先在綠界廠商後台查 <b className="break-all font-mono">{merchantTradeNo}</b>，確認交易成功、金額是 {formatTwd(amount)}。
      </p>
      <div>
        <label htmlFor={`${id}-ptn`} className="text-sm font-semibold text-ink">綠界交易編號</label>
        <input id={`${id}-ptn`} value={ptn} onChange={(e) => setPtn(e.target.value)} disabled={pending} maxLength={20}
          autoComplete="off" className={`mt-1 font-mono ${inputClassName}`} />
      </div>
      <div>
        <label htmlFor={`${id}-amt`} className="text-sm font-semibold text-ink">綠界後台顯示的金額</label>
        <input id={`${id}-amt`} value={amt} onChange={(e) => setAmt(e.target.value)} disabled={pending} inputMode="numeric"
          autoComplete="off" className={`mt-1 ${inputClassName}`} />
      </div>
      <div>
        <label htmlFor={`${id}-memo`} className="text-sm font-semibold text-ink">說明（只有管理員看得到）</label>
        <textarea id={`${id}-memo`} rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} disabled={pending}
          className="mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ink" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={submit} disabled={pending}
          className="h-10 rounded-btn bg-ink px-4 text-sm font-semibold text-on-ink disabled:opacity-60">
          {pending ? "處理中…" : "標記已付款"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} disabled={pending}
          className="h-10 rounded-btn border border-line px-4 text-sm font-semibold text-ink disabled:opacity-60">
          取消
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
