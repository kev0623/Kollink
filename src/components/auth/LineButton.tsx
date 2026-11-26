"use client";

import { useEffect, useState } from "react";

/** LINE 官方圖示（對話框＋LINE 字樣；路徑取自 simple-icons，CC0）。顏色跟著文字（白）。 */
function LineLogo() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

/**
 * 「使用 LINE 登入」：依 LINE 登入按鈕規範（底色 #06C755、白字、左側 LINE 圖示＋分隔線）。
 * 是一般連結（整頁導覽到 /auth/line/start），伺服器再導去 LINE；按下後顯示「前往 LINE 中…」並防止重複點擊。
 */
export function LineButton({ href, disabled = false }: { href: string; disabled?: boolean }) {
  const [pending, setPending] = useState(false);
  // 從 LINE 按「上一頁」回來（bfcache）時恢復按鈕
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => { if (e.persisted) setPending(false); };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  const off = disabled || pending;
  return (
    <a
      href={href}
      onClick={(e) => {
        if (off) {
          e.preventDefault();
          return;
        }
        setPending(true);
      }}
      aria-disabled={off || undefined}
      className={`flex h-11 w-full items-center rounded-btn bg-line-brand pl-3 pr-4 font-bold text-on-line-brand transition-colors hover:bg-line-brand-hover active:scale-[0.98] ${off ? "pointer-events-none opacity-60" : ""}`}
    >
      <LineLogo />
      <span aria-hidden="true" className="ml-3 h-6 w-px bg-on-line-brand/30" />
      <span className="flex-1 text-center">{pending ? "前往 LINE 中…" : "使用 LINE 登入"}</span>
    </a>
  );
}
