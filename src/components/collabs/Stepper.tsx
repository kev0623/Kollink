import { COLLAB_STATUS_LABEL, COLLAB_STEPS, stepNumber, stepStates, type CollabStatus } from "@/lib/collabs/view";

/**
 * 合作進度：一條紅線穿過 7 個結。已完成的段是實線紅、未完成是虛線；已完成的結實心、目前的結較大並有光暈、之後空心。
 * 所有尺寸都顯示「目前：狀態名稱・第 n / 7 步」。手機不顯示每一步的標籤（螢幕閱讀器仍讀得到）。
 */
export function Stepper({ status }: { status: CollabStatus }) {
  const states = stepStates(status);
  const n = stepNumber(status);
  if (!states || n === null) return null;
  const total = COLLAB_STEPS.length;
  const done = status === "completed";
  return (
    <section aria-label="合作進度" className="rounded-card border border-line bg-surface p-4 md:p-6">
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-bold text-ink">目前：{COLLAB_STATUS_LABEL[status]}</span>
        <span className="tabular-nums text-muted">{done ? "全部完成" : `第 ${n} / ${total} 步`}</span>
      </p>
      <ol className="mt-4 flex items-start">
        {COLLAB_STEPS.map((label, i) => {
          const s = states[i];
          const leftDone = i > 0 && states[i - 1] !== "todo" && s !== "todo";
          const rightDone = i < total - 1 && s === "done";
          const seg = (solid: boolean, edge: boolean) =>
            `flex-1 ${edge ? "" : solid ? "h-0.5 bg-thread" : "border-t border-dashed border-line-strong"}`;
          return (
            <li key={label} aria-current={s === "current" ? "step" : undefined} className="flex min-w-0 flex-1 flex-col items-center text-center">
              <div className="flex h-6 w-full items-center">
                <span aria-hidden="true" className={seg(leftDone, i === 0)} />
                <span
                  aria-hidden="true"
                  className={`shrink-0 rounded-full ${
                    s === "done" ? "h-3 w-3 bg-thread"
                      : s === "current" ? "h-4 w-4 bg-primary ring-[6px] ring-primary-soft motion-safe:animate-[knot_700ms_ease-out_1]"
                        : "h-3 w-3 border-2 border-line-strong bg-surface"
                  }`}
                />
                <span aria-hidden="true" className={seg(rightDone, i === total - 1)} />
              </div>
              <span className={`mt-2 hidden px-0.5 text-xs md:block ${s === "todo" ? "text-muted" : s === "current" ? "font-bold text-ink" : "text-ink"}`}>
                {label}
              </span>
              <span className="sr-only">{label}{s === "done" ? "（已完成）" : s === "current" ? "（目前）" : ""}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
