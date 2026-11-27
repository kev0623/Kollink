"use client";

import { useSyncExternalStore } from "react";
import type { Lang } from "@/lib/lang";

function subscribe(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });
  return () => mo.disconnect();
}
const getSnapshot = (): Lang => (document.documentElement.getAttribute("data-lang") === "en" ? "en" : "zh");
const getServerSnapshot = (): Lang => "zh";

/** 目前的語言（client 元件用：placeholder、aria-label、<option> 這些放不了 <span> 的地方）。伺服器渲染時是中文。 */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
