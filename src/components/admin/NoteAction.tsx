"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { isStaleStateMessage } from "@/lib/briefs/errors";
import { PAYOUT_ACCOUNT_CHANGED_MESSAGE } from "@/lib/admin/errors";
import { ADMIN_NOTE_MAX, amountMatches, validateAdminNote } from "@/lib/admin/notes";
import { textLength } from "@/lib/validation/brief";
import { Field } from "@/components/forms/Field";
import { Notice } from "@/components/ui/Notice";
import { ErrorText } from "@/components/ui/ErrorText";
import { btn, input, textarea } from "@/components/ui/styles";
import { formatTwd } from "@/lib/format";

type Result = { ok: true; notice?: string } | { ok: false; error: string };

type Props = {
  label: string;
  /** 展開後的說明（例如「已付款的款項會標記為需退款」） */
  message?: string;
  /** 輸入框的標籤，例如「退回原因（創作者看得到）」 */
  fieldLabel: string;
  /** validateAdminNote 的欄位名稱（錯誤訊息用） */
  noteName: string;
  confirmLabel: string;
  danger?: boolean;
  /** 這是面板唯一的主要動作：觸發按鈕用主要樣式 */
  primary?: boolean;
  /** 人工標記已付款：要求再輸入一次金額核對（只在畫面上擋） */
  confirmAmount?: number;
  onSubmit: (note: string) => Promise<Result>;
};

/** 管理員動作：頁面內展開的確認區塊，原因／說明必填、最多 500 字（不用瀏覽器的 confirm()）。 */
export function NoteAction({ label, message, fieldLabel, noteName, confirmLabel, danger, primary, confirmAmount, onSubmit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = useId();
  const regionId = `${id}-region`;
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const count = textLength(note);

  // 展開時焦點移到第一個欄位（核對金額，沒有的話是說明）
  useEffect(() => {
    if (open) (amountRef.current ?? noteRef.current)?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setError(null);
    setAmountError(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function submit() {
    if (confirmAmount !== undefined && !amountMatches(amount, confirmAmount)) {
      setAmountError("金額不一致，請確認入帳金額");
      amountRef.current?.focus();
      return;
    }
    const err = validateAdminNote(note.trim(), noteName);
    if (err) return setError(err);
    setError(null);
    startTransition(async () => {
      try {
        const res = await onSubmit(note);
        if (res.ok) {
          setOpen(false);
          setNote("");
          setAmount("");
          setNotice(res.notice ?? null);
        } else if (isStaleStateMessage(res.error)) {
          setOpen(false);
          // 撥款前帳戶被改：要讓管理員重新確認轉帳的帳號，不是一般的「狀態已更新」
          setNotice(res.error === PAYOUT_ACCOUNT_CHANGED_MESSAGE ? res.error : "狀態已更新，已為你重新整理");
          router.refresh();
        } else {
          setError(res.error);
        }
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }

  if (!open) {
    return (
      <div className="w-full sm:w-auto">
        <button
          ref={triggerRef} type="button" onClick={() => { setNotice(null); setOpen(true); }}
          aria-expanded={false}
          className={`${danger ? btn.danger : primary ? btn.primary : btn.secondary} w-full sm:w-auto`}
        >
          {danger && <XCircle size={16} strokeWidth={1.5} aria-hidden="true" />}
          {label}
        </button>
        {notice && (
          <div className="mt-2">
            {notice === PAYOUT_ACCOUNT_CHANGED_MESSAGE
              ? <Notice tone="warning">{notice}</Notice>
              : <p role="status" className="break-words text-sm text-muted">{notice}</p>}
          </div>
        )}
      </div>
    );
  }
  return (
    <div
      id={regionId} role="group" aria-label={label}
      onKeyDown={(e) => { if (e.key === "Escape" && !pending) close(); }}
      className={`w-full space-y-3 rounded-card border p-4 ${danger ? "border-danger bg-danger-soft" : "border-line-strong bg-surface"}`}
    >
      {message && <p className="text-sm text-ink">{message}</p>}
      {confirmAmount !== undefined && (
        <Field label={`核對金額（應為 ${formatTwd(confirmAmount)}）`} error={amountError ?? undefined}>
          {(c) => (
            <input
              {...c} ref={amountRef} inputMode="numeric" autoComplete="off" value={amount} disabled={pending}
              onChange={(e) => { setAmount(e.target.value); setAmountError(null); }} className={input}
            />
          )}
        </Field>
      )}
      <div>
        <label htmlFor={id} className="text-sm font-bold text-ink">{fieldLabel}</label>
        <textarea
          id={id} ref={noteRef} rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending}
          className={`${textarea} mt-1.5`}
        />
        <p aria-live="polite" className={`mt-1 text-right text-xs tabular-nums ${count > ADMIN_NOTE_MAX ? "font-semibold text-danger" : "text-muted"}`}>
          {count}/{ADMIN_NOTE_MAX}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={submit} disabled={pending} className={danger ? btn.dangerConfirm : btn.primary}>
          {danger && <XCircle size={16} strokeWidth={1.5} aria-hidden="true" />}
          {pending ? "處理中…" : confirmLabel}
        </button>
        <button type="button" onClick={close} disabled={pending} className={btn.secondary}>取消</button>
      </div>
      <ErrorText message={error} />
    </div>
  );
}
