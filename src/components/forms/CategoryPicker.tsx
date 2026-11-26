"use client";
import { useState } from "react";
import { chip } from "@/components/ui/styles";
import { CATEGORIES } from "@/lib/options";

export function CategoryPicker({ name, initial, error }: { name: string; initial: string[]; error?: string }) {
  const [selected, setSelected] = useState<string[]>(initial);
  function toggle(c: string) {
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : s.length >= 5 ? s : [...s, c]));
  }
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">內容領域（1–5 個）</legend>
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
