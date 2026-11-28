import { Check } from "lucide-react";

const LABELS = ["基本資料", "報價", "送出審核"] as const;

/** 創作者註冊的三個階段。current：目前在第幾個（0 起算）；傳 3 代表全部完成。 */
export function OnboardingProgress({ current }: { current: number }) {
  return (
    <ol className="mb-5 flex items-center gap-2 text-sm">
      {LABELS.map((label, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={label} aria-current={now ? "step" : undefined} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                done || now ? "bg-ink text-on-ink" : "bg-subtle text-muted"
              }`}
            >
              {done ? <Check size={14} strokeWidth={2.5} /> : i + 1}
            </span>
            <span className={`truncate ${done || now ? "font-bold text-ink" : "text-muted"}`}>
              {label}<span className="sr-only">{done ? "（已完成）" : now ? "（目前）" : ""}</span>
            </span>
            {i < LABELS.length - 1 && <span aria-hidden="true" className="h-px min-w-3 flex-1 bg-line-strong" />}
          </li>
        );
      })}
    </ol>
  );
}
