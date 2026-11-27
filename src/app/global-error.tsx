"use client";

import { useEffect, useSyncExternalStore } from "react";
import { classifyError, digestOf, ERROR_COPY, supportSubject } from "@/lib/errors/classify";
import { SITE_NAME, SUPPORT_PAGE, isSupportPlaceholder, supportMailto } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";

// 根 layout 本身出錯時的最後一道畫面。這裡會取代整個 <html>，globals.css、字型與元件樣式都不保證存在，
// 所以樣式全部內嵌，顏色直接寫 globals.css 的 token 值（深色是預設；淺色跟隨系統或使用者選擇）。
const CSS = `
:root{color-scheme:dark;--bg:#0D1424;--surface:#1A2540;--line:#62739A;--ink:#EEF1F7;--muted:#9AA6BF;--primary:#D9392F;--thread:#F0483E;--focus:#FF9A8F}
:root[data-theme="light"]{color-scheme:light;--bg:#F3F5F9;--surface:#FFFFFF;--line:#7D88A0;--ink:#0D1424;--muted:#56617A;--primary:#D2342B;--thread:#D2342B;--focus:#B8281F}
@media (prefers-color-scheme: light){:root:not([data-theme]){color-scheme:light;--bg:#F3F5F9;--surface:#FFFFFF;--line:#7D88A0;--ink:#0D1424;--muted:#56617A;--primary:#D2342B;--thread:#D2342B;--focus:#B8281F}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:"PingFang TC","Microsoft JhengHei",system-ui,sans-serif;line-height:1.7}
main{min-height:100vh;min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px 16px;text-align:center;max-width:28rem;margin:0 auto}
h1{font-family:"Songti TC","PMingLiU",serif;font-size:28px;line-height:1.2;margin:24px 0 0}
p{margin:12px 0 0;font-size:14px;color:var(--muted)}
.actions{margin-top:32px;display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
.btn{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 24px;border-radius:9999px;font:inherit;font-weight:700;font-size:16px;text-decoration:none;cursor:pointer}
.primary{border:0;background:var(--primary);color:#fff}
.secondary{border:1px solid var(--line);background:var(--surface);color:var(--ink)}
.meta{margin-top:32px;padding-top:20px;border-top:1px solid var(--line);width:100%}
.meta a{color:var(--ink);font-weight:600;display:inline-flex;min-height:44px;align-items:center}
code{font-family:inherit;font-weight:600;color:var(--ink);word-break:break-all}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
`;

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const kind = classifyError(error, online);
  const copy = ERROR_COPY[kind];
  const digest = digestOf(error);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        <title>{`${copy.title}｜${SITE_NAME}`}</title>
        <meta name="robots" content="noindex" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <main role="alert">
          <svg viewBox="0 0 160 48" width="160" height="48" aria-hidden="true" focusable="false">
            <path d="M8 34 C 34 34, 58 30, 76 22 C 96 13, 98 -2, 84 4 C 68 11, 80 40, 104 34 C 124 29, 138 20, 152 20" fill="none" stroke="var(--thread)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="8" cy="34" r="5" fill="var(--thread)" />
          </svg>
          <h1>{copy.title}</h1>
          <p>{copy.body}</p>
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => (kind === "stale-build" ? window.location.reload() : retry())}>
              {copy.primary}
            </button>
            {/* 整個應用程式可能都壞了：用一般連結做整頁載入，不靠用戶端路由 */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="btn secondary" href="/">回首頁</a>
          </div>
          {kind === "generic" && (
            <div className="meta">
              {digest && <p style={{ margin: 0 }}>錯誤代碼 <code>{digest}</code></p>}
              <a href={isSupportPlaceholder() ? SUPPORT_PAGE : supportMailto(supportSubject(digest))}>
                {isSupportPlaceholder() ? "常見問題與聯絡方式" : "寄信給我們"}
              </a>
            </div>
          )}
        </main>
      </body>
    </html>
  );
}
