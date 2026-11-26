"use client";
import { useId, useState } from "react";
import { AlertCircle } from "lucide-react";
import { chip } from "@/components/ui/styles";
import { CATEGORIES } from "@/lib/options";

export function CategoryPicker({ name, initial, error, onChange }: { name: string; initial: string[]; error?: string; onChange?: (selected: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const errId = useId();
  function toggle(c: string) {
    const next = selected.includes(c) ? selected.filter((x) => x !== c) : selected.length >= 5 ? selected : [...selected, c];
    setSelected(next);
    onChange?.(next);
  }
  return (
    <fieldset aria-describedby={error ? errId : undefined}>
      <legend className="text-sm font-bold text-ink">內容領域（1–5 個）<span className="ml-1.5 text-xs font-normal text-muted">必填</span></legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const on = selected.includes(c);
          return (
            <button
              key={c} type="button" onClick={() => toggle(c)} aria-pressed={on}
              className={chip(on)}
            >
              {c}
            </button>
          );
        })}
      </div>
      {selected.map((c) => <input key={c} type="hidden" name={name} value={c} />)}
      {error && (
        <span id={errId} className="mt-1.5 flex items-start gap-1 text-xs text-danger">
          <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0" /><span>{error}</span>
        </span>
      )}
    </fieldset>
  );
}
