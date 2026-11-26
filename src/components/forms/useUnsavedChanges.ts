"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LinkLike = { href: string; target?: string; download?: string | boolean };
type ClickLike = { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean };

/** 點到的連結若是會換頁的站內連結，回傳要去的路徑；新分頁、下載、同頁（含 #錨點）、按住修飾鍵、站外連結回傳 null。純函式，有測試。 */
export function internalNavTarget(a: LinkLike, ev: ClickLike, here: { origin: string; pathname: string; search: string }): string | null {
  if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return null;
  if (a.target && a.target !== "_self") return null;
  if (a.download) return null;
  let url: URL;
  try { url = new URL(a.href, here.origin); } catch { return null; }
  if (url.origin !== here.origin) return null;
  if (url.pathname === here.pathname && url.search === here.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export type LeaveGuard = { target: string | null; stay: () => void; leave: () => void };

/**
 * 有未儲存的變更時：
 * 1. 關閉分頁、重新整理、整頁導覽：請瀏覽器提示（不能自訂文字）。
 * 2. 站內點連結（Next 的客戶端導覽不會觸發 beforeunload）：攔下點擊，並把要去的路徑放進 target，
 *    呼叫端用 <LeaveDialog guard={...} /> 顯示頁面內的確認對話框。瀏覽器的上一頁按鈕無法攔截。
 */
export function useUnsavedChanges(dirty: boolean): LeaveGuard {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const dest = internalNavTarget(a, e, window.location);
      if (!dest) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setTarget(dest);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const stay = useCallback(() => setTarget(null), []);
  const leave = useCallback(() => {
    const dest = target;
    setTarget(null);
    if (dest) router.push(dest);
  }, [router, target]);

  // 儲存成功（dirty 變 false）之後不再顯示
  return { target: dirty ? target : null, stay, leave };
}
