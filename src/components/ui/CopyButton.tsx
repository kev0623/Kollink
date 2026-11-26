"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { btn } from "./styles";

/** 複製文字（驗證碼等）。複製成功 2 秒內顯示「已複製」。 */
export function CopyButton({ text, label = "複製" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
      className={`${btn.ghost} h-11 px-3 text-sm`}
    >
      {done ? <Check size={16} strokeWidth={1.5} aria-hidden="true" /> : <Copy size={16} strokeWidth={1.5} aria-hidden="true" />}
      <span aria-live="polite">{done ? "已複製" : label}</span>
    </button>
  );
}
