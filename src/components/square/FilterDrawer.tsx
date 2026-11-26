"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { btn } from "@/components/ui/styles";
import { formatNumber } from "@/lib/format";

type Props = { count: number; total: number; children: React.ReactNode };

/** 手機與平板（lg 以下）的篩選抽屜：原生 <dialog>，focus trap 與 Esc 關閉由瀏覽器處理。 */
export function FilterDrawer({ count, total, children }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    // 切到別頁時 <Activity> 會隱藏這頁並執行 cleanup：關掉對話框，onClose 會把 open 設回 false
    // （node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md「Dialog and initialization logic」）
    return () => {
      if (d.open) d.close();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${btn.secondary} lg:hidden`}
      >
        <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
        篩選{count > 0 ? `（${count}）` : ""}
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-labelledby="filter-drawer-title"
        className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-sm bg-surface p-0 text-ink backdrop:bg-bg/70 lg:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 id="filter-drawer-title" className="font-bold">篩選</h2>
            <button
              type="button" onClick={() => setOpen(false)} aria-label="關閉篩選"
              className={btn.icon}
            >
              <X size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
          <div className="border-t border-line p-4">
            <button type="button" onClick={() => setOpen(false)} className={`${btn.primary} w-full`}>
              查看 {formatNumber(total)} 位創作者
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
