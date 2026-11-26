"use client";
import { useId } from "react";
import { AlertCircle } from "lucide-react";

export type ControlProps = { id: string; "aria-describedby"?: string; "aria-invalid"?: true };

/** 標籤用 htmlFor 對應控制項，提示與錯誤用 aria-describedby 連結（錯誤是一般文字，不是獨立的 alert）。規格 §9.5。 */
export function Field({ label, error, hint, mark, children }: {
  label: string; error?: string; hint?: string;
  /** 必填／選填標記：文字，不只靠符號 */
  mark?: "required" | "optional"; children: (control: ControlProps) => React.ReactNode;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  const note = error ?? hint;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label}
        {mark && <span className="ml-1.5 text-xs font-normal text-muted">{mark === "required" ? "必填" : "選填"}</span>}
      </label>
      <div className="mt-1.5">
        {children({ id, "aria-describedby": note ? descId : undefined, "aria-invalid": error ? true : undefined })}
      </div>
      {note && (
        <span id={descId} className={`mt-1.5 flex items-start gap-1 text-xs ${error ? "text-danger" : "text-muted"}`}>
          {error && <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0" />}
          <span>{note}</span>
        </span>
      )}
    </div>
  );
}
