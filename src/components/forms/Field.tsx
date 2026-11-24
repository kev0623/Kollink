"use client";
import { useId } from "react";

export type ControlProps = { id: string; "aria-describedby"?: string; "aria-invalid"?: true };

/** 標籤用 htmlFor 對應控制項，提示與錯誤用 aria-describedby 連結（錯誤是一般文字，不是獨立的 alert）。 */
export function Field({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: (control: ControlProps) => React.ReactNode;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  const note = error ?? hint;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label>
      <div className="mt-1">
        {children({ id, "aria-describedby": note ? descId : undefined, "aria-invalid": error ? true : undefined })}
      </div>
      {note && <span id={descId} className={`mt-1 block text-xs ${error ? "text-danger" : "text-muted"}`}>{note}</span>}
    </div>
  );
}

export const inputClass = "h-[42px] w-full rounded-input border border-line bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ink";
