"use client";
import { useEffect, useRef } from "react";
import { btn } from "@/components/ui/styles";
import type { LeaveGuard } from "./useUnsavedChanges";

/** 站內導覽被攔下時的頁面內確認（不用 confirm()）。焦點移到「留在這一頁」，Tab 在兩顆按鈕間循環，Esc 等於留下。 */
export function LeaveDialog({ guard }: { guard: LeaveGuard }) {
  if (!guard.target) return null;
  return <Dialog onStay={guard.stay} onLeave={guard.leave} />;
}

function Dialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  const stayRef = useRef<HTMLButtonElement>(null);
  const leaveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const before = document.activeElement;
    stayRef.current?.focus();
    return () => { if (before instanceof HTMLElement && before.isConnected) before.focus(); };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/70 p-4 sm:items-center"
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.stopPropagation(); onStay(); }
        if (e.key === "Tab") {
          const first = stayRef.current;
          const last = leaveRef.current;
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-desc" className="w-full max-w-sm rounded-card border border-line-strong bg-surface p-5 shadow-lg">
        <h2 id="leave-title" className="text-lg font-bold text-ink">要離開這一頁嗎？</h2>
        <p id="leave-desc" className="mt-2 text-sm text-muted">你有還沒儲存的變更，離開後這些變更不會保留。</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button ref={stayRef} type="button" onClick={onStay} className={`${btn.primary} w-full sm:w-auto`}>留在這一頁</button>
          <button ref={leaveRef} type="button" onClick={onLeave} className={`${btn.secondary} w-full sm:w-auto`}>離開，不儲存</button>
        </div>
      </div>
    </div>
  );
}
