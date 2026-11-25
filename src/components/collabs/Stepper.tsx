import { Check } from "lucide-react";
import { COLLAB_STATUS_LABEL, COLLAB_STEPS, stepNumber, stepStates, type CollabStatus } from "@/lib/collabs/view";

/**
 * 7 步進度條。桌面：每一步一個圓點（已完成淡主色、目前主色加光暈、之後灰色）；
 * 手機：「目前狀態名稱 + 第 N / 7 步」加一條進度線。婉拒與取消不顯示。
 */
export function Stepper({ status }: { status: CollabStatus }) {
  const states = stepStates(status);
  const n = stepNumber(status);
  if (!states || n === null) return null;
  const done = status === "completed";
  return (
    <section aria-label="合作進度" className="rounded-card border border-line bg-surface p-4 md:p-5">
      <div className="md:hidden">
        <p className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold text-ink">{COLLAB_STATUS_LABEL[status]}</span>
          <span className="text-muted">{done ? "全部完成" : `第 ${n} / ${COLLAB_STEPS.length} 步`}</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary-soft" aria-hidden="true">
          <div className="h-full rounded-full bg-primary" style={{ width: `${((done ? COLLAB_STEPS.length : n) / COLLAB_STEPS.length) * 100}%` }} />
        </div>
      </div>
      <ol className="hidden md:flex md:items-start">
        {COLLAB_STEPS.map((label, i) => {
          const s = states[i];
          const dot = s === "done"
            ? "border-line bg-primary-soft text-ink"
            : s === "current"
              ? "border-primary bg-primary text-on-ink ring-4 ring-primary-soft"
              : "border-line bg-surface text-muted";
          return (
            <li key={label} aria-current={s === "current" ? "step" : undefined} className="flex flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span aria-hidden="true" className={`h-px flex-1 ${i === 0 ? "bg-transparent" : "bg-line"}`} />
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${dot}`}>
                  {s === "done" ? <Check size={14} strokeWidth={1.5} aria-hidden="true" /> : i + 1}
                </span>
                <span aria-hidden="true" className={`h-px flex-1 ${i === COLLAB_STEPS.length - 1 ? "bg-transparent" : "bg-line"}`} />
              </div>
              <span className={`mt-2 text-xs ${s === "todo" ? "text-muted" : "font-semibold text-ink"}`}>
                {label}
                <span className="sr-only">{s === "done" ? "（已完成）" : s === "current" ? "（目前）" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
