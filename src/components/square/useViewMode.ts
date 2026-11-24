"use client";

import { useCallback, useSyncExternalStore } from "react";
import { VIEW_MODE_KEY, readViewMode, writeViewMode, type ViewMode } from "@/lib/creators/view-mode";

const listeners = new Set<() => void>();
// localStorage 寫不進去時（無痕、停用），這次瀏覽記在記憶體
let memory: ViewMode | null = null;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === VIEW_MODE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = (): ViewMode => memory ?? readViewMode(storage());
// 伺服器端與 hydrate 時固定是卡片（spec：讀不到時預設卡片）
const getServerSnapshot = (): ViewMode => "card";

/** 卡片／列表模式，記在 localStorage（見計畫 4「設計決定」4）。 */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setView = useCallback((mode: ViewMode) => {
    memory = mode;
    writeViewMode(storage(), mode);
    listeners.forEach((l) => l());
  }, []);
  return [view, setView];
}
