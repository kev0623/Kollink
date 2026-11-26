"use client";
import { useState } from "react";
import { chip } from "@/components/ui/styles";
import { CATEGORIES } from "@/lib/options";

export function CategoryPicker({ name, initial, error, onChange }: { name: string; initial: string[]; error?: string; onChange?: (selected: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(initial);
  function toggle(c: string) {
    const next = selected.includes(c) ? selected.filter((x) => x !== c) : selected.length >= 5 ? selected : [...selected, c];
    setSelected(next);
    onChange?.(next);
  }
  return (
    <fieldset>
      <legend className="text-sm font-bold text-ink">內容領域（1–5 個）</legend>
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
      {error && <span role="alert" className="mt-1 block text-xs text-danger">{error}</span>}
    </fieldset>
  );
}
