"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, LogOut, Send, Trash2, Undo2, XCircle, type LucideIcon } from "lucide-react";
import { isStaleStateMessage } from "@/lib/briefs/errors";
import { btn } from "@/components/ui/styles";
import { ErrorText } from "@/components/ui/ErrorText";

type Result = { ok: true } | { ok: false; error?: string } | undefined;

export type ConfirmIcon = "trash" | "x" | "ban" | "leave" | "undo" | "check" | "send";
const ICONS: Record<ConfirmIcon, LucideIcon> = { trash: Trash2, x: XCircle, ban: Ban, leave: LogOut, undo: Undo2, check: CheckCircle2, send: Send };

type Props = {
  label: string;
  /** 確認區塊裡的說明：講清楚後果與能不能復原 */
  message: string;
  confirmLabel: string;
  /** 破壞性（描邊紅＋圖示）；不是破壞性但不可復原的（審核通過、接受邀約）用 primary 樣式 */
  danger?: boolean;
  /** 圖示；danger 沒給時用 x */
  icon?: ConfirmIcon;
  /** 第一顆按鈕在所有寬度都撐滿（預設：手機撐滿、桌面自動寬度） */
  block?: boolean;
  onConfirm: () => Promise<Result>;
};

/** 頁面內的確認區塊（不用 confirm()）：按鈕 → 展開說明與「確定／取消」。展開時焦點移到說明；Esc 收回並還原焦點。 */
export function ConfirmAction({ label, message, confirmLabel, danger, icon, block, onConfirm }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const regionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const Icon = ICONS[icon ?? (danger ? "x" : "check")];

  useEffect(() => {
    if (open) messageRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setError(null);
    // 下一幀按鈕才重新出現
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await onConfirm();
        if (res && !res.ok) {
          if (res.error && isStaleStateMessage(res.error)) {
            setOpen(false);
            setNotice("狀態已更新，已為你重新整理");
            router.refresh();
          } else {
            setError(res.error ?? "發生錯誤，請稍後再試");
          }
        } else {
          setOpen(false);
        }
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }

  const width = block ? "w-full" : "w-full sm:w-auto";
  if (!open) {
    return (
      <div className={width}>
        <button
          ref={triggerRef} type="button" aria-expanded={false} aria-controls={regionId}
          onClick={() => { setNotice(null); setOpen(true); }}
          className={`${danger ? btn.danger : btn.primary} ${width}`}
        >
          {danger && <Icon size={16} strokeWidth={1.5} aria-hidden="true" />}
          {label}
        </button>
        {notice && <p role="status" className="mt-2 text-sm text-muted">{notice}</p>}
      </div>
    );
  }
  return (
    <div
      id={regionId} role="group" aria-label={label}
      onKeyDown={(e) => { if (e.key === "Escape" && !pending) close(); }}
      className={`w-full rounded-card border p-4 ${danger ? "border-danger bg-danger-soft" : "border-line-strong bg-surface"}`}
    >
      <p ref={messageRef} tabIndex={-1} className="text-sm text-ink outline-none">{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={confirm} disabled={pending} className={danger ? btn.dangerConfirm : btn.primary}>
          <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
          {pending ? "處理中…" : confirmLabel}
        </button>
        <button type="button" onClick={close} disabled={pending} className={btn.secondary}>取消</button>
      </div>
      <div className="mt-2"><ErrorText message={error} /></div>
    </div>
  );
}
