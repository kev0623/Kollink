"use client";

import { useId } from "react";

type Props = {
  legend: string;
  /** 表單欄位名稱：每個選到的值輸出一個隱藏欄位 */
  name: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
  error?: string;
  hint?: string;
};

/** 受控的多選標籤。清單以外的既有值（資料庫裡的舊值）也會顯示，可以取消。 */
export function ChipMultiSelect({ legend, name, options, value, onChange, max, error, hint }: Props) {
  const noteId = useId();
  const all = [...options, ...value.filter((v) => !options.includes(v))];
  function toggle(c: string) {
    if (value.includes(c)) onChange(value.filter((x) => x !== c));
    else if (value.length < max) onChange([...value, c]);
  }
  const note = error ?? hint;
  return (
    <fieldset aria-describedby={note ? noteId : undefined}>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {all.map((c) => {
          const on = value.includes(c);
          return (
            <button
              key={c} type="button" onClick={() => toggle(c)} aria-pressed={on}
              className={`min-h-9 rounded-full border px-3 py-1 text-sm font-medium ${on ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-ink"}`}
            >
              {c}
            </button>
          );
        })}
      </div>
      {value.map((c) => <input key={c} type="hidden" name={name} value={c} />)}
      {note && <span id={noteId} className={`mt-1 block text-xs ${error ? "text-danger" : "text-muted"}`}>{note}</span>}
    </fieldset>
  );
}
