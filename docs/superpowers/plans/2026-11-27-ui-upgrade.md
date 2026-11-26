# Kollink UI 升級（紅線）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Kollink 全站換成「紅線」視覺（夜靛深色為主、可切換淺色並跟隨系統、Noto Serif TC 標題），首頁、登入／註冊與創作者公開頁加上 three.js 紅線場景（有靜態 SVG 後備），後台保持俐落並統一元件；同時修掉 QA 報告的 4 個 Major 與 17 個 Minor（或明列延後原因），每個 task 結束時 App 都能建置、測試全過。

**Architecture:** 設計 token 全部在 `src/app/globals.css`（Tailwind v4 `@theme static`，深色預設、`[data-theme="light"]` 覆寫）；`<head>` 內嵌腳本在繪製前決定主題。共用 UI 放 `src/components/ui/`（class 字串在不含 `"use client"` 的 `styles.ts`，server 與 client 元件都能 import）。3D 是 `src/components/thread/`：純 TS 的 `thread-scene.ts`（只具名 import `three`）＋ client 包裝 `ThreadCanvas.tsx`（`useEffect` 內動態 import，後台 bundle 不含 three）＋ 伺服器渲染的 SVG 後備。體驗修正只動 TS（`src/lib/` 的純函式有單元測試）與畫面，不動資料庫。

**Tech Stack:** Next.js 16.4.6（App Router、`cacheComponents`、`partialPrefetching`、`proxy.ts`）、React 19.3、TypeScript、Tailwind v4.3、three 0.187、Supabase、Vitest（node 環境）、lucide-react。

**Spec:** `docs/superpowers/specs/2026-11-27-ui-upgrade-design.md`（以下簡稱「規格」，§ 編號指規格的章節）。方向：`.superpowers/sdd/ui-direction.md`；QA：`.superpowers/sdd/audit-qa.md`。

## Global Constraints

- Next.js 16 與訓練資料不同：寫程式前先讀 `node_modules/next/dist/docs/` 對應文件。本計畫用到的：`01-app/02-guides/preventing-flash-before-hydration.md`（主題腳本、`suppressHydrationWarning`、開發模式重新套用）、`01-app/03-api-reference/03-file-conventions/not-found.md`、`loading.md`「Status codes」（Suspense 內 `notFound()` 是 200＋noindex）、`01-app/03-api-reference/04-functions/generate-metadata.md`（`title.template`、`title.absolute`）、`01-app/03-api-reference/02-components/font.md`、`03-file-conventions/proxy.md`。`middleware.ts` 已改名為 `proxy.ts`。
- `cacheComponents` 已開啟：讀 `cookies()`、`searchParams`、`params`、session 的元件必須在 `<Suspense>` 內；不要在 layout 最外層 await session。不可使用 `export const runtime`、`export const dynamic`。伺服器元件讀現在時間只能在 `requireRole()`／`requireAdmin()`／`getCurrentUser()` 之後；**client 元件的 render 不可讀現在時間**（`Date.now()`、`new Date()` 只能在 effect／事件處理裡）。
- 守門：每個受保護頁面的 Suspense 內容與每個 Server Action 開頭照舊呼叫 `requireRole(...)`／`requireAdmin()`（layout 的 Gate 不算數）。本計畫不新增 Server Action 的權限邏輯，只改驗證與畫面。
- **不動資料庫**：不新增 migration、不改 RLS、不改 SQL 函式；`supabase/` 目錄不動。需要資料庫才能做的項目列在規格 §15。
- 顏色只用 `globals.css` 的 token class（規格 §2.1）。**新寫或改到的程式碼**：主要按鈕一律 `btn.primary`（`src/components/ui/styles.ts`），不可再用 `bg-ink text-on-ink` 當主要按鈕；`bg-ink text-on-ink` 只用在「選中的篩選標籤／反白膠囊」。不可用 `text-white`、`bg-black`、色碼（`opengraph-image.tsx` 與 `thread-scene.ts` 的預設色除外，兩者都有註解指向規格 §2.1）。圓角 `rounded-card`、`rounded-btn`、`rounded-input`、`rounded-nav`。
- 確認一律用頁面內的 `ConfirmAction`（或後台既有的 `NoteAction`）；不可用 `confirm()`、`alert()`。送出中的按鈕一律 `disabled` 並把文字換成「…中」。
- 表單一律 `noValidate`，不出現瀏覽器原生驗證訊息；輸入框與 textarea 字級 16px（`text-base`）；可點目標 ≥ 44px（`h-11`／`min-h-11`）。受控輸入（`value`＋`onChange`），伺服器回錯誤時欄位不被重設。
- 介面文字繁體中文；產品名稱只從 `src/lib/site.ts` 的 `SITE_NAME`；客服聯絡方式只從 `SUPPORT_EMAIL`／`SUPPORT_LINE_URL`。按鈕文字不加「→」。
- 390 寬不可出現整頁水平捲軸（長字串 `break-words`／`break-all`、`min-w-0`）。
- Server 元件不可從 `"use client"` 檔案 import 非元件的值；共用 class 放 `src/components/ui/styles.ts`（後台既有的 `src/components/admin/styles.ts` 改成轉出同一份）。
- 唯一新增的套件：`three`（dependencies）與 `@types/three`（devDependencies），版本鎖 `0.187.0`／`0.187.0`（Task 5）。three 只能在 `src/components/thread/thread-scene.ts` 具名 import；其他檔案不可 import `three`。不用 CDN、`eval`、Worker、EffectComposer。`src/lib/security-headers.ts` 不改。
- 動態：只有首頁開場一個編排動畫；`prefers-reduced-motion: reduce` 一律遵守（規格 §11）。
- 不可同時跑兩個 `next build`／`next dev`／`next start`（共用 `.next`）。Task 1–13 只跑 `npm run lint && npm run typecheck && npm test`；需要看畫面的 task（4、5、6、7、8、9、10、11、12）在 task 結尾跑**一次** `npm run build`，再用 `npm run start`（port 3000）截圖，截完立刻關掉。Task 14 是完整 E2E。
- 截圖（每個畫面 task 的驗收）：Playwright（scratchpad 的 `p5-e2e/node_modules/playwright-core`，`chromium.launch({ channel: "chrome" })`），390×844 與 1280×900、深色與淺色（在頁面載入前 `localStorage.setItem("kollink-theme", "dark"|"light")`，用 `context.addInitScript`）。截圖放 scratchpad 的 `ui-shots/task-N/`，不進 repo。
- 每個 task 結束：`npm run lint && npm run typecheck && npm test` 全過（畫面元件沒有單元測試環境；純函式一律寫測試）。
- 只動本機：不可連正式 Supabase、不可讀印 `.env.local`、不可部署。
- Commit 訊息「UI 升級 Task N：重點」，結尾加你所在環境指定的 Co-Authored-By 歸屬行（寫實際執行的模型）。只 `git add` 該 task 列出的檔案。分支 `ui-upgrade`。

## 設計決定

讀過的文件：上列 Next 文件；`src/lib/security-headers.ts`（靜態 CSP：`script-src 'self' 'unsafe-inline'`、`worker-src 'self' blob:`、`font-src 'self'`）；`src/app/layout.tsx`、`globals.css`、`components/shell/*`、`components/briefs/ConfirmAction.tsx`、`components/forms/*`、`components/collabs/*`、`components/messages/*`、`app/page.tsx`、`app/login`、`app/signup`、`app/c/[handle]/*`、`src/proxy.ts`、`lib/auth/*`、`lib/payments/*`、`lib/validation/collab.ts`、`lib/validation/brief.ts`、`lib/messages/view.ts`。

1. **Token 與舊 class**：規格 §2.3 的對照。Task 1 做三個機械替換（`bg-primary-soft`→`bg-subtle`、`text-primary`→`text-accent`、`accent-ink`→`accent-primary`）與未讀徽章；其餘名稱不變、值換新，所以 Task 1 後全站立即是新配色、不會壞。被當成主要按鈕的 `bg-ink text-on-ink` 在各畫面 task 換成 `btn.primary`（Task 13 用 grep 收尾）。
2. **`@theme static`**：3D 場景用 `getComputedStyle` 讀 `--color-thread` 等變數，但沒有 utility 用到它們時 Tailwind 預設不輸出；`static` 讓整組變數一定存在。
3. **淺色寫兩次**（`:root[data-theme="light"]` 與沒有 JS 時的 media query）：`src/app/theme-tokens.test.ts` 讀 `globals.css` 斷言兩段完全相同、且每個深色 token 都有淺色值。
4. **主題腳本**放在 `src/lib/theme.ts` 的字串常數 `THEME_SCRIPT`，單元測試用 `node:vm` 在假的 `document`／`localStorage`／`matchMedia` 裡執行它。`ThemeSelect` 用 `useSyncExternalStore` 讀 `<html data-theme-pref>`（伺服器快照固定 `system`），不在 effect 裡 setState。
5. **`<title>`**：根 layout `title.template = "%s｜Kollink"`；`profileMetadata` 原本自己組「…｜Kollink」，改成 `title: { absolute }` 避免重複（`metadata.test.ts` 跟著改）。
6. **已登入者的 /login、/signup**：`proxy.ts` 已經拿到 `user`；`src/lib/auth/routes.ts` 新增純函式 `authPageRedirect(pathname, search)` 決定導去 `/auth/continue?…`。網址帶 `error` 時不導（`/auth/continue` 失敗會回 `/login?error=profile`，否則會無限循環）。
7. **找不到創作者的 404（m1 的一部分）**：`proxy.ts` 對只有一段的 `/c/<x>` 在 `x` 不符合 `HANDLE_RE` 時 `NextResponse.rewrite` 到不存在的路由 `/_kollink-not-found`，由 Next 以 404 狀態渲染 `app/not-found.tsx`（Next 文件 loading.md：「For a 404, you can check the slug in Proxy, then rewrite it to a not-found route」）。純函式 `invalidCreatorPath` 有測試；實際狀態碼在 Task 7 用 curl 驗證，不符時停下來回報。格式合法但不存在的 handle 仍是 200＋noindex（規格 §15）。
8. **金額上限**：不擋建立（後台已有人工標記已付款），但 `validateOffer` 在金額 > `PAYMENT_MAX_TWD` 時要求 `offlineAck === "1"`；錯誤字與說明帶 `SupportLink`。
9. **付款返回輪詢**：`PaymentStatusPoller`（client）每 5 秒 `router.refresh()`，最多 36 次（3 分鐘），`document.hidden` 時跳過；輪詢節奏的純函式 `nextPollDelay` 有測試。不加 API route。
10. **收款帳戶提醒**：`src/lib/creators/payout-status.ts` 的 `loadHasPayoutAccount(supabase, uid)`（選 `user_id`、`head: true`、`count: "exact"`；RLS 已允許本人讀自己的列，`account_number` 欄位不在選取內）；是否要提醒由純函式 `needsPayoutPrompt(status, hasAccount)` 決定。
11. **「我的」合併**：`/creator/me` 一頁分段；`/creator/me/profile` 變成 `redirect("/creator/me#profile")`（在 Suspense 內的 async 元件裡 redirect，與既有頁面一致）。頭像與作品「上傳即儲存」：上傳成功後立即呼叫既有的儲存 Server Action（不新增 action）。
12. **招募精靈步驟歷史**：`replaceState` 改 `pushState`，監聽 `popstate` 把 `?step=` 讀回來；草稿至少要有案名（`validateBrief` draft 模式；`brief.test.ts` 對應改）。
13. **字數**：訊息與交付內容沿用 `textLength`（code point）；超過上限時停用送出，不用 `maxLength`（`maxLength` 以 UTF-16 計，會在 emoji 處誤判）。
14. **3D 的 Bundle 隔離**：`ThreadCanvas` 只在 `/`、`/login`、`/signup`、`/c/[handle]` 用；`useEffect` 內 `import("./thread-scene")`。Task 5 用 `.next/static/chunks` 找出含 `WebGLRenderer` 字串的 chunk，確認它不在 `/brand` 等頁面的 build manifest 裡。

## File Structure

新增：
- `src/lib/theme.ts`、`src/lib/theme.test.ts`、`src/app/theme-tokens.test.ts`
- `src/components/theme/ThemeSync.tsx`、`src/components/theme/ThemeSelect.tsx`
- `src/components/ui/styles.ts`、`Notice.tsx`、`EmptyState.tsx`、`Skeleton.tsx`、`PageHeader.tsx`、`FilePicker.tsx`、`ThreadMark.tsx`、`SupportLink.tsx`、`ErrorText.tsx`、`SkipLink.tsx`
- `src/lib/support.ts`、`src/lib/support.test.ts`、`src/lib/site.test.ts`
- `src/app/help/page.tsx`、`src/app/not-found.tsx`
- `src/components/shell/AccountLink.tsx`、`src/components/shell/MobileTopBar.tsx`
- `src/components/landing/*`（`Hero.tsx`、`HowItWorks.tsx`、`ForBoth.tsx`、`Trust.tsx`、`LandingFooter.tsx`、`TopBar.tsx`）
- `src/components/thread/thread-scene.ts`、`ThreadCanvas.tsx`、`ThreadFallback.tsx`、`palette.ts`、`palette.test.ts`
- `src/components/auth/AuthShell.tsx`
- `src/app/creator/briefs/[id]/not-found.tsx`、`src/app/brand/collabs/[id]/not-found.tsx`、`src/app/creator/collabs/[id]/not-found.tsx`
- `src/components/collabs/PaymentStatusPoller.tsx`、`src/lib/payments/poll.ts`、`poll.test.ts`
- `src/lib/creators/payout-status.ts`、`payout-status.test.ts`
- `src/components/collabs/PayoutPrompt.tsx`

主要修改：`globals.css`、`layout.tsx`、`page.tsx`、`proxy.ts`、`lib/auth/routes.ts`、`lib/site.ts`、`components/shell/*`、三個區的 layout、所有 `page.tsx`（metadata）、`ConfirmAction.tsx`、`forms/*`、`collabs/*`、`messages/*`、`square/*`、`briefs/*`、`admin/*`、`app/c/[handle]/*`、`lib/validation/collab.ts`、`lib/validation/brief.ts`、`lib/collabs/errors.ts`、`lib/format.ts`、`lib/messages/view.ts`、`README.md`。

---

### Task 1: Token、字體、主題切換

**Files:**
- Modify: `src/app/globals.css`（整個重寫）、`src/app/layout.tsx`、`src/components/shell/UnreadBadge.tsx`
- Create: `src/lib/theme.ts`、`src/lib/theme.test.ts`、`src/app/theme-tokens.test.ts`、`src/components/theme/ThemeSync.tsx`、`src/components/theme/ThemeSelect.tsx`
- Modify（機械替換）：所有含 `bg-primary-soft`、`text-primary`、`accent-ink` 的 `.tsx`

- [ ] **Step 0：效能基準（改任何程式之前）**：`npm run build`，把輸出中 `/` 那一列（Size／First Load JS）與 `.next/static/chunks` 的總 gzip 量存到 scratchpad `ui-shots/baseline.txt`（Task 14 比較用）。這是 Task 1 唯一一次 build。

- [ ] **Step 1：先寫測試 `src/lib/theme.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { parseThemePref, resolveTheme, THEME_OPTIONS, THEME_SCRIPT, THEME_STORAGE_KEY } from "./theme";

type Env = { stored: string | null; systemLight: boolean; throws?: boolean };

function runScript({ stored, systemLight, throws }: Env) {
  const attrs: Record<string, string> = {};
  const style: Record<string, string> = {};
  const ctx = {
    document: { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; }, style } },
    localStorage: {
      getItem: (k: string) => {
        if (throws) throw new Error("blocked");
        return k === THEME_STORAGE_KEY ? stored : null;
      },
    },
    window: { matchMedia: (q: string) => ({ matches: q.includes("light") ? systemLight : !systemLight }) },
  };
  runInNewContext(THEME_SCRIPT, ctx);
  return { attrs, style };
}

describe("parseThemePref", () => {
  it("只認得 dark／light／system，其他一律 system", () => {
    expect(parseThemePref("dark")).toBe("dark");
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("system")).toBe("system");
    expect(parseThemePref("blue")).toBe("system");
    expect(parseThemePref(null)).toBe("system");
    expect(parseThemePref(undefined)).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("system 依系統；手動選擇優先", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("light", false)).toBe("light");
  });
});

describe("THEME_OPTIONS", () => {
  it("三個選項都有中文標籤", () => {
    expect(THEME_OPTIONS.map((o) => o.label)).toEqual(["跟隨系統", "深色", "淺色"]);
  });
});

describe("THEME_SCRIPT（繪製前執行的內嵌腳本）", () => {
  it("沒有偏好時跟隨系統", () => {
    expect(runScript({ stored: null, systemLight: true }).attrs).toEqual({ "data-theme": "light", "data-theme-pref": "system" });
    expect(runScript({ stored: null, systemLight: false }).attrs).toEqual({ "data-theme": "dark", "data-theme-pref": "system" });
  });
  it("手動偏好優先，並設定 color-scheme", () => {
    const r = runScript({ stored: "light", systemLight: false });
    expect(r.attrs["data-theme"]).toBe("light");
    expect(r.style.colorScheme).toBe("light");
  });
  it("不認得的值當成 system；localStorage 被封鎖時不丟錯", () => {
    expect(runScript({ stored: "x", systemLight: false }).attrs["data-theme-pref"]).toBe("system");
    expect(() => runScript({ stored: null, systemLight: false, throws: true })).not.toThrow();
  });
});
```

- [ ] **Step 2：執行 `npx vitest run src/lib/theme.test.ts`，確認失敗（找不到模組）**

- [ ] **Step 3：建立 `src/lib/theme.ts`**

```ts
// 主題（規格 §4）。THEME_SCRIPT 在 <head> 內嵌執行（繪製前）；其他函式只在瀏覽器呼叫。
// CSP 是靜態的 script-src 'self' 'unsafe-inline'（src/lib/security-headers.ts），內嵌腳本可以執行。

export const THEME_STORAGE_KEY = "kollink-theme";

export type ThemePref = "dark" | "light" | "system";
export type Theme = "dark" | "light";

export const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "system", label: "跟隨系統" },
  { value: "dark", label: "深色" },
  { value: "light", label: "淺色" },
];

export function parseThemePref(v: unknown): ThemePref {
  return v === "dark" || v === "light" ? v : "system";
}

export function resolveTheme(pref: ThemePref, systemPrefersLight: boolean): Theme {
  if (pref === "system") return systemPrefersLight ? "light" : "dark";
  return pref;
}

const LIGHT_QUERY = "(prefers-color-scheme: light)";

/** 與 parseThemePref／resolveTheme 相同的邏輯，寫成 ES5（在任何 bundle 之前執行）。 */
export const THEME_SCRIPT =
  `(function(){try{var d=document.documentElement,p=localStorage.getItem("${THEME_STORAGE_KEY}");` +
  `if(p!=="dark"&&p!=="light")p="system";` +
  `var t=p==="system"?(window.matchMedia("${LIGHT_QUERY}").matches?"light":"dark"):p;` +
  `d.setAttribute("data-theme",t);d.setAttribute("data-theme-pref",p);d.style.colorScheme=t}catch(e){}})();`;

/** 瀏覽器：讀使用者偏好（localStorage 被封鎖時當成 system）。 */
export function readThemePref(): ThemePref {
  try {
    return parseThemePref(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/** 瀏覽器：套用偏好到 <html>；persist 為 true 時寫回 localStorage。回傳實際主題。 */
export function applyThemePref(pref: ThemePref, persist: boolean): Theme {
  const theme = resolveTheme(pref, window.matchMedia(LIGHT_QUERY).matches);
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-theme-pref", pref);
  root.style.colorScheme = theme;
  if (persist) {
    try {
      if (pref === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      // 無痕模式等：只影響這一頁
    }
  }
  return theme;
}

export function watchSystemTheme(onChange: () => void): () => void {
  const mq = window.matchMedia(LIGHT_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
```

- [ ] **Step 4：執行 `npx vitest run src/lib/theme.test.ts`，全過**

- [ ] **Step 5：重寫 `src/app/globals.css`**

```css
@import "tailwindcss";

/*
 * 設計 token（規格 docs/superpowers/specs/2026-11-27-ui-upgrade-design.md §2）。
 * 深色是預設（@theme）。淺色寫兩次：使用者／腳本選了淺色（[data-theme="light"]），
 * 以及沒有 JS 時跟隨系統（media query）。兩段必須完全相同：src/app/theme-tokens.test.ts 會檢查。
 * static：3D 場景用 getComputedStyle 讀 --color-thread 等變數，即使沒有 utility 用到也要輸出。
 */
@theme static {
  --color-bg: #0D1424;
  --color-panel: #131C31;
  --color-surface: #1A2540;
  --color-subtle: #24304F;
  --color-line: #2A3654;
  --color-line-strong: #62739A;
  --color-ink: #EEF1F7;
  --color-on-ink: #0D1424;
  --color-muted: #9AA6BF;
  --color-primary: #D9392F;
  --color-primary-hover: #C2322A;
  --color-on-primary: #FFFFFF;
  --color-primary-soft: #3A1D26;
  --color-accent: #FF7A70;
  --color-thread: #F0483E;
  --color-thread-glow: #FF6B5E;
  --color-far: #2A3654;
  --color-success: #8FD3BF;
  --color-success-soft: #17332F;
  --color-danger: #FF8A80;
  --color-danger-soft: #3A1A1E;
  --color-focus: #FF9A8F;

  --radius-card: 20px;
  --radius-btn: 9999px;
  --radius-nav: 16px;
  --radius-input: 12px;

  --font-sans: var(--font-manrope), var(--font-noto-sans), "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif;
  --font-serif: var(--font-noto-serif), "Songti TC", "PMingLiU", serif;
}

/* light:start */
:root[data-theme="light"] {
  --color-bg: #F3F5F9;
  --color-panel: #E9EDF4;
  --color-surface: #FFFFFF;
  --color-subtle: #EEF1F6;
  --color-line: #D5DBE7;
  --color-line-strong: #7D88A0;
  --color-ink: #0D1424;
  --color-on-ink: #FFFFFF;
  --color-muted: #56617A;
  --color-primary: #D2342B;
  --color-primary-hover: #B8281F;
  --color-on-primary: #FFFFFF;
  --color-primary-soft: #FBE4E1;
  --color-accent: #B8281F;
  --color-thread: #D2342B;
  --color-thread-glow: #E8584E;
  --color-far: #C9D1E0;
  --color-success: #17705A;
  --color-success-soft: #DDF3EC;
  --color-danger: #B42318;
  --color-danger-soft: #FDECEA;
  --color-focus: #B8281F;
  color-scheme: light;
}
/* light:end */

@media (prefers-color-scheme: light) {
  /* light-nojs:start */
  :root:not([data-theme]) {
    --color-bg: #F3F5F9;
    --color-panel: #E9EDF4;
    --color-surface: #FFFFFF;
    --color-subtle: #EEF1F6;
    --color-line: #D5DBE7;
    --color-line-strong: #7D88A0;
    --color-ink: #0D1424;
    --color-on-ink: #FFFFFF;
    --color-muted: #56617A;
    --color-primary: #D2342B;
    --color-primary-hover: #B8281F;
    --color-on-primary: #FFFFFF;
    --color-primary-soft: #FBE4E1;
    --color-accent: #B8281F;
    --color-thread: #D2342B;
    --color-thread-glow: #E8584E;
    --color-far: #C9D1E0;
    --color-success: #17705A;
    --color-success-soft: #DDF3EC;
    --color-danger: #B42318;
    --color-danger-soft: #FDECEA;
    --color-focus: #B8281F;
    color-scheme: light;
  }
  /* light-nojs:end */
}

:root {
  color-scheme: dark;
}

@layer base {
  html {
    background: var(--color-bg);
  }
  body {
    background: var(--color-bg);
    color: var(--color-ink);
    line-height: 1.7;
  }
  h1, h2, h3 {
    line-height: 1.2;
  }
  /* 焦點框全站一致（規格 §9.13）；既有的 focus-visible:ring-* 可以並存 */
  :focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  ::selection {
    background: var(--color-primary-soft);
    color: var(--color-ink);
  }
}

/* 規格 §11：reduced motion 時所有過場瞬間完成（3D 與捲動紅線另外處理） */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 6：寫 `src/app/theme-tokens.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function block(start: string, end: string): string {
  const s = css.indexOf(start);
  const e = css.indexOf(end);
  if (s < 0 || e < 0) throw new Error(`找不到 ${start}`);
  return css.slice(s + start.length, e);
}

function vars(text: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const [, k, v] of text.matchAll(/(--color-[a-z-]+):\s*([^;]+);/g)) m.set(k, v.trim());
  return m;
}

const darkText = css.slice(css.indexOf("@theme static"), css.indexOf("/* light:start */"));
const dark = vars(darkText);
const light = vars(block("/* light:start */", "/* light:end */"));
const lightNoJs = vars(block("/* light-nojs:start */", "/* light-nojs:end */"));

describe("globals.css 的主題 token", () => {
  it("沒有 JS 的淺色與 [data-theme=light] 完全相同", () => {
    expect([...lightNoJs]).toEqual([...light]);
  });
  it("每個深色 token 都有淺色值", () => {
    expect([...light.keys()].sort()).toEqual([...dark.keys()].sort());
  });
  it("規格 §2.1 的 token 都在", () => {
    for (const k of ["bg", "panel", "surface", "subtle", "line", "line-strong", "ink", "on-ink", "muted", "primary", "primary-hover",
      "on-primary", "primary-soft", "accent", "thread", "thread-glow", "far", "success", "success-soft", "danger", "danger-soft", "focus"]) {
      expect(dark.has(`--color-${k}`), k).toBe(true);
    }
  });
  it("淺色 success 加深（QA m9）", () => {
    expect(light.get("--color-success")).toBe("#17705A");
  });
});
```

- [ ] **Step 7：主題元件 `src/components/theme/ThemeSync.tsx`**

```tsx
"use client";

import { useLayoutEffect } from "react";
import { applyThemePref, readThemePref, watchSystemTheme } from "@/lib/theme";

/**
 * 內嵌腳本已在繪製前設定好主題；這裡只做兩件事：
 * 1. 開發模式 Strict Mode 重新掛載時 React 會清掉 <html> 上的屬性，再套用一次（正式環境是 no-op）。
 * 2. 偏好是「跟隨系統」時，系統切換深淺色就跟著換。
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyThemePref(readThemePref(), false);
    return watchSystemTheme(() => {
      if (readThemePref() === "system") applyThemePref("system", false);
    });
  }, []);
  return null;
}
```

- [ ] **Step 8：`src/components/theme/ThemeSelect.tsx`**

```tsx
"use client";

import { useId, useSyncExternalStore } from "react";
import { Moon } from "lucide-react";
import { applyThemePref, parseThemePref, THEME_OPTIONS, type ThemePref } from "@/lib/theme";

function subscribe(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-pref"] });
  return () => mo.disconnect();
}
const getSnapshot = (): ThemePref => parseThemePref(document.documentElement.getAttribute("data-theme-pref"));
const getServerSnapshot = (): ThemePref => "system";

/** 主題選擇（規格 §4）：原生 select。compact 用在 88px 寬的側欄。 */
export function ThemeSelect({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const pref = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <div className={compact ? "flex w-full flex-col items-center gap-1" : "flex items-center gap-3"}>
      <label htmlFor={id} className={compact ? "flex items-center gap-1 text-[11px] text-muted" : "text-sm font-semibold text-ink"}>
        {compact && <Moon size={12} strokeWidth={1.5} aria-hidden="true" />}主題
      </label>
      <select
        id={id}
        value={pref}
        onChange={(e) => applyThemePref(parseThemePref(e.target.value), true)}
        className={`h-11 rounded-input border border-line-strong bg-surface text-base text-ink ${compact ? "w-[76px] px-1 text-center text-sm" : "px-3"}`}
      >
        {THEME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
```

（compact 版在桌面側欄，桌面瀏覽器不會因 14px 而縮放，所以允許 `text-sm`。）

- [ ] **Step 9：`src/app/layout.tsx` 整個換成**

```tsx
import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Sans_TC, Noto_Serif_TC } from "next/font/google";
import "./globals.css";
import { ThemeSync } from "@/components/theme/ThemeSync";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";

// 規格 §3：中文字型切成 unicode-range 小檔，不 preload（瀏覽器只抓用到的切片）；Manrope 只有 latin、preload。
const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-manrope" });
const notoSans = Noto_Sans_TC({ weight: ["400", "500", "700"], display: "swap", preload: false, variable: "--font-noto-sans" });
const notoSerif = Noto_Serif_TC({ weight: ["700", "900"], display: "swap", preload: false, variable: "--font-noto-serif" });

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s｜${SITE_NAME}` },
  description: SITE_TAGLINE,
};

// viewport-fit=cover：底部導覽列要用 env(safe-area-inset-bottom)
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0D1424" },
    { media: "(prefers-color-scheme: light)", color: "#F3F5F9" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme 由 <head> 的腳本在繪製前設定（沒有 JS 時 CSS 跟隨系統），所以 html 要 suppressHydrationWarning
    <html lang="zh-Hant" suppressHydrationWarning className={`${manrope.variable} ${notoSans.variable} ${notoSerif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        {children}
        <ThemeSync />
      </body>
    </html>
  );
}
```

- [ ] **Step 10：機械替換（在 repo 根目錄執行）**

```bash
grep -rlE "bg-primary-soft|text-primary|accent-ink" src --include='*.tsx' --include='*.ts' \
  | xargs perl -pi -e 's/\bbg-primary-soft\b/bg-subtle/g; s/\btext-primary(?![-\w])/text-accent/g; s/\baccent-ink\b/accent-primary/g'
```

再把 `src/components/shell/UnreadBadge.tsx` 徽章的 class 換成（未讀用紅線紅，規格 §1）：

```tsx
    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-btn bg-primary px-1 text-[10px] font-bold leading-none text-on-primary">
```

- [ ] **Step 11：檢查**

```bash
grep -rnE "bg-primary-soft|text-primary\b|accent-ink|font-rubik|--font-noto-sans-tc" src   # 預期沒有輸出
npm run lint && npm run typecheck && npm test
```

- [ ] **Step 12：Commit**

```bash
git add src/app/globals.css src/app/layout.tsx src/app/theme-tokens.test.ts src/lib/theme.ts src/lib/theme.test.ts \
  src/components/theme src/components/shell/UnreadBadge.tsx $(git diff --name-only -- src)
git commit -m "UI 升級 Task 1：紅線 token、Noto Serif／Sans TC＋Manrope、深淺主題切換（無閃爍）"
```

---

### Task 2: 共用元件、客服入口、找不到頁面

**Files:**
- Create: `src/components/ui/styles.ts`、`Notice.tsx`、`EmptyState.tsx`、`Skeleton.tsx`、`PageHeader.tsx`、`FilePicker.tsx`、`ThreadMark.tsx`、`SupportLink.tsx`、`ErrorText.tsx`、`SkipLink.tsx`；`src/lib/support.ts`、`src/lib/support.test.ts`、`src/lib/site.test.ts`；`src/app/help/page.tsx`、`src/app/not-found.tsx`
- Modify: `src/lib/site.ts`、`src/components/briefs/ConfirmAction.tsx`、`src/components/forms/Field.tsx`、`src/components/admin/styles.ts`、`src/lib/collabs/errors.ts`、`src/lib/upload-limits.ts`（只改文字）、`README.md`（上線前檢查一條）

- [ ] **Step 1：`src/lib/site.ts` 整個換成**

```ts
export const SITE_NAME = "Kollink";
export const SITE_TAGLINE = "台灣品牌 × 創作者合作平台";

/** 首頁大標（規格 §5.2；B「一條紅線，從品牌牽到創作者。」、C「好的合作，從牽對線開始。」） */
export const HERO_HEADLINE = "把對的品牌，牽到對的創作者。";

// ─────────────────────────────────────────────────────────────
// TODO(owner)：上線前改成真實的客服信箱與 LINE 官方帳號網址（README「上線前檢查」）。
// 目前是佔位值：example.com 是保留網域，寄不出去。LINE 沒有就保持 null（畫面不顯示）。
export const SUPPORT_EMAIL = "support@example.com";
export const SUPPORT_LINE_URL: string | null = null;
// ─────────────────────────────────────────────────────────────

export const SUPPORT_PAGE = "/help";

/** 寄信連結；subject 會帶進信件主旨（例如「帳號暫停」）。 */
export function supportMailto(subject?: string): string {
  return subject ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[${SITE_NAME}] ${subject}`)}` : `mailto:${SUPPORT_EMAIL}`;
}

/** 客服信箱是否還是佔位值（/help 與 README 用；正式上線前必須為 false）。 */
export function isSupportPlaceholder(): boolean {
  return SUPPORT_EMAIL.endsWith("@example.com");
}
```

- [ ] **Step 2：`src/lib/site.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { HERO_HEADLINE, SITE_NAME, SUPPORT_EMAIL, SUPPORT_LINE_URL, supportMailto } from "./site";

describe("site", () => {
  it("客服信箱是合法的 email；LINE 是 https 或 null", () => {
    expect(SUPPORT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
    if (SUPPORT_LINE_URL !== null) expect(SUPPORT_LINE_URL).toMatch(/^https:\/\//);
  });
  it("mailto 主旨加上產品名稱並編碼", () => {
    expect(supportMailto()).toBe(`mailto:${SUPPORT_EMAIL}`);
    expect(supportMailto("帳號暫停")).toBe(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[${SITE_NAME}] 帳號暫停`)}`);
  });
  it("首頁大標不含「→」", () => {
    expect(HERO_HEADLINE).not.toContain("→");
  });
});
```

- [ ] **Step 3：`src/lib/support.ts` 與測試**

```ts
// 錯誤文字裡提到「聯絡平台／客服」時，畫面要接一個真的聯絡方式（QA M4）。
const SUPPORT_RE = /聯絡(平台|客服|我們)/;

export function mentionsSupport(message: string | null | undefined): boolean {
  return typeof message === "string" && SUPPORT_RE.test(message);
}
```

```ts
// src/lib/support.test.ts
import { describe, expect, it } from "vitest";
import { mentionsSupport } from "./support";

describe("mentionsSupport", () => {
  it("提到聯絡平台／客服／我們時為 true", () => {
    expect(mentionsSupport("金額超過線上付款上限，需要由平台協助線下付款，請聯絡平台")).toBe(true);
    expect(mentionsSupport("帳號已暫停，請聯絡客服")).toBe(true);
    expect(mentionsSupport("驗證碼錯誤")).toBe(false);
    expect(mentionsSupport(null)).toBe(false);
  });
});
```

並在 `src/lib/collabs/errors.ts` 把兩則訊息改成（其餘不動；`errors.test.ts` 若比對全文跟著改）：

```ts
  "amount exceeds online payment limit": "金額超過線上付款上限（NT$200,000），需要由平台協助線下付款，請聯絡平台",
  "payment in progress": "品牌已取得轉帳帳號，等付款期限過後才能退出；需要協助請聯絡平台",
```

`src/lib/upload-limits.ts` 的訊息已含「請聯絡平台協助」，不用改。

- [ ] **Step 4：`src/components/ui/styles.ts`（不加 `"use client"`）**

```ts
// 共用 class（server 與 client 元件都能 import）。規格 §9。
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-btn font-bold transition-colors active:scale-[0.98] " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export const btn = {
  /** 每頁唯一的主要動作：實心紅、無圖示 */
  primary: `${btnBase} h-11 px-6 bg-primary text-on-primary hover:bg-primary-hover`,
  /** 首頁入口等大按鈕 */
  primaryLg: `${btnBase} h-[52px] px-7 text-base bg-primary text-on-primary hover:bg-primary-hover`,
  secondary: `${btnBase} h-11 px-5 border border-line-strong bg-surface text-ink hover:bg-subtle`,
  secondaryLg: `${btnBase} h-[52px] px-7 text-base border border-line-strong bg-transparent text-ink hover:bg-subtle`,
  ghost: `${btnBase} h-11 px-4 text-ink hover:bg-subtle`,
  /** 破壞性動作的第一顆按鈕：描邊＋圖示＋動詞（一定接 ConfirmAction） */
  danger: `${btnBase} h-11 px-5 border border-danger bg-transparent text-danger hover:bg-danger-soft`,
  /** 確認區塊裡的「確定…」 */
  dangerConfirm: `${btnBase} h-11 px-5 border border-danger bg-danger-soft text-danger`,
  /** 44×44 的圖示按鈕（記得加 aria-label 或 sr-only 文字） */
  icon: "inline-flex h-11 w-11 items-center justify-center rounded-btn text-ink hover:bg-subtle disabled:opacity-50",
} as const;

export const input =
  "h-11 w-full min-w-0 rounded-input border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-muted " +
  "outline-none focus-visible:ring-2 focus-visible:ring-focus aria-[invalid=true]:border-danger disabled:opacity-60";

export const textarea =
  "block w-full min-w-0 rounded-input border border-line-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-muted " +
  "outline-none focus-visible:ring-2 focus-visible:ring-focus aria-[invalid=true]:border-danger disabled:opacity-60";

export const card = "rounded-card border border-line bg-surface";
export const cardPad = "rounded-card border border-line bg-surface p-5 md:p-8";
/** 列表外框：裡面的每列用 row */
export const rows = "divide-y divide-line overflow-hidden rounded-card border border-line bg-surface";
export const row = "block min-h-11 px-4 py-3 hover:bg-subtle md:px-5 md:py-4";

/** 篩選標籤（44px）；選中時反白膠囊 */
export function chip(active: boolean): string {
  return `inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-btn border px-4 text-sm font-semibold ${
    active ? "border-ink bg-ink text-on-ink" : "border-line-strong bg-surface text-ink hover:bg-subtle"
  }`;
}

/** 頁面標題（serif） */
export const h1 = "font-serif text-[28px] font-bold leading-tight text-ink";
export const h2 = "text-lg font-bold text-ink";
/** 行內文字連結（加大點擊範圍） */
export const textLink = "inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4 hover:text-accent";
```

- [ ] **Step 5：`src/components/admin/styles.ts` 改成轉出同一份（後台既有 import 不用改）**

```ts
// 管理後台共用的 class：與全站共用元件同一份（src/components/ui/styles.ts）。
import { card, input } from "@/components/ui/styles";

export const inputClassName = input;
export const cardClassName = card;
export const emptyClassName = "mt-4 rounded-card border border-line bg-surface p-8 text-center text-sm text-muted";
```

- [ ] **Step 6：`src/components/forms/Field.tsx` 整個換成**

```tsx
"use client";
import { useId } from "react";
import { AlertCircle } from "lucide-react";
import { input } from "@/components/ui/styles";

export type ControlProps = { id: string; "aria-describedby"?: string; "aria-invalid"?: true };

/** 標籤用 htmlFor 對應控制項，提示與錯誤用 aria-describedby 連結（錯誤是一般文字，不是獨立的 alert）。規格 §9.5。 */
export function Field({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: (control: ControlProps) => React.ReactNode;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  const note = error ?? hint;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold text-ink">{label}</label>
      <div className="mt-1.5">
        {children({ id, "aria-describedby": note ? descId : undefined, "aria-invalid": error ? true : undefined })}
      </div>
      {note && (
        <span id={descId} className={`mt-1.5 flex items-start gap-1 text-xs ${error ? "text-danger" : "text-muted"}`}>
          {error && <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0" />}
          <span>{note}</span>
        </span>
      )}
    </div>
  );
}

/** 舊名稱：既有表單仍 import inputClass（Task 13 收尾前保留）。 */
export const inputClass = input;
```

- [ ] **Step 7：`src/components/ui/ThreadMark.tsx`（空狀態與 404 的小紅線）**

```tsx
/** 一小段 SVG 紅線。variant：loose（未打結，空狀態）／broken（斷開，找不到頁面）／tied（兩端打結）。純裝飾。 */
export function ThreadMark({ variant, className = "" }: { variant: "loose" | "broken" | "tied"; className?: string }) {
  return (
    <svg viewBox="0 0 160 48" aria-hidden="true" focusable="false" className={`h-12 w-40 ${className}`}>
      {variant === "broken" ? (
        <>
          <path d="M8 34 C 30 8, 52 8, 68 24" fill="none" stroke="var(--color-thread)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M92 26 C 108 40, 130 40, 152 14" fill="none" stroke="var(--color-thread)" strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : (
        <path d="M8 34 C 40 2, 72 46, 104 22 S 140 10, 152 18" fill="none" stroke="var(--color-thread)" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={variant === "loose" ? "0" : undefined} />
      )}
      <circle cx="8" cy="34" r="5" fill="var(--color-thread)" />
      {variant === "tied" && <circle cx="152" cy="18" r="5" fill="var(--color-thread)" />}
    </svg>
  );
}
```

- [ ] **Step 8：`src/components/ui/Notice.tsx`**

```tsx
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

type Tone = "info" | "success" | "warning" | "danger";

const TONE: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "border-line bg-subtle text-ink", Icon: Info },
  success: { box: "border-success bg-success-soft text-ink", Icon: CheckCircle2 },
  warning: { box: "border-primary bg-primary-soft text-ink", Icon: AlertTriangle },
  danger: { box: "border-danger bg-danger-soft text-ink", Icon: AlertCircle },
};

/** 頁內通知（規格 §9.10）：圖示＋文字，不只靠顏色。danger 用 role="alert"，其他 role="status"。 */
export function Notice({ tone, title, children, className = "" }: {
  tone: Tone; title?: string; children?: React.ReactNode; className?: string;
}) {
  const { box, Icon } = TONE[tone];
  const iconColor = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-accent" : "text-muted";
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex gap-3 rounded-input border p-4 text-sm ${box} ${className}`}>
      <Icon size={18} strokeWidth={1.5} aria-hidden="true" className={`mt-0.5 shrink-0 ${iconColor}`} />
      <div className="min-w-0 break-words">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={title ? "mt-1" : ""}>{children}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 9：`src/components/ui/SupportLink.tsx` 與 `ErrorText.tsx`**

```tsx
import Link from "next/link";
import { SUPPORT_EMAIL, SUPPORT_LINE_URL, SUPPORT_PAGE, supportMailto } from "@/lib/site";

/** 「聯絡我們」：信箱（mailto）＋（有設定時）LINE＋說明頁。subject 帶入信件主旨。 */
export function SupportLink({ subject, compact = false }: { subject?: string; compact?: boolean }) {
  const link = "inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4 hover:text-accent";
  if (compact) return <Link href={SUPPORT_PAGE} className={link}>聯絡我們</Link>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3">
      <a href={supportMailto(subject)} className={link}>寄信給 {SUPPORT_EMAIL}</a>
      {SUPPORT_LINE_URL && <a href={SUPPORT_LINE_URL} target="_blank" rel="noopener noreferrer" className={link}>LINE 客服</a>}
      <Link href={SUPPORT_PAGE} className={link}>常見問題</Link>
    </span>
  );
}
```

```tsx
// src/components/ui/ErrorText.tsx
import { AlertCircle } from "lucide-react";
import { mentionsSupport } from "@/lib/support";
import { SupportLink } from "./SupportLink";

/** Server Action 的錯誤：圖示＋文字；提到「聯絡平台／客服」時接上聯絡方式（QA M4）。 */
export function ErrorText({ message, subject }: { message: string | null | undefined; subject?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="text-sm text-danger">
      <p className="flex items-start gap-1.5">
        <AlertCircle size={16} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span className="min-w-0 break-words">{message}</span>
      </p>
      {mentionsSupport(message) && <div className="mt-1 pl-5 text-ink"><SupportLink subject={subject} /></div>}
    </div>
  );
}
```

- [ ] **Step 10：`EmptyState.tsx`、`Skeleton.tsx`、`PageHeader.tsx`、`SkipLink.tsx`**

```tsx
// src/components/ui/EmptyState.tsx
import Link from "next/link";
import { btn } from "./styles";
import { ThreadMark } from "./ThreadMark";

/** 空狀態（規格 §9.9）：一段沒打結的紅線、一句話、最多一個動作。 */
export function EmptyState({ text, action }: { text: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-line bg-surface px-6 py-10 text-center">
      <ThreadMark variant="loose" />
      <p className="max-w-sm text-sm text-muted">{text}</p>
      {action && <Link href={action.href} className={btn.primary}>{action.label}</Link>}
    </div>
  );
}
```

```tsx
// src/components/ui/Skeleton.tsx
/** 骨架（規格 §9.8）：尺寸由 className 給，與實際版面一致。 */
export function Skeleton({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-input bg-subtle ${className}`} />;
}

/** 列表頁的骨架：頁首＋n 列。 */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true">
      <p className="sr-only">載入中…</p>
      <Skeleton className="h-8 w-40" />
      <div className="mt-6 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-4 md:px-5">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// src/components/ui/PageHeader.tsx
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { h1 } from "./styles";

/** 頁首（規格 §9.2）：返回連結（44px）、h1（serif）、說明、最多一個主要動作。 */
export function PageHeader({ title, back, description, action }: {
  title: string; back?: { href: string; label: string }; description?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 md:mb-8">
      {back && (
        <Link href={back.href} className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-btn px-2 text-sm text-muted hover:text-ink">
          <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />{back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={`${h1} break-words`}>{title}</h1>
          {description && <div className="mt-2 max-w-2xl text-sm text-muted">{description}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
```

```tsx
// src/components/ui/SkipLink.tsx
/** 「跳到主要內容」（QA p4）：聚焦時才出現。目標是殼的 <main id="main" tabIndex={-1}>。 */
export function SkipLink() {
  return (
    <a href="#main" className="sr-only z-50 rounded-btn bg-surface px-4 py-3 font-bold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
      跳到主要內容
    </a>
  );
}
```

- [ ] **Step 11：`src/components/ui/FilePicker.tsx`（取代原生檔案欄位外觀，QA m10）**

```tsx
"use client";

import { useId } from "react";
import { Upload } from "lucide-react";

type Props = {
  /** 按鈕文字，例如「選擇圖片」 */
  label: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  /** 上傳中：按鈕文字變「上傳中…」 */
  busy?: boolean;
  /** 目前選好／已上傳的檔名；null 顯示「尚未選擇」 */
  fileName?: string | null;
  describedBy?: string;
  invalid?: boolean;
  /** 螢幕閱讀器用的完整名稱，例如「上傳頭像」 */
  ariaLabel: string;
  onFiles: (files: File[]) => void;
};

/**
 * 自訂外觀的檔案欄位：原生 input 用 sr-only 藏起來但仍可聚焦（鍵盤 Enter／空白鍵開檔案選擇），
 * label 看起來是次要按鈕；聚焦時 label 顯示焦點框。選完立刻清空 value，同一個檔案可以再選一次。
 */
export function FilePicker({ label, accept, multiple, disabled, busy, fileName, describedBy, invalid, ariaLabel, onFiles }: Props) {
  const id = useId();
  const off = disabled || busy;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <label
        htmlFor={id}
        className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-btn border border-line-strong bg-surface px-5 text-sm font-bold text-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus ${
          off ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-subtle"
        }`}
      >
        <Upload size={16} strokeWidth={1.5} aria-hidden="true" />
        {busy ? "上傳中…" : label}
        <input
          id={id} type="file" className="sr-only" accept={accept} multiple={multiple} disabled={off}
          aria-label={ariaLabel} aria-describedby={describedBy} aria-invalid={invalid ? true : undefined}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length > 0) onFiles(files);
          }}
        />
      </label>
      <span className="min-w-0 flex-1 truncate text-sm text-muted">{fileName ?? "尚未選擇"}</span>
    </div>
  );
}
```

- [ ] **Step 12：`src/components/briefs/ConfirmAction.tsx` 整個換成（確認規則，規格 §9.11）**

```tsx
"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, LogOut, Send, Trash2, Undo2, XCircle, type LucideIcon } from "lucide-react";
import { isStaleStateMessage } from "@/lib/briefs/errors";
import { btn } from "@/components/ui/styles";
import { ErrorText } from "@/components/ui/ErrorText";

type Result = { ok: true } | { ok: false; error?: string } | undefined;

export type ConfirmIcon = "trash" | "x" | "ban" | "leave" | "undo" | "check" | "send";
const ICONS: Record<ConfirmIcon, LucideIcon> = { trash: Trash2, x: XCircle, ban: Ban, leave: LogOut, undo: Undo2, check: CheckCircle2, send: Send };

type Props = {
  label: string;
  /** 確認區塊裡的說明：講清楚後果與能不能復原 */
  message: string;
  confirmLabel: string;
  /** 破壞性（描邊紅＋圖示）；不是破壞性但不可復原的（審核通過、接受邀約）用 primary 樣式 */
  danger?: boolean;
  /** 圖示；danger 沒給時用 x */
  icon?: ConfirmIcon;
  /** 第一顆按鈕在所有寬度都撐滿（預設：手機撐滿、桌面自動寬度） */
  block?: boolean;
  onConfirm: () => Promise<Result>;
};

/** 頁面內的確認區塊（不用 confirm()）：按鈕 → 展開說明與「確定／取消」。展開時焦點移到說明；Esc 收回並還原焦點。 */
export function ConfirmAction({ label, message, confirmLabel, danger, icon, block, onConfirm }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const regionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const Icon = ICONS[icon ?? (danger ? "x" : "check")];

  useEffect(() => {
    if (open) messageRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setError(null);
    // 下一幀按鈕才重新出現
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await onConfirm();
        if (res && !res.ok) {
          if (res.error && isStaleStateMessage(res.error)) {
            setOpen(false);
            setNotice("狀態已更新，已為你重新整理");
            router.refresh();
          } else {
            setError(res.error ?? "發生錯誤，請稍後再試");
          }
        } else {
          setOpen(false);
        }
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }

  const width = block ? "w-full" : "w-full sm:w-auto";
  if (!open) {
    return (
      <div className={width}>
        <button
          ref={triggerRef} type="button" aria-expanded={false} aria-controls={regionId}
          onClick={() => { setNotice(null); setOpen(true); }}
          className={`${danger ? btn.danger : btn.primary} ${width}`}
        >
          {danger && <Icon size={16} strokeWidth={1.5} aria-hidden="true" />}
          {label}
        </button>
        {notice && <p role="status" className="mt-2 text-sm text-muted">{notice}</p>}
      </div>
    );
  }
  return (
    <div
      id={regionId} role="group" aria-label={label}
      onKeyDown={(e) => { if (e.key === "Escape" && !pending) close(); }}
      className={`w-full rounded-card border p-4 ${danger ? "border-danger bg-danger-soft" : "border-line-strong bg-surface"}`}
    >
      <p ref={messageRef} tabIndex={-1} className="text-sm text-ink outline-none">{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={confirm} disabled={pending} className={danger ? btn.dangerConfirm : btn.primary}>
          <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
          {pending ? "處理中…" : confirmLabel}
        </button>
        <button type="button" onClick={close} disabled={pending} className={btn.secondary}>取消</button>
      </div>
      <div className="mt-2"><ErrorText message={error} /></div>
    </div>
  );
}
```

（舊的呼叫端都只傳 `label`、`message`、`confirmLabel`、`danger`、`onConfirm`，不用改就能編譯；各畫面 task 再補 `icon`。）

- [ ] **Step 13：`src/app/help/page.tsx`（公開、靜態）**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ThreadMark } from "@/components/ui/ThreadMark";
import { SupportLink } from "@/components/ui/SupportLink";
import { btn, h1 } from "@/components/ui/styles";
import { PAYMENT_MAX_TWD } from "@/lib/payments/limits";
import { formatTwd } from "@/lib/format";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "需要協助" };

const FAQ: { q: string; a: string }[] = [
  { q: "創作者帳號審核要多久？", a: "通常 1–2 個工作天。請先把驗證碼加到 IG 自我介紹，審核通過後就可以刪掉。" },
  { q: "帳號被暫停了怎麼辦？", a: "暫停期間不能報名、接案或傳訊息。請寄信給我們，附上你的網址代稱（@handle），我們會說明原因與後續。" },
  { q: `合作金額超過 ${formatTwd(PAYMENT_MAX_TWD)} 怎麼付款？`, a: "超過線上付款上限的合作案，請寄信給我們安排線下匯款；平台確認入帳後，合作案會自動進入交稿。" },
  { q: "品牌付款後，款項在哪裡？", a: "款項先由平台代管。創作者交稿、品牌審核通過、創作者發佈貼文後，平台才撥款給創作者。" },
  { q: "創作者多久會收到撥款？", a: "貼文連結送出後進入撥款處理。請先在「我的 → 收款帳戶」填好帳戶，沒有帳戶平台無法撥款。" },
];

export default function HelpPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-10 md:py-16">
      <Link href="/" className="inline-flex min-h-11 items-center font-bold text-ink">{SITE_NAME}</Link>
      <ThreadMark variant="tied" className="mt-6" />
      <h1 className={`${h1} mt-4`}>需要協助？</h1>
      <p className="mt-3 text-muted">寄信給我們，通常一個工作天內回覆。信裡附上你的帳號 Email 與相關的合作案名稱，會處理得比較快。</p>
      <div className="mt-4"><SupportLink /></div>
      <h2 className="mt-12 text-lg font-bold text-ink">常見問題</h2>
      <dl className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
        {FAQ.map((f) => (
          <div key={f.q} className="p-5">
            <dt className="font-bold text-ink">{f.q}</dt>
            <dd className="mt-2 text-sm text-muted">{f.a}</dd>
          </div>
        ))}
      </dl>
      <Link href="/" className={`${btn.secondary} mt-10`}>回首頁</Link>
    </main>
  );
}
```

（`SupportLink` 的常見問題連結指回本頁，無妨。）

- [ ] **Step 14：`src/app/not-found.tsx`（全站品牌化 404，QA m3）**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ThreadMark } from "@/components/ui/ThreadMark";
import { btn, h1 } from "@/components/ui/styles";

export const metadata: Metadata = { title: "找不到這一頁" };

/** 全站 404（規格 §9.14）。不讀 session（not-found 可能在任何層級渲染）；「回後台」交給首頁的「進入後台」。 */
export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <ThreadMark variant="broken" />
      <h1 className={`${h1} mt-6`}>這一頁不存在</h1>
      <p className="mt-3 text-sm text-muted">網址可能打錯了，或這個頁面已經移除。</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={btn.primary}>回首頁</Link>
        <Link href="/help" className={btn.secondary}>需要協助</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 15：README「上線前檢查」加一條（找到該清單，在最後加）**

```markdown
- [ ] `src/lib/site.ts` 的 `SUPPORT_EMAIL`（與 `SUPPORT_LINE_URL`）已改成真實客服聯絡方式（目前是 `support@example.com` 佔位；/help、停權橫幅、金額上限說明都會顯示它）。
```

- [ ] **Step 16：檢查與 Commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/components/ui src/lib/site.ts src/lib/site.test.ts src/lib/support.ts src/lib/support.test.ts \
  src/app/help/page.tsx src/app/not-found.tsx src/components/briefs/ConfirmAction.tsx src/components/forms/Field.tsx \
  src/components/admin/styles.ts src/lib/collabs/errors.ts src/lib/collabs/errors.test.ts README.md
git commit -m "UI 升級 Task 2：共用元件（按鈕、通知、空狀態、骨架、檔案欄位、確認）、客服入口 /help、品牌化 404"
```

（`errors.test.ts` 沒有變更時 git 會略過。）

---

### Task 3: 殼、導覽、每頁 `<title>`、已登入者的登入頁

**Files:**
- Modify: `src/components/shell/SideNav.tsx`、`BottomTabBar.tsx`、`SideFooter.tsx`、`SignOutButton.tsx`、`src/components/admin/AdminSideFooter.tsx`、`src/app/brand/layout.tsx`、`src/app/creator/layout.tsx`、`src/app/admin/(console)/layout.tsx`、`src/proxy.ts`、`src/lib/auth/routes.ts`、`src/lib/auth/routes.test.ts`（沒有就建立）、`src/lib/creators/metadata.ts`、`src/lib/creators/metadata.test.ts`、`src/app/brand/settings/page.tsx`、`src/app/creator/me/page.tsx`、下表所有 `page.tsx`
- Create: `src/components/shell/MobileTopBar.tsx`、`src/components/shell/HelpLink.tsx`

- [ ] **Step 1：測試先行 — `src/lib/auth/routes.test.ts` 加入（檔案已存在就加 describe）**

```ts
import { describe, expect, it } from "vitest";
import { authPageRedirect, requiresAuth } from "./routes";

describe("authPageRedirect（已登入者造訪登入／註冊頁，QA m4）", () => {
  const p = (s: string) => new URLSearchParams(s);
  it("/login、/signup 導去 /auth/continue，保留 next 與註冊身分", () => {
    expect(authPageRedirect("/login", p(""))).toBe("/auth/continue");
    expect(authPageRedirect("/login", p("next=/brand/collabs"))).toBe("/auth/continue?next=%2Fbrand%2Fcollabs");
    expect(authPageRedirect("/signup", p("role=creator&next=/c/abc"))).toBe("/auth/continue?role=creator&next=%2Fc%2Fabc");
  });
  it("不認得的身分不帶；/login 的 role 不帶", () => {
    expect(authPageRedirect("/signup", p("role=admin"))).toBe("/auth/continue");
    expect(authPageRedirect("/login", p("role=brand"))).toBe("/auth/continue");
  });
  it("網址有 error 時不導（避免與 /auth/continue 的錯誤導向循環）；其他路徑不導", () => {
    expect(authPageRedirect("/login", p("error=profile"))).toBeNull();
    expect(authPageRedirect("/brand", p(""))).toBeNull();
    expect(authPageRedirect("/login/x", p(""))).toBeNull();
  });
  it("requiresAuth 不變", () => {
    expect(requiresAuth("/brand")).toBe(true);
    expect(requiresAuth("/login")).toBe(false);
  });
});
```

- [ ] **Step 2：`src/lib/auth/routes.ts` 加上**

```ts
const AUTH_PAGES = new Set(["/login", "/signup"]);

/**
 * proxy 用：已登入者造訪 /login、/signup 時要導去哪裡（null = 不導）。由 /auth/continue 依身分決定去向（next 在那裡清理）。
 * 網址帶 error 時不導：/auth/continue 讀身分失敗會回 /login?error=profile，再導回去會無限循環。
 */
export function authPageRedirect(pathname: string, params: URLSearchParams): string | null {
  if (!AUTH_PAGES.has(pathname) || params.has("error")) return null;
  const q = new URLSearchParams();
  const role = params.get("role");
  if (pathname === "/signup" && (role === "brand" || role === "creator")) q.set("role", role);
  const next = params.get("next");
  if (next) q.set("next", next);
  const s = q.toString();
  return s ? `/auth/continue?${s}` : "/auth/continue";
}
```

- [ ] **Step 3：`src/proxy.ts` 整個換成**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { authPageRedirect, requiresAuth } from "@/lib/auth/routes";
import { REQUEST_PATH_HEADER, requestPath } from "@/lib/auth/admin-next";

// 只做樂觀檢查：更新 session cookie、沒登入就導去 /login、已登入者不看登入頁。身分與資料完整度由各區 layout 檢查。
export async function proxy(request: NextRequest) {
  // requireAdmin() 用這個標頭決定管理員通過第二步驟後回哪一頁（一律覆寫用戶端帶的值）
  const { response, user } = await updateSession(request, { [REQUEST_PATH_HEADER]: requestPath(request.nextUrl) });

  /** 導向時帶上新的 session cookie 與 Cache-Control 等標頭（避免帶 session cookie 的導向被 CDN 快取）。 */
  function redirectTo(url: URL) {
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    response.headers.forEach((v, k) => {
      const key = k.toLowerCase();
      if (key === "cache-control" || key === "expires" || key === "pragma") redirect.headers.set(k, v);
    });
    return redirect;
  }

  if (!user && requiresAuth(request.nextUrl.pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return redirectTo(login);
  }
  if (user) {
    const to = authPageRedirect(request.nextUrl.pathname, request.nextUrl.searchParams);
    if (to) return redirectTo(new URL(to, request.url));
  }
  return response;
}

export const config = {
  matcher: [
    // 排除靜態檔、圖片、綠界（notify、payment-info 是伺服器對伺服器；result 只是把瀏覽器導回合作案詳情，
    // 導過去的頁面會再經過 proxy）與 Vercel Cron（不會帶 cookie，也不需要 session）
    "/((?!_next/static|_next/image|favicon.ico|api/payments/ecpay/|api/cron/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
```

- [ ] **Step 4：`src/lib/creators/metadata.ts` 的 title 改成 absolute（根 layout 有 template，避免「…｜Kollink｜Kollink」）**

```ts
  if (!c) return { title: { absolute: `找不到這個頁面｜${SITE_NAME}` }, robots: NOINDEX };
  const title = `${c.displayName}（@${c.handle}）｜${SITE_NAME}`;
  ...
  const base: Metadata = { title: { absolute: title }, description, openGraph: { title, description, type: "profile" } };
```

`metadata.test.ts` 裡比對 `title` 的斷言改成比對 `title: { absolute: "…" }`（字串內容不變）。

- [ ] **Step 5：每頁 `<title>`（QA m2）**。下表每個檔案在 import 區加 `import type { Metadata } from "next";`，並在 default export 之前加 `export const metadata: Metadata = { title: "…" };`：

| 檔案 | title |
|---|---|
| `src/app/page.tsx` | `{ absolute: \`${SITE_NAME}｜${SITE_TAGLINE}\` }`（Task 4 重寫時保留） |
| `src/app/login/page.tsx` | `"登入"` |
| `src/app/signup/page.tsx` | `"註冊"` |
| `src/app/onboarding/page.tsx` | `"選擇身分"` |
| `src/app/onboarding/brand/page.tsx` | `"建立品牌資料"` |
| `src/app/onboarding/creator/page.tsx` | `"建立創作者資料"` |
| `src/app/brand/page.tsx` | `"創作者廣場"` |
| `src/app/brand/briefs/page.tsx` | `"我的招募"` |
| `src/app/brand/briefs/new/page.tsx` | `"刊登招募"` |
| `src/app/brand/briefs/[id]/page.tsx` | `"招募詳情"` |
| `src/app/brand/briefs/[id]/edit/page.tsx` | `"編輯招募"` |
| `src/app/brand/collabs/page.tsx` | `"合作案"` |
| `src/app/brand/collabs/[id]/page.tsx` | `"合作案詳情"` |
| `src/app/brand/messages/page.tsx` | `"訊息"` |
| `src/app/brand/messages/[id]/page.tsx` | `"對話"` |
| `src/app/brand/settings/page.tsx` | `"品牌設定"` |
| `src/app/creator/page.tsx` | `"機會"` |
| `src/app/creator/briefs/[id]/page.tsx` | `"招募詳情"` |
| `src/app/creator/collabs/page.tsx` | `"我的合作"` |
| `src/app/creator/collabs/[id]/page.tsx` | `"合作案詳情"` |
| `src/app/creator/me/page.tsx` | `"我的"` |
| `src/app/creator/me/payout/page.tsx` | `"收款帳戶"` |
| `src/app/creator/me/profile/page.tsx` | `"公開頁"` |
| `src/app/creator/messages/page.tsx` | `"訊息"` |
| `src/app/creator/messages/[id]/page.tsx` | `"對話"` |
| `src/app/admin/(console)/page.tsx` | `"後台總覽"` |
| `src/app/admin/(console)/creators/page.tsx` | `"創作者審核"` |
| `src/app/admin/(console)/collabs/page.tsx` | `"合作案（後台）"` |
| `src/app/admin/(console)/collabs/[id]/page.tsx` | `"合作案詳情（後台）"` |
| `src/app/admin/(console)/payments/page.tsx` | `"款項"` |
| `src/app/admin/(console)/messages/page.tsx` | `"違規訊息"` |
| `src/app/admin/mfa/page.tsx` | `"管理員驗證"` |

（`/c/[handle]` 用 `generateMetadata`，Step 4 已處理；`/help`、`not-found` 在 Task 2 已有。）

- [ ] **Step 6：`src/components/shell/SignOutButton.tsx`（44px，QA m7）**

```tsx
import { LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button className="inline-flex min-h-11 items-center gap-1.5 rounded-btn px-3 text-sm text-muted hover:bg-subtle hover:text-ink">
        <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />登出
      </button>
    </form>
  );
}
```

- [ ] **Step 7：`src/components/shell/HelpLink.tsx`**

```tsx
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { SUPPORT_PAGE } from "@/lib/site";

/** 側欄／帳號頁的「需要協助」（QA M4）。 */
export function HelpLink({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href={SUPPORT_PAGE}
      className={compact
        ? "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-nav px-2 text-[11px] text-muted hover:bg-subtle hover:text-ink"
        : "inline-flex min-h-11 items-center gap-1.5 rounded-btn px-3 text-sm text-muted hover:bg-subtle hover:text-ink"}
    >
      <LifeBuoy size={compact ? 18 : 16} strokeWidth={1.5} aria-hidden="true" />
      {compact ? "協助" : "需要協助"}
    </Link>
  );
}
```

- [ ] **Step 8：`src/components/shell/SideNav.tsx` 整個換成**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAME } from "@/lib/site";
import { NavIcon } from "./NavIcon";
import { UnreadBadge } from "./UnreadBadge";
import { isActive, type NavItem } from "./nav";

// 選中：subtle 底＋左側 3px 紅線（規格 §9.1；反白膠囊在深色下太亮）
const itemBase = "relative flex min-h-[60px] w-[72px] flex-col items-center justify-center gap-1 rounded-nav px-1 text-center text-[11px] leading-tight";
const activeCls = "bg-subtle font-bold text-ink before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-full before:bg-thread";

export function SideNav({ items, footer }: { items: NavItem[]; footer?: React.ReactNode }) {
  const pathname = usePathname();
  const home = items.find((i) => i.href)?.href ?? "/";
  return (
    <nav aria-label="主選單" className="sticky top-0 flex h-screen w-[88px] flex-col items-center border-r border-line bg-panel py-5">
      <Link href={home} className="mb-6 flex h-11 items-center gap-1.5 rounded-btn px-2 text-lg font-extrabold tracking-tight text-ink">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />K<span className="sr-only">{SITE_NAME}</span>
      </Link>
      <ul className="flex flex-1 flex-col items-center gap-1.5 overflow-y-auto">
        {items.map((it) => {
          const active = it.href !== null && isActive(it.href, pathname);
          return (
            <li key={it.label}>
              {it.href ? (
                <Link
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={`${itemBase} ${active ? activeCls : "text-muted hover:bg-subtle hover:text-ink"}`}
                >
                  <span className="relative inline-flex">
                    <NavIcon name={it.icon} size={22} />
                    {it.badge === "messages" && <UnreadBadge />}
                  </span>
                  <span>{it.label}</span>
                </Link>
              ) : (
                <span className={`${itemBase} text-muted opacity-50`}>
                  <NavIcon name={it.icon} size={22} />
                  <span>{it.label}</span>
                  <span className="sr-only">（即將推出）</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {footer}
    </nav>
  );
}
```

- [ ] **Step 9：`src/components/shell/BottomTabBar.tsx` 整個換成（只放可用項目，QA p12）**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "./NavIcon";
import { UnreadBadge } from "./UnreadBadge";
import { isActive, type NavItem } from "./nav";

export function BottomTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="主選單"
      className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-surface px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] text-[11px] md:hidden"
    >
      {items.filter((it) => it.href).map((it) => {
        const href = it.href as string;
        const active = isActive(href, pathname);
        return (
          <Link
            key={it.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-14 min-w-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 ${
              active ? "font-bold text-ink before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:rounded-full before:bg-thread" : "text-muted"
            }`}
          >
            <span className="relative inline-flex">
              <NavIcon name={it.icon} size={22} />
              {it.badge === "messages" && <UnreadBadge />}
            </span>
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

（各 layout 原本對 `BRAND_NAV` 先 `filter((i) => i.href)` 的寫法可以留著，結果相同。）

- [ ] **Step 10：`SideFooter.tsx` 與 `AdminSideFooter.tsx`**

```tsx
// src/components/shell/SideFooter.tsx
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ThemeSelect } from "@/components/theme/ThemeSelect";
import { HelpLink } from "./HelpLink";
import { SignOutButton } from "./SignOutButton";

/** 側邊欄底部：頭像、角色、主題、協助、登出。會讀 session，所以頭像放在 <Suspense> 內。 */
export function SideFooter() {
  return (
    <div className="flex w-full flex-col items-center gap-2 border-t border-line pt-3">
      <Suspense fallback={<div aria-hidden="true" className="h-10 w-10 rounded-full bg-subtle" />}>
        <Who />
      </Suspense>
      <ThemeSelect compact />
      <HelpLink compact />
      <SignOutButton />
    </div>
  );
}

async function Who() {
  const me = await getCurrentUser();
  const name = me?.brand?.brandName ?? me?.profile?.displayName ?? "";
  const role = me?.profile?.role === "brand" ? "品牌" : "創作者";
  return (
    <div className="flex flex-col items-center gap-1">
      <div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full border border-thread bg-subtle text-base font-bold text-ink">
        {name.slice(0, 1)}
      </div>
      <span className="text-[11px] text-muted">{role}</span>
    </div>
  );
}
```

```tsx
// src/components/admin/AdminSideFooter.tsx
import { ThemeSelect } from "@/components/theme/ThemeSelect";
import { SignOutButton } from "@/components/shell/SignOutButton";

/** 管理後台側邊欄底部：身分標籤、主題、登出（不讀 session，管理員不一定有 profile）。 */
export function AdminSideFooter() {
  return (
    <div className="flex w-full flex-col items-center gap-2 border-t border-line pt-3">
      <span className="text-[11px] font-bold text-muted">管理員</span>
      <ThemeSelect compact />
      <SignOutButton />
    </div>
  );
}
```

- [ ] **Step 11：`src/components/shell/MobileTopBar.tsx`（手機頂列：區名＋帳號入口，登出移到帳號頁，QA m7）**

```tsx
import Link from "next/link";
import { UserRound } from "lucide-react";
import { btn } from "@/components/ui/styles";

/** 手機版頂列（md 以上隱藏）。accountHref 為 null 時右側放 children（管理員：主題＋登出）。 */
export function MobileTopBar({ title, accountHref, children }: { title: string; accountHref: string | null; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 md:hidden">
      <p className="min-w-0 truncate font-bold text-ink">{title}</p>
      {accountHref ? (
        <Link href={accountHref} className={btn.icon}>
          <UserRound size={22} strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">帳號與設定</span>
        </Link>
      ) : (
        <div className="flex shrink-0 items-center gap-1">{children}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 12：三個 layout 的外框（以品牌為例；創作者、管理員同樣結構）**

`src/app/brand/layout.tsx`：

```tsx
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { SideFooter } from "@/components/shell/SideFooter";
import { SideNav } from "@/components/shell/SideNav";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { MobileTopBar } from "@/components/shell/MobileTopBar";
import { BRAND_NAV } from "@/components/shell/nav";
import { SkipLink } from "@/components/ui/SkipLink";
import { ListSkeleton } from "@/components/ui/Skeleton";

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <SkipLink />
      <aside className="hidden shrink-0 md:block">
        <Suspense fallback={<div aria-hidden className="h-screen w-[88px] bg-panel" />}><SideNav items={BRAND_NAV} footer={<SideFooter />} /></Suspense>
      </aside>
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 outline-none md:px-10 md:pb-12 md:pt-10">
        <div className="mx-auto max-w-[1120px]">
          <Suspense fallback={<ListSkeleton />}>
            <Gate>{children}</Gate>
          </Suspense>
        </div>
      </main>
      <Suspense fallback={null}><BottomTabBar items={BRAND_NAV} /></Suspense>
    </div>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const me = await requireRole("brand");
  return (
    <>
      <MobileTopBar title={me.brand?.brandName ?? "品牌"} accountHref="/brand/settings" />
      {children}
    </>
  );
}
```

`src/app/creator/layout.tsx`：同樣結構，`CREATOR_NAV`；Gate：

```tsx
async function Gate({ children }: { children: React.ReactNode }) {
  const me = await requireRole("creator");
  return (
    <>
      <MobileTopBar title={me.profile?.displayName ?? "創作者"} accountHref="/creator/me" />
      <StatusBanner me={me} />
      {children}
    </>
  );
}
```

`src/app/admin/(console)/layout.tsx`：同樣結構，`ADMIN_NAV`、`footer={<AdminSideFooter />}`；Gate：

```tsx
async function Gate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <MobileTopBar title="管理後台" accountHref={null}>
        <ThemeSelect compact />
        <SignOutButton />
      </MobileTopBar>
      {children}
    </>
  );
}
```

（`ThemeSelect` 的 compact 版在手機頂列字級 14px：管理員頁面在手機上很少用，且 select 不是文字輸入，iOS 不會放大；可接受。）

- [ ] **Step 13：帳號頁放主題與登出**

`src/app/brand/settings/page.tsx`：在既有內容最後（Suspense 外）加：

```tsx
      <section aria-labelledby="account-title" className="mt-10 max-w-xl space-y-3 border-t border-line pt-6">
        <h2 id="account-title" className="text-lg font-bold text-ink">外觀與帳號</h2>
        <ThemeSelect />
        <div className="flex flex-wrap gap-2"><HelpLink /><SignOutButton /></div>
      </section>
```

`src/app/creator/me/page.tsx`：頂部的 `<div className="md:hidden"><SignOutButton /></div>` 刪掉，頁尾加同一段（Task 9 重寫這一頁時保留這一段）。

- [ ] **Step 14：檢查與 Commit**

```bash
npm run lint && npm run typecheck && npm test
grep -rL "export const metadata\|generateMetadata" $(find src/app -name page.tsx)   # 預期沒有輸出
git add src/components/shell src/components/admin/AdminSideFooter.tsx src/app/brand/layout.tsx src/app/creator/layout.tsx \
  "src/app/admin/(console)/layout.tsx" src/proxy.ts src/lib/auth/routes.ts src/lib/auth/routes.test.ts \
  src/lib/creators/metadata.ts src/lib/creators/metadata.test.ts $(find src/app -name page.tsx)
git commit -m "UI 升級 Task 3：側欄與底部導覽改版、手機頂列、每頁 title、已登入者不再看到登入頁"
```

---

### Task 4: 首頁內容與 SVG 紅線（尚無 3D）

**Files:**
- Modify: `src/app/page.tsx`（整個重寫）、`src/app/globals.css`（加捲動紅線）
- Create: `src/components/landing/TopBar.tsx`、`Hero.tsx`、`HowItWorks.tsx`、`ForBoth.tsx`、`Trust.tsx`、`LandingFooter.tsx`、`src/components/shell/AccountLink.tsx`、`src/components/thread/ThreadFallback.tsx`

- [ ] **Step 1：`src/components/thread/ThreadFallback.tsx`（與 3D 同構圖的靜態 SVG；3D 前、reduced-motion、沒有 WebGL 時顯示）**

```tsx
import type { ThreadVariant } from "./types";

type Shape = { viewBox: string; path: string; a: [number, number]; b: [number, number]; far: string[] };

// 構圖取自原型截圖（scratchpad ui-plan/shots/），與 thread-scene.ts 的錨點一致
const SHAPES: Record<"heroWide" | "heroTall" | "quietWide" | "quietBand" | "ribbon", Shape> = {
  heroWide: {
    viewBox: "0 0 1280 900", path: "M180 232 C 360 420, 600 520, 790 502 S 1040 430, 1118 365", a: [180, 232], b: [1118, 365],
    far: ["M0 104 C 400 150, 900 120, 1280 62", "M0 250 C 300 380, 700 260, 1280 110", "M0 470 C 500 520, 900 600, 1280 590", "M0 690 C 400 640, 900 780, 1280 760"],
  },
  heroTall: {
    viewBox: "0 0 390 844", path: "M40 160 C 100 300, 170 400, 232 396 S 318 360, 338 340", a: [40, 160], b: [338, 340],
    far: ["M0 124 C 150 118, 260 112, 390 108", "M0 306 C 140 250, 260 190, 390 140"],
  },
  quietWide: {
    viewBox: "0 0 704 900", path: "M145 163 C 200 360, 330 640, 540 647 S 600 636, 620 632", a: [145, 163], b: [620, 632],
    far: ["M0 129 C 300 135, 500 110, 704 92", "M0 336 C 250 330, 500 200, 704 96", "M0 713 C 200 740, 400 820, 704 890"],
  },
  quietBand: { viewBox: "0 0 390 160", path: "M24 40 C 120 150, 260 150, 366 60", a: [24, 40], b: [366, 60], far: [] },
  ribbon: { viewBox: "0 0 1200 96", path: "M0 60 C 300 20, 500 90, 700 48 S 1000 30, 1200 56", a: [-20, 60], b: [1220, 56], far: [] },
};

function Svg({ s, className }: { s: Shape; className: string }) {
  return (
    <svg viewBox={s.viewBox} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className={className}>
      {s.far.map((d) => <path key={d} d={d} fill="none" stroke="var(--color-far)" strokeWidth="1" />)}
      <path d={s.path} fill="none" stroke="var(--color-thread-glow)" strokeOpacity="0.25" strokeWidth="9" strokeLinecap="round" />
      <path d={s.path} fill="none" stroke="var(--color-thread)" strokeWidth="3" strokeLinecap="round" />
      {[s.a, s.b].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="14" fill="var(--color-thread-glow)" fillOpacity="0.18" />
          <circle cx={x} cy={y} r="7" fill="none" stroke="var(--color-thread)" strokeWidth="3" />
        </g>
      ))}
    </svg>
  );
}

/** 靜態紅線。hero／quiet 依寬窄各一張（CSS 切換，不用 JS）。 */
export function ThreadFallback({ variant }: { variant: ThreadVariant }) {
  const abs = "absolute inset-0 h-full w-full";
  if (variant === "hero") {
    return (
      <>
        <Svg s={SHAPES.heroTall} className={`${abs} md:hidden`} />
        <Svg s={SHAPES.heroWide} className={`${abs} hidden md:block`} />
      </>
    );
  }
  if (variant === "quiet") {
    return (
      <>
        <Svg s={SHAPES.quietBand} className={`${abs} md:hidden`} />
        <Svg s={SHAPES.quietWide} className={`${abs} hidden md:block`} />
      </>
    );
  }
  return <Svg s={SHAPES.ribbon} className={abs} />;
}
```

以及 `src/components/thread/types.ts`（讓 SVG 後備不必 import 含 three 的模組）：

```ts
export type ThreadVariant = "hero" | "quiet" | "ribbon";
```

（Task 5 的 `thread-scene.ts` 也定義同名型別；`ThreadCanvas` 只從 `types.ts` import 型別。）

- [ ] **Step 2：`src/components/shell/AccountLink.tsx`（首頁與公開頁頂列：登入／進入後台）**

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser, getIsAdminAccount } from "@/lib/auth/current-user";
import { homeFor } from "@/lib/auth/post-login";

const cls = "inline-flex h-11 items-center rounded-btn border border-line-strong px-5 text-sm font-bold text-ink hover:bg-subtle";

/** 會讀 session：自己帶 <Suspense>；fallback 是同尺寸的「登入」，不跳動。（QA m4：首頁辨識登入狀態） */
export function AccountLink() {
  return (
    <Suspense fallback={<Link href="/login" className={cls}>登入</Link>}>
      <Resolved />
    </Suspense>
  );
}

async function Resolved() {
  const me = await getCurrentUser();
  if (!me) return <Link href="/login" className={cls}>登入</Link>;
  if (me.profile) return <Link href={homeFor(me.profile.role)} className={cls}>進入後台</Link>;
  const href = (await getIsAdminAccount()) ? "/admin" : "/onboarding";
  return <Link href={href} className={cls}>進入後台</Link>;
}
```

`src/app/c/layout.tsx` 的 `TopBarLink` 換成 `<AccountLink />`（刪掉該檔的 `TopBarLink` 與相關 import）。

- [ ] **Step 3：`src/components/landing/TopBar.tsx`**

```tsx
import Link from "next/link";
import { AccountLink } from "@/components/shell/AccountLink";
import { SITE_NAME } from "@/lib/site";

export function TopBar() {
  return (
    <header className="absolute inset-x-0 top-0 z-10">
      <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-5 md:px-16">
        <Link href="/" className="flex h-11 items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />{SITE_NAME}
        </Link>
        <AccountLink />
      </div>
    </header>
  );
}
```

- [ ] **Step 4：`src/components/landing/Hero.tsx`（`canvas` 位置先放 SVG；Task 5 換成 `ThreadCanvas`）**

```tsx
import Link from "next/link";
import { ThreadFallback } from "@/components/thread/ThreadFallback";
import { btn } from "@/components/ui/styles";
import { HERO_HEADLINE } from "@/lib/site";

/** 主視覺（規格 §5.1）：文字是伺服器渲染的 HTML（LCP 是大標），紅線在背景。 */
export function Hero({ scene }: { scene?: React.ReactNode }) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate flex min-h-[max(100svh,640px)] items-end overflow-hidden">
      <div className="absolute inset-0 -z-10">{scene ?? <ThreadFallback variant="hero" />}</div>
      <div className="mx-auto w-full max-w-[1280px] px-5 pb-10 md:px-16 md:pb-24">
        <div className="max-w-[640px]">
          <h1 id="hero-title" className="font-serif text-[40px] font-black leading-[1.15] text-ink md:text-[56px] xl:text-[72px]">
            {HERO_HEADLINE}
          </h1>
          <p className="mt-5 max-w-[520px] text-base text-muted md:text-lg">
            Kollink 是台灣品牌與 IG 創作者的合作平台。找人、談條件、付款、交稿到撥款，每一步都在同一條線上。
          </p>
          <EntryButtons className="mt-8" />
          <p className="mt-4 text-sm text-muted">
            已經有帳號？<Link href="/login" className="inline-flex min-h-11 items-center font-bold text-ink underline underline-offset-4">登入</Link>
          </p>
        </div>
      </div>
    </section>
  );
}

/** 兩個入口就是紅線的兩端：data-thread-pull 讓 3D 線往那一端收緊。 */
export function EntryButtons({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:flex ${className}`}>
      <Link href="/signup?role=brand" data-thread-pull="brand" className={btn.primaryLg}>我是品牌</Link>
      <Link href="/signup?role=creator" data-thread-pull="creator" className={btn.secondaryLg}>我是創作者</Link>
    </div>
  );
}
```

- [ ] **Step 5：`src/components/landing/HowItWorks.tsx`**

```tsx
const STEPS = [
  { title: "媒合", body: "品牌在創作者廣場找人直接邀請，或刊登招募讓創作者報名。條件寫清楚：交付內容、金額、期限。" },
  { title: "確認並付款", body: "創作者接受條件後，品牌付款。款項先由平台代管，不會直接進到任何一方。" },
  { title: "交稿審核", body: "創作者在平台上交稿，品牌審核：通過，或寫下要修改的地方。品牌逾期沒有審核，系統會自動通過。" },
  { title: "發佈撥款", body: "創作者發佈貼文並貼上連結，平台確認後把款項撥給創作者。" },
];

function Knot() {
  return (
    <span aria-hidden="true" className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-thread bg-bg">
      <span className="h-2 w-2 rounded-full bg-thread" />
    </span>
  );
}

/** 怎麼運作（規格 §5.3）：一條隨捲動畫出來的紅線串起四個結。只有 CSS（globals.css 的 .thread-draw）。 */
export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="mx-auto max-w-[1280px] px-5 py-20 md:px-16 md:py-28">
      <h2 id="how-title" className="font-serif text-[28px] font-bold text-ink md:text-[40px]">從牽線到撥款，四個結</h2>
      <div className="relative mt-10 md:mt-14">
        {/* 手機：垂直的線 */}
        <svg aria-hidden="true" viewBox="0 0 24 100" preserveAspectRatio="none" className="absolute left-0 top-3 h-[calc(100%-24px)] w-6 lg:hidden">
          <path d="M12 0 C 4 25, 20 50, 12 75 S 12 100, 12 100" pathLength={1} vectorEffect="non-scaling-stroke"
            fill="none" stroke="var(--color-thread)" strokeWidth="2" className="thread-draw" />
        </svg>
        {/* 桌面：水平波浪，在 12.5%／37.5%／62.5%／87.5% 經過 y=12（四個結的位置） */}
        <svg aria-hidden="true" viewBox="0 0 100 24" preserveAspectRatio="none" className="absolute inset-x-0 top-0 hidden h-6 w-full lg:block">
          <path d="M0 12 Q6.25 2 12.5 12 T25 12 T37.5 12 T50 12 T62.5 12 T75 12 T87.5 12 T100 12" pathLength={1} vectorEffect="non-scaling-stroke"
            fill="none" stroke="var(--color-thread)" strokeWidth="2" className="thread-draw" />
        </svg>
        <ol className="space-y-10 lg:grid lg:grid-cols-4 lg:gap-8 lg:space-y-0">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-5 lg:flex-col lg:items-center lg:text-center">
              <Knot />
              <div className="min-w-0">
                <p className="text-sm text-muted"><span className="sr-only">第 </span>{i + 1}<span className="sr-only"> 步</span></p>
                <h3 className="mt-1 text-xl font-bold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm text-muted lg:mx-auto lg:max-w-[240px]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

`globals.css` 最後加：

```css
/* 首頁「怎麼運作」的捲動紅線（規格 §5.3）：支援 scroll-driven animation 且沒有 reduced motion 時才動，否則直接畫滿 */
@keyframes thread-draw {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .thread-draw {
      stroke-dasharray: 1;
      animation: thread-draw linear both;
      animation-timeline: view();
      animation-range: entry 10% cover 60%;
    }
  }
}
```

- [ ] **Step 6：`src/components/landing/ForBoth.tsx`**

```tsx
const BRAND = [
  "每位創作者都經過人工審核，才會出現在廣場。",
  "看得到粉絲數、互動率、作品與報價，用類別與地區篩選。",
  "一個招募收齊報名，錄取、婉拒都在同一頁。",
  "合作進度一條線看到底，現在輪到誰一眼就知道。",
];
const CREATOR = [
  "一個公開頁放作品與報價，報價只給品牌看。",
  "品牌找上門，或自己報名有興趣的招募。",
  "品牌付款後才開始工作；交稿通過、發佈後撥款。",
  "撥款全額轉到你的帳戶，平台不收手續費。",
];

function Column({ id, title, items }: { id: string; title: string; items: string[] }) {
  return (
    <div className="min-w-0">
      <h3 id={id} className="font-serif text-2xl font-bold text-ink">{title}</h3>
      <ul aria-labelledby={id} className="mt-4 divide-y divide-line border-y border-line">
        {items.map((t) => <li key={t} className="py-4 text-base text-ink">{t}</li>)}
      </ul>
    </div>
  );
}

export function ForBoth() {
  return (
    <section aria-label="品牌與創作者各得到什麼" className="mx-auto max-w-[1280px] px-5 pb-20 md:px-16 md:pb-28">
      <div className="grid gap-12 lg:grid-cols-[1fr_1px_1fr] lg:gap-16">
        <Column id="for-brand" title="給品牌" items={BRAND} />
        <div aria-hidden="true" className="hidden bg-thread opacity-60 lg:block" />
        <Column id="for-creator" title="給創作者" items={CREATOR} />
      </div>
    </section>
  );
}
```

- [ ] **Step 7：`src/components/landing/Trust.tsx`**

```tsx
import { paymentAvailability } from "@/lib/payments/config";

/** 安心的設計（規格 §5.2）：只寫系統真的做到的事。線上付款沒開時多一行說明（建置時讀環境變數）。 */
export function Trust() {
  const online = paymentAvailability().enabled;
  const items: { title: string; body: string; note?: string }[] = [
    { title: "款項代管", body: "品牌的付款先留在平台，創作者完成交稿與發佈後才撥出。", note: online ? undefined : "線上付款開放前，款項由平台人工確認。" },
    { title: "真人審核", body: "創作者要在 IG 自我介紹放上驗證碼，平台人工確認是本人帳號。" },
    { title: "訊息留在平台", body: "討論訊息與交稿檔案都留在平台上；要分享電話或 LINE 前，系統會先提醒你。" },
    { title: "有人可以問", body: "遇到問題，從頁尾的「需要協助？」聯絡我們。" },
  ];
  return (
    <section aria-labelledby="trust-title" className="border-y border-line bg-panel">
      <div className="mx-auto max-w-[1280px] px-5 py-20 md:px-16 md:py-24">
        <h2 id="trust-title" className="font-serif text-[28px] font-bold text-ink md:text-[40px]">我們怎麼保護每一次合作</h2>
        <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
          {items.map((it) => (
            <div key={it.title} className="border-l-2 border-thread pl-5">
              <dt className="text-lg font-bold text-ink">{it.title}</dt>
              <dd className="mt-1 text-sm text-muted">
                {it.body}
                {it.note && <span className="mt-1 block">{it.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
```

（`config.ts` 有 `import "server-only"`，Trust 是伺服器元件，可以 import。）

- [ ] **Step 8：`src/components/landing/LandingFooter.tsx`**

```tsx
import Link from "next/link";
import { ThemeSelect } from "@/components/theme/ThemeSelect";
import { SITE_NAME, SITE_TAGLINE, SUPPORT_PAGE } from "@/lib/site";
import { EntryButtons } from "./Hero";

export function LandingFooter() {
  const link = "inline-flex min-h-11 items-center text-sm text-muted hover:text-ink";
  return (
    <>
      <section aria-labelledby="closing-title" className="mx-auto max-w-[1280px] px-5 py-20 md:px-16 md:py-28">
        <h2 id="closing-title" className="font-serif text-[28px] font-bold text-ink md:text-[40px]">下一條線，可能就是你的。</h2>
        <EntryButtons className="mt-8 max-w-md" />
      </section>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-16">
          <p className="text-sm text-muted">
            <span className="font-extrabold text-ink">{SITE_NAME}</span>・{SITE_TAGLINE}
          </p>
          <nav aria-label="頁尾" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href={SUPPORT_PAGE} className={link}>需要協助？</Link>
            <Link href="/login" className={link}>登入</Link>
            <Link href="/signup" className={link}>註冊</Link>
            <ThemeSelect />
          </nav>
        </div>
      </footer>
    </>
  );
}
```

- [ ] **Step 9：`src/app/page.tsx` 整個換成**

```tsx
import type { Metadata } from "next";
import { ForBoth } from "@/components/landing/ForBoth";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { TopBar } from "@/components/landing/TopBar";
import { Trust } from "@/components/landing/Trust";
import { SkipLink } from "@/components/ui/SkipLink";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const metadata: Metadata = { title: { absolute: `${SITE_NAME}｜${SITE_TAGLINE}` } };

export default function Home() {
  return (
    <>
      <SkipLink />
      <TopBar />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <HowItWorks />
        <ForBoth />
        <Trust />
      </main>
      <LandingFooter />
    </>
  );
}
```

- [ ] **Step 10：檢查、建置、截圖、Commit**

```bash
npm run lint && npm run typecheck && npm test
npm run build && (npm run start > /tmp/kollink-start.log 2>&1 &) && sleep 6
# 截圖腳本（scratchpad）：/ 在 390x844、1280x900 × dark、light，整頁截圖；另外捲到 #how 截一張
# 檢查：無水平捲軸（document.documentElement.scrollWidth <= innerWidth）、h1 是大標、Tab 第一下是「跳到主要內容」
kill $(lsof -ti :3000)
git add src/app/page.tsx src/app/globals.css src/app/c/layout.tsx src/components/landing src/components/shell/AccountLink.tsx \
  src/components/thread/ThreadFallback.tsx src/components/thread/types.ts
git commit -m "UI 升級 Task 4：首頁改版（大標、兩個入口、怎麼運作的捲動紅線、給品牌／給創作者、安心設計、頁尾）與 SVG 紅線"
```

---

### Task 5: three.js 紅線場景

**Files:**
- Modify: `package.json`、`package-lock.json`（`npm i three@0.187.0 && npm i -D @types/three@0.187.0`）、`src/components/landing/Hero.tsx`（接上場景）、`src/app/page.tsx`
- Create: `src/components/thread/thread-scene.ts`、`ThreadCanvas.tsx`、`palette.ts`、`palette.test.ts`

**原型：** scratchpad `ui-plan/`（`harness.html`、`thread-scene.ts`、`shots/`）。esbuild `--bundle --minify --format=esm` 實測 three＋場景 gzip -9 **140,692 B**（預算 170KB；含「只有 hero 有開場」的最終版本，`tsc --strict` 通過）。截圖：`shots/hero-dark-1280.png`、`hero-light-1280.png`、`hero-dark-390.png`、`hero-light-390.png`、`hero-dark-1280-pull-brand.png`、`quiet-dark-1280.png`、`quiet-light-390.png`、`ribbon-dark-390.png`、`hero-dark-1280-intro-{300,700,1200}.png`、`hero-dark-1280-rm.png`。原型相對規格 §6 的調整：重力加大＋每步 0.08 平滑（低重力時多出的繩長會皺成小折）；鬆弛度 hero 桌面 1.08／手機 1.24、quiet 1.10（手機 1.05）、ribbon 1.025；結用 `TorusKnotGeometry`（三葉結，比珠子更像「結」）；線的 shader 是兩股絞在一起的紅繩紋理；尺寸以 CSS px 計（線半徑 hero 桌面 2.3、手機 1.8、quiet 1.6、ribbon 1.2）；光暈管 3.6 倍；遠景線 hero 桌面 8／手機 5、quiet 桌面 4、手機 quiet 與 ribbon 不畫；shader 結尾 `#include <colorspace_fragment>`。

- [ ] **Step 1：安裝**

```bash
npm i three@0.187.0 && npm i -D @types/three@0.187.0
```

- [ ] **Step 2：`src/components/thread/palette.ts` 與測試（從 CSS 變數讀顏色、決定要不要載入 WebGL）**

```ts
import type { ThreadPalette } from "./thread-scene";

type StyleLike = { getPropertyValue(name: string): string };

// 讀不到變數時（理論上不會）用規格 §2.1 的深色值
const FALLBACK = { bg: "#0D1424", thread: "#F0483E", glow: "#FF6B5E", far: "#2A3654" };

function pick(style: StyleLike, name: string, fallback: string): string {
  const v = style.getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}

/** 從 <html> 的計算樣式讀場景顏色；theme 是 data-theme 的值。 */
export function readPalette(style: StyleLike, theme: string | null): ThreadPalette {
  const thread = pick(style, "--color-thread", FALLBACK.thread);
  return {
    bg: pick(style, "--color-bg", FALLBACK.bg),
    thread,
    glow: pick(style, "--color-thread-glow", FALLBACK.glow),
    knot: thread,
    far: pick(style, "--color-far", FALLBACK.far),
    light: theme === "light",
  };
}

/** 規格 §6.3：reduced motion、省流量時不載入 three（只留 SVG）。 */
export function shouldLoadScene(env: { reducedMotion: boolean; saveData: boolean }): boolean {
  return !env.reducedMotion && !env.saveData;
}

/** 指標在 canvas 裡的位置 → -1..1（y 向上為正，thread-scene 的約定）。在 canvas 外回傳 null。 */
export function normalizePointer(x: number, y: number, rect: { left: number; top: number; width: number; height: number }): [number, number] | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const nx = ((x - rect.left) / rect.width) * 2 - 1;
  const ny = -(((y - rect.top) / rect.height) * 2 - 1);
  return nx < -1 || nx > 1 || ny < -1 || ny > 1 ? null : [nx, ny];
}
```

```ts
// src/components/thread/palette.test.ts
import { describe, expect, it } from "vitest";
import { normalizePointer, readPalette, shouldLoadScene } from "./palette";

const style = (m: Record<string, string>) => ({ getPropertyValue: (n: string) => m[n] ?? "" });

describe("readPalette", () => {
  it("讀 CSS 變數（容許空白），knot 與 thread 同色", () => {
    const p = readPalette(style({ "--color-bg": " #F3F5F9", "--color-thread": "#D2342B", "--color-thread-glow": "#E8584E", "--color-far": "#C9D1E0" }), "light");
    expect(p).toEqual({ bg: "#F3F5F9", thread: "#D2342B", glow: "#E8584E", knot: "#D2342B", far: "#C9D1E0", light: true });
  });
  it("讀不到或格式不對時用深色預設值", () => {
    const p = readPalette(style({ "--color-thread": "red" }), null);
    expect(p.thread).toBe("#F0483E");
    expect(p.light).toBe(false);
  });
});

describe("shouldLoadScene", () => {
  it("reduced motion 或省流量時不載入", () => {
    expect(shouldLoadScene({ reducedMotion: false, saveData: false })).toBe(true);
    expect(shouldLoadScene({ reducedMotion: true, saveData: false })).toBe(false);
    expect(shouldLoadScene({ reducedMotion: false, saveData: true })).toBe(false);
  });
});

describe("normalizePointer", () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };
  it("中心是 (0,0)，上方是 +1", () => {
    expect(normalizePointer(200, 100, rect)).toEqual([0, 0]);
    expect(normalizePointer(100, 50, rect)).toEqual([-1, 1]);
  });
  it("在 canvas 外或尺寸為 0 時是 null", () => {
    expect(normalizePointer(99, 100, rect)).toBeNull();
    expect(normalizePointer(0, 0, { left: 0, top: 0, width: 0, height: 0 })).toBeNull();
  });
});
```

- [ ] **Step 3：`src/components/thread/thread-scene.ts`（原型定稿，逐字貼上）**

```ts
// 「紅線」three.js 場景：一條 verlet 繩索的紅線，兩端各繫一個結（品牌、創作者）。
// 只用 three 的具名 import（不用 addons、後製、Worker、eval），由 ThreadCanvas 以 dynamic import 載入。
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  TorusKnotGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

export type ThreadVariant = "hero" | "quiet" | "ribbon";
export type ThreadPalette = { bg: string; thread: string; glow: string; knot: string; far: string; light: boolean };
export type ThreadSceneOptions = {
  variant: ThreadVariant;
  palette: ThreadPalette;
  reducedMotion: boolean;
  mobile: boolean;
  onFirstFrame?: () => void;
};
export type ThreadPull = "brand" | "creator" | null;
export type ThreadSceneHandle = {
  setPointer(x: number | null, y: number | null): void;
  setPull(side: ThreadPull): void;
  setPalette(p: ThreadPalette): void;
  resize(width: number, height: number): void;
  start(): void;
  stop(): void;
  dispose(): void;
};

type Tuning = {
  points: number;
  tubular: number;
  radial: number;
  radiusPx: number; // 線的半徑（CSS px）
  knotPx: number; // 結的大小（CSS px）
  slack: number; // 繩長 ÷ 兩端距離
  far: number; // 遠景細線數
  dprCap: number;
  glowAlpha: number;
};

function tuningFor(variant: ThreadVariant, mobile: boolean): Tuning {
  if (variant === "hero") {
    return mobile
      ? { points: 32, tubular: 96, radial: 6, radiusPx: 1.8, knotPx: 8, slack: 1.24, far: 5, dprCap: 1.5, glowAlpha: 0.42 }
      : { points: 48, tubular: 160, radial: 8, radiusPx: 2.3, knotPx: 11, slack: 1.08, far: 8, dprCap: 2, glowAlpha: 0.42 };
  }
  if (variant === "quiet") {
    return { points: 28, tubular: mobile ? 80 : 112, radial: 6, radiusPx: 1.6, knotPx: 8, slack: mobile ? 1.05 : 1.1, far: mobile ? 0 : 4, dprCap: 1.5, glowAlpha: 0.24 };
  }
  return { points: 20, tubular: mobile ? 72 : 120, radial: 6, radiusPx: 1.2, knotPx: 6, slack: 1.025, far: 0, dprCap: 1.5, glowAlpha: 0.22 };
}

// 結與兩端位置（以可見範圍的半寬 hw、半高 hh 的比例表示）
type Anchors = { a: [number, number, number]; b: [number, number, number] };

function anchorsFor(variant: ThreadVariant, aspect: number): Anchors {
  if (variant === "ribbon") return { a: [-0.86, 0.2, 0], b: [0.86, -0.05, 0] };
  if (variant === "quiet") {
    if (aspect > 1.6) return { a: [-0.86, 0.18, 0.2], b: [0.86, -0.1, -0.3] }; // 手機上方的橫帶
    return { a: [-0.62, 0.62, 0.3], b: [0.58, -0.42, -0.4] };
  }
  if (aspect < 1) return { a: [-0.76, 0.6, 0.3], b: [0.76, 0.2, -0.4] }; // 手機直式：線在上方 55%
  return { a: [-0.68, 0.46, 0.5], b: [0.8, 0.2, -0.7] };
}

// 可重現的亂數（遠景細線形狀固定）
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const TUBE_VERT = /* glsl */ `
attribute float aV;
attribute float aA;
varying float vV;
varying float vA;
varying vec3 vN;
varying vec3 vView;
void main() {
  vV = aV;
  vA = aA;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

// 主線：中心略亮、細的絲光高光、牽線時前端發亮
const CORE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uProgress;
uniform float uLight;
uniform float uTwist;
varying float vV;
varying float vA;
varying vec3 vN;
varying vec3 vView;
void main() {
  if (vV > uProgress) discard;
  vec3 n = normalize(vN);
  float facing = abs(dot(n, normalize(vView)));
  vec3 c = uColor * (0.78 + 0.3 * facing);
  // 兩股絲線扭在一起的紋理（像真的紅繩）
  float twist = 0.5 + 0.5 * sin((vV * uTwist + vA) * 12.566);
  c *= 0.86 + 0.14 * twist;
  float sheen = pow(max(dot(n, normalize(vec3(-0.35, 0.65, 0.7))), 0.0), 14.0);
  c += vec3(1.0, 0.9, 0.86) * sheen * mix(0.45, 0.22, uLight);
  float tip = smoothstep(uProgress - 0.05, uProgress, vV) * step(uProgress, 0.999);
  c = mix(c, vec3(1.0, 0.88, 0.82), tip * 0.7);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

// 光暈：較粗的管子，正面最亮、邊緣淡出（不用後製）
const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uProgress;
varying float vV;
varying vec3 vN;
varying vec3 vView;
void main() {
  if (vV > uProgress) discard;
  float facing = abs(dot(normalize(vN), normalize(vView)));
  float a = pow(facing, 2.0) * uAlpha;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

const KNOT_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const KNOT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uLight;
varying vec3 vN;
varying vec3 vView;
void main() {
  vec3 n = normalize(vN);
  float facing = abs(dot(n, normalize(vView)));
  vec3 c = uColor * (0.62 + 0.45 * facing);
  float sheen = pow(max(dot(n, normalize(vec3(-0.35, 0.65, 0.7))), 0.0), 10.0);
  c += vec3(1.0, 0.92, 0.88) * sheen * mix(0.5, 0.28, uLight);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

const HALO_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const HALO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = exp(-d * d * 5.5) * (1.0 - smoothstep(0.75, 1.0, d)) * uAlpha;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

/** 管狀幾何：預先配置好陣列，每一幀就地改寫位置與法線。 */
class TubeBuffer {
  readonly geometry = new BufferGeometry();
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  constructor(readonly tubular: number, readonly radial: number) {
    const rings = tubular + 1;
    this.positions = new Float32Array(rings * radial * 3);
    this.normals = new Float32Array(rings * radial * 3);
    const v = new Float32Array(rings * radial);
    const ang = new Float32Array(rings * radial);
    for (let j = 0; j < rings; j++) {
      for (let k = 0; k < radial; k++) {
        v[j * radial + k] = j / tubular;
        ang[j * radial + k] = k / radial;
      }
    }
    const index: number[] = [];
    for (let j = 0; j < tubular; j++) {
      for (let k = 0; k < radial; k++) {
        const a = j * radial + k;
        const b = (j + 1) * radial + k;
        const c = (j + 1) * radial + ((k + 1) % radial);
        const d = j * radial + ((k + 1) % radial);
        index.push(a, b, d, b, c, d);
      }
    }
    this.geometry.setIndex(index);
    this.geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("normal", new BufferAttribute(this.normals, 3));
    this.geometry.setAttribute("aV", new BufferAttribute(v, 1));
    this.geometry.setAttribute("aA", new BufferAttribute(ang, 1));
  }
  commit() {
    (this.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute("normal") as BufferAttribute).needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
}

export function createThreadScene(canvas: HTMLCanvasElement, opts: ThreadSceneOptions): ThreadSceneHandle {
  const { variant, mobile, reducedMotion } = opts;
  const tune = tuningFor(variant, mobile);
  const deviceDpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const dpr = Math.min(deviceDpr, tune.dprCap);

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: dpr < 2, powerPreference: "low-power" });
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 60);
  camera.position.set(0, 0, 10);

  // ---- 材質 ----
  const coreMat = new ShaderMaterial({
    vertexShader: TUBE_VERT,
    fragmentShader: CORE_FRAG,
    uniforms: { uColor: { value: new Color() }, uProgress: { value: reducedMotion ? 1 : 0 }, uLight: { value: 0 }, uTwist: { value: 120 } },
  });
  const glowMat = new ShaderMaterial({
    vertexShader: TUBE_VERT,
    fragmentShader: GLOW_FRAG,
    uniforms: { uColor: { value: new Color() }, uAlpha: { value: tune.glowAlpha }, uProgress: { value: reducedMotion ? 1 : 0 } },
    transparent: true,
    depthWrite: false,
  });
  const knotMat = new ShaderMaterial({
    vertexShader: KNOT_VERT,
    fragmentShader: KNOT_FRAG,
    uniforms: { uColor: { value: new Color() }, uLight: { value: 0 } },
  });
  const haloMats = [0, 1].map(
    () =>
      new ShaderMaterial({
        vertexShader: HALO_VERT,
        fragmentShader: HALO_FRAG,
        uniforms: { uColor: { value: new Color() }, uAlpha: { value: 0 } },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
  );
  const farMat = new LineBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false });

  // ---- 紅線 ----
  const core = new TubeBuffer(tune.tubular, tune.radial);
  const glow = new TubeBuffer(tune.tubular, tune.radial);
  const coreMesh = new Mesh(core.geometry, coreMat);
  const glowMesh = new Mesh(glow.geometry, glowMat);
  coreMesh.frustumCulled = false;
  glowMesh.frustumCulled = false;
  glowMesh.renderOrder = 2;
  scene.add(glowMesh, coreMesh);

  // ---- 兩個結（三葉結）與光暈 ----
  const knotGeo = new TorusKnotGeometry(1, 0.32, 64, 8, 2, 3);
  const haloGeo = new PlaneGeometry(1, 1);
  const knots = [0, 1].map((i) => {
    const g = new Group();
    const m = new Mesh(knotGeo, knotMat);
    m.rotation.set(0.5, i === 0 ? 0.6 : -0.6, 0);
    const h = new Mesh(haloGeo, haloMats[i]);
    h.renderOrder = 3;
    g.add(h, m);
    scene.add(g);
    return { group: g, mesh: m, halo: h };
  });

  // ---- 遠景細線（其他正在發生的媒合）----
  const farGroup = new Group();
  const farGeos: BufferGeometry[] = [];
  const rand = mulberry32(20261127);
  const farPhase: number[] = [];
  for (let i = 0; i < tune.far; i++) {
    const z = -6 - rand() * 6;
    const spanY = 3.2 + (-z) * 0.32;
    const spanX = spanY * 2.2;
    const y0 = (rand() * 2 - 1) * spanY * 0.9;
    const pts: Vector3[] = [];
    const n = 4;
    for (let k = 0; k < n; k++) {
      const s = k / (n - 1);
      pts.push(new Vector3(-spanX + s * spanX * 2, y0 + (rand() * 2 - 1) * spanY * 0.35 - Math.sin(s * Math.PI) * spanY * 0.15, z + (rand() - 0.5)));
    }
    const curve = new CatmullRomCurve3(pts, false, "centripetal");
    const geo = new BufferGeometry().setFromPoints(curve.getPoints(80));
    farGeos.push(geo);
    const line = new Line(geo, farMat);
    line.renderOrder = 0;
    farPhase.push(rand() * Math.PI * 2);
    farGroup.add(line);
  }
  scene.add(farGroup);

  // ---- 繩索（verlet）----
  const N = tune.points;
  const pos = Array.from({ length: N }, () => new Vector3());
  const prev = Array.from({ length: N }, () => new Vector3());
  const curve = new CatmullRomCurve3(pos, false, "centripetal");
  let restLen = 0.1;
  let hw = 1;
  let hh = 1;
  let unitsPerPx = 0.01;
  let initialized = false;
  const anchorBase = { a: new Vector3(), b: new Vector3() };
  const anchorNow = { a: new Vector3(), b: new Vector3() };
  const mid = new Vector3();

  // 互動狀態
  const pointer = { x: 0, y: 0, active: false, sx: 0, sy: 0, strength: 0 };
  let pullTarget: ThreadPull = null;
  const pullAmt = { brand: 0, creator: 0 };
  let palette = opts.palette;

  // 時間
  let raf = 0;
  let running = false;
  let disposed = false;
  let firstFrameSent = false;
  let simTime = 0;
  let introStart = -1;
  let last = 0;
  let acc = 0;
  const STEP = 1 / 60;

  function applyPalette(p: ThreadPalette) {
    palette = p;
    coreMat.uniforms.uColor.value.set(p.thread);
    coreMat.uniforms.uLight.value = p.light ? 1 : 0;
    knotMat.uniforms.uColor.value.set(p.knot);
    knotMat.uniforms.uLight.value = p.light ? 1 : 0;
    glowMat.uniforms.uColor.value.set(p.glow);
    // 淺色底用一般混合（加法混合在淺底會洗白）
    glowMat.blending = p.light ? NormalBlending : AdditiveBlending;
    glowMat.uniforms.uAlpha.value = p.light ? tune.glowAlpha * 0.55 : tune.glowAlpha;
    for (const m of haloMats) {
      m.uniforms.uColor.value.set(p.glow);
      m.blending = p.light ? NormalBlending : AdditiveBlending;
    }
    farMat.color.set(p.far);
    farMat.opacity = p.light ? 0.6 : 0.55;
  }
  applyPalette(opts.palette);

  function layout(width: number, height: number) {
    const aspect = width / Math.max(1, height);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    hh = camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    hw = hh * aspect;
    unitsPerPx = (2 * hh) / Math.max(1, height);
    const an = anchorsFor(variant, aspect);
    anchorBase.a.set(an.a[0] * hw, an.a[1] * hh, an.a[2]);
    anchorBase.b.set(an.b[0] * hw, an.b[1] * hh, an.b[2]);
    const dist = anchorBase.a.distanceTo(anchorBase.b);
    restLen = (dist * tune.slack) / (N - 1);
    const ks = tune.knotPx * unitsPerPx;
    for (const k of knots) {
      k.mesh.scale.setScalar(ks);
      k.halo.scale.setScalar(ks * 12);
    }
    if (!initialized) {
      // 初始形狀：兩端之間略為下垂的弧
      const sag = dist * Math.sqrt(Math.max(0, tune.slack - 1)) * 0.55;
      for (let i = 0; i < N; i++) {
        const s = i / (N - 1);
        pos[i].lerpVectors(anchorBase.a, anchorBase.b, s);
        pos[i].y -= sag * 4 * s * (1 - s);
        prev[i].copy(pos[i]);
      }
      anchorNow.a.copy(anchorBase.a);
      anchorNow.b.copy(anchorBase.b);
      initialized = true;
    }
  }

  function step(dt: number) {
    simTime += dt;
    // 拉力：滑到 CTA 時往該端收緊（約 300ms 緩動）
    const k = 1 - Math.exp(-dt / 0.1);
    pullAmt.brand += ((pullTarget === "brand" ? 1 : 0) - pullAmt.brand) * k;
    pullAmt.creator += ((pullTarget === "creator" ? 1 : 0) - pullAmt.creator) * k;
    mid.lerpVectors(anchorBase.a, anchorBase.b, 0.5);
    anchorNow.a.lerpVectors(anchorBase.a, mid, 0.12 * pullAmt.brand);
    anchorNow.b.lerpVectors(anchorBase.b, mid, 0.12 * pullAmt.creator);
    const rest = restLen * (1 - 0.08 * Math.max(pullAmt.brand, pullAmt.creator));

    // 游標位置平滑
    pointer.strength += ((pointer.active ? 1 : 0) - pointer.strength) * (1 - Math.exp(-dt / 0.25));
    pointer.sx += (pointer.x * hw - pointer.sx) * (1 - Math.exp(-dt / 0.08));
    pointer.sy += (pointer.y * hh - pointer.sy) * (1 - Math.exp(-dt / 0.08));
    const radius = (mobile ? 90 : 140) * unitsPerPx;

    const g = -0.9 * hh; // 重力要夠，多出來的長度才會垂成柔順的弧
    const dt2 = dt * dt;
    const t = simTime;
    for (let i = 1; i < N - 1; i++) {
      const p = pos[i];
      const q = prev[i];
      const s = i / (N - 1);
      const env = Math.sin(s * Math.PI);
      // 呼吸：低頻的風，線不會完全停下
      // 加一道緩慢移動的 S 形波，讓線像絲一樣有起伏，而不是一條單純的下垂弧線
      const wave = Math.sin(s * Math.PI * 2 + t * 0.32) * 0.75 + Math.sin(t * 0.55 + s * 3.1) * 0.3;
      const wy = wave * 0.45 * hh * env;
      const wz = Math.sin(t * 0.4 + s * 3.7 + 1.3) * 0.25 * hh * env;
      const vx = (p.x - q.x) * 0.985;
      const vy = (p.y - q.y) * 0.985;
      const vz = (p.z - q.z) * 0.985;
      q.copy(p);
      p.x += vx;
      p.y += vy + (g + wy) * dt2;
      p.z += vz + wz * dt2;
      // 游標輕推（彈性，不會瞬間跳開）
      if (pointer.strength > 0.01) {
        const dx = p.x - pointer.sx;
        const dy = p.y - pointer.sy;
        const d = Math.hypot(dx, dy);
        if (d < radius && d > 1e-5) {
          const push = ((radius - d) / radius) * 0.06 * pointer.strength * radius;
          p.x += (dx / d) * push * 0.5;
          p.y += (dy / d) * push * 0.5;
        }
      }
    }
    pos[0].copy(anchorNow.a);
    pos[N - 1].copy(anchorNow.b);
    for (let it = 0; it < 4; it++) {
      for (let i = 0; i < N - 1; i++) {
        const a = pos[i];
        const b = pos[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const diff = (d - rest) / d;
        const wa = i === 0 ? 0 : i + 1 === N - 1 ? 1 : 0.5;
        const wb = i === 0 ? 1 : i + 1 === N - 1 ? 0 : 0.5;
        a.x += dx * diff * wa;
        a.y += dy * diff * wa;
        a.z += dz * diff * wa;
        b.x -= dx * diff * wb;
        b.y -= dy * diff * wb;
        b.z -= dz * diff * wb;
      }
    }
    // 彎曲剛性：輕微平滑，讓多出來的長度變成柔順的弧，而不是小折角
    for (let i = 1; i < N - 1; i++) {
      const p = pos[i];
      p.x += ((pos[i - 1].x + pos[i + 1].x) * 0.5 - p.x) * 0.08;
      p.y += ((pos[i - 1].y + pos[i + 1].y) * 0.5 - p.y) * 0.08;
      p.z += ((pos[i - 1].z + pos[i + 1].z) * 0.5 - p.z) * 0.08;
    }
  }

  const samples: Vector3[] = Array.from({ length: tune.tubular + 1 }, () => new Vector3());
  const tan = new Vector3();
  const nor = new Vector3();
  const bin = new Vector3();
  const Z = new Vector3(0, 0, 1);

  function rebuildTube() {
    const T = tune.tubular;
    const R = tune.radial;
    for (let j = 0; j <= T; j++) curve.getPoint(j / T, samples[j]);
    const base = tune.radiusPx * unitsPerPx;
    for (let j = 0; j <= T; j++) {
      const v = j / T;
      const a = samples[Math.max(0, j - 1)];
      const b = samples[Math.min(T, j + 1)];
      tan.subVectors(b, a).normalize();
      nor.crossVectors(tan, Z);
      if (nor.lengthSq() < 1e-8) nor.set(0, 1, 0);
      nor.normalize();
      bin.crossVectors(tan, nor).normalize();
      // 粗細：±15% 的起伏，靠近兩端略收細
      const vary = 1 + 0.15 * Math.sin(v * 23 + 1.7) * Math.sin(v * 7.1 + 0.4);
      const taper = 0.7 + 0.3 * smooth(0, 0.06, v) * smooth(1, 0.94, v);
      const r = base * vary * taper;
      const c = samples[j];
      for (let k = 0; k < R; k++) {
        const ang = (k / R) * Math.PI * 2;
        const cs = Math.cos(ang);
        const sn = Math.sin(ang);
        const nx = nor.x * cs + bin.x * sn;
        const ny = nor.y * cs + bin.y * sn;
        const nz = nor.z * cs + bin.z * sn;
        const o = (j * R + k) * 3;
        core.normals[o] = nx;
        core.normals[o + 1] = ny;
        core.normals[o + 2] = nz;
        glow.normals[o] = nx;
        glow.normals[o + 1] = ny;
        glow.normals[o + 2] = nz;
        core.positions[o] = c.x + nx * r;
        core.positions[o + 1] = c.y + ny * r;
        core.positions[o + 2] = c.z + nz * r;
        const rg = r * 3.6;
        glow.positions[o] = c.x + nx * rg;
        glow.positions[o + 1] = c.y + ny * rg;
        glow.positions[o + 2] = c.z + nz * rg;
      }
    }
    core.commit();
    glow.commit();
  }

  function updateDecor(now: number) {
    // 牽線：約 1.2 秒從品牌端畫到創作者端
    // 只有首頁（hero）有開場；登入頁與公開頁的線一開始就在（規格 §6.4）
    const intro = !reducedMotion && variant === "hero";
    let progress = 1;
    if (intro) {
      if (introStart < 0) introStart = now;
      progress = easeOutCubic(Math.min(1, (now - introStart) / 1200));
    }
    coreMat.uniforms.uProgress.value = progress;
    glowMat.uniforms.uProgress.value = progress;

    knots[0].group.position.copy(pos[0]);
    knots[1].group.position.copy(pos[N - 1]);
    // 創作者端的結在線牽到時才出現（彈一下）
    const popT = !intro ? 1 : Math.min(1, Math.max(0, (now - introStart - 1080) / 320));
    knots[1].group.scale.setScalar(popT <= 0 ? 0.0001 : easeOutBack(popT));
    const breath = reducedMotion ? 0 : Math.sin(simTime * 1.3) * 0.08;
    const baseHalo = palette.light ? 0.22 : 0.42;
    haloMats[0].uniforms.uAlpha.value = baseHalo * (1 + breath + 0.6 * pullAmt.brand);
    const flash = popT > 0 && popT < 1 ? (1 - popT) * 0.8 : 0;
    haloMats[1].uniforms.uAlpha.value = baseHalo * (1 - breath + 0.6 * pullAmt.creator + flash) * (popT > 0 ? 1 : 0);
    if (!reducedMotion) {
      knots[0].mesh.rotation.z = simTime * 0.25;
      knots[1].mesh.rotation.z = -simTime * 0.25;
      farGroup.children.forEach((c, i) => {
        c.position.y = Math.sin(simTime * 0.05 + farPhase[i]) * 0.25;
        c.position.x = Math.sin(simTime * 0.03 + farPhase[i] * 1.7) * 0.4;
      });
    }
  }

  function render(now: number) {
    rebuildTube();
    updateDecor(now);
    renderer.render(scene, camera);
    if (!firstFrameSent) {
      firstFrameSent = true;
      opts.onFirstFrame?.();
    }
  }

  // reduced motion：先在背後模擬到靜止，只畫一張
  function renderStatic() {
    if (disposed || !initialized) return;
    for (let i = 0; i < 240; i++) step(STEP);
    render(0);
  }

  function frame(now: number) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 3) {
      step(STEP);
      acc -= STEP;
      n++;
    }
    if (n === 3) acc = 0;
    render(now);
  }

  return {
    setPointer(x, y) {
      if (x === null || y === null) {
        pointer.active = false;
        return;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.active = true;
    },
    setPull(side) {
      pullTarget = side;
      if (reducedMotion) {
        pullAmt.brand = side === "brand" ? 1 : 0;
        pullAmt.creator = side === "creator" ? 1 : 0;
        renderStatic();
      }
    },
    setPalette(p) {
      applyPalette(p);
      if (reducedMotion) renderStatic();
    },
    resize(width, height) {
      renderer.setSize(width, height, false);
      layout(width, height);
      if (reducedMotion) renderStatic();
    },
    start() {
      if (disposed || running) return;
      if (reducedMotion) {
        renderStatic();
        return;
      }
      running = true;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    dispose() {
      running = false;
      disposed = true;
      cancelAnimationFrame(raf);
      core.geometry.dispose();
      glow.geometry.dispose();
      knotGeo.dispose();
      haloGeo.dispose();
      farGeos.forEach((g) => g.dispose());
      [coreMat, glowMat, knotMat, farMat, ...haloMats].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
```

- [ ] **Step 4：`src/components/thread/ThreadCanvas.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ThreadFallback } from "./ThreadFallback";
import { normalizePointer, readPalette, shouldLoadScene } from "./palette";
import type { ThreadVariant } from "./types";

type Props = { variant: ThreadVariant };

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };

/**
 * 紅線場景的包裝（規格 §6.3）：
 * - SVG 後備一開始就在；canvas 第一幀畫完才淡入，同時把 SVG 淡出（兩者疊在同一個 absolute 容器裡，不影響版面）。
 * - three 在 idle 後才 dynamic import（後台頁面不會載入）；reduced motion、省流量、WebGL 失敗時一直是 SVG。
 * - 分頁隱藏或捲出畫面時停止 rAF；換主題時即時換色；卸載時 dispose。
 */
export function ThreadCanvas({ variant }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (!shouldLoadScene({ reducedMotion, saveData: conn?.saveData === true })) return;
    // ribbon 只在桌面、滑鼠裝置用 WebGL（規格 §6.4）
    if (variant === "ribbon" && !window.matchMedia("(min-width: 768px) and (pointer: fine)").matches) return;

    let disposed = false;
    const cleanups: (() => void)[] = [];
    const w = window as IdleWindow;

    async function boot() {
      const mod = await import("./thread-scene");
      if (disposed || !canvas) return;
      const root = document.documentElement;
      const palette = () => readPalette(getComputedStyle(root), root.getAttribute("data-theme"));
      let handle: ReturnType<typeof mod.createThreadScene>;
      try {
        handle = mod.createThreadScene(canvas, {
          variant, palette: palette(), reducedMotion: false,
          mobile: window.matchMedia("(max-width: 767px)").matches,
          onFirstFrame: () => { if (!disposed) setReady(true); },
        });
      } catch {
        return; // 沒有 WebGL：維持 SVG
      }
      cleanups.push(() => handle.dispose());

      const box = canvas.parentElement ?? canvas;
      const ro = new ResizeObserver(([e]) => handle.resize(e.contentRect.width, e.contentRect.height));
      ro.observe(box);
      cleanups.push(() => ro.disconnect());

      let onScreen = true;
      const sync = () => (onScreen && !document.hidden ? handle.start() : handle.stop());
      const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); });
      io.observe(box);
      cleanups.push(() => io.disconnect());
      document.addEventListener("visibilitychange", sync);
      cleanups.push(() => document.removeEventListener("visibilitychange", sync));

      const mo = new MutationObserver(() => handle.setPalette(palette()));
      mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
      cleanups.push(() => mo.disconnect());

      const lost = (e: Event) => { e.preventDefault(); handle.stop(); setReady(false); };
      canvas.addEventListener("webglcontextlost", lost);
      cleanups.push(() => canvas.removeEventListener("webglcontextlost", lost));

      if (variant === "hero") {
        // 游標只跟滑鼠（觸控捲動時不拉線）
        const move = (e: PointerEvent) => {
          if (e.pointerType !== "mouse") return;
          const p = normalizePointer(e.clientX, e.clientY, canvas.getBoundingClientRect());
          handle.setPointer(p ? p[0] : null, p ? p[1] : null);
        };
        const leave = () => handle.setPointer(null, null);
        window.addEventListener("pointermove", move, { passive: true });
        document.documentElement.addEventListener("pointerleave", leave);
        cleanups.push(() => { window.removeEventListener("pointermove", move); document.documentElement.removeEventListener("pointerleave", leave); });

        // 入口按鈕張力：滑過或聚焦 [data-thread-pull]
        const sideOf = (t: EventTarget | null) => {
          const el = t instanceof Element ? t.closest<HTMLElement>("[data-thread-pull]") : null;
          const v = el?.dataset.threadPull;
          return v === "brand" || v === "creator" ? v : null;
        };
        const enter = (e: Event) => { const s = sideOf(e.target); if (s) handle.setPull(s); };
        const exit = (e: Event) => {
          const next = (e as PointerEvent | FocusEvent).relatedTarget;
          if (sideOf(e.target) && sideOf(next) !== sideOf(e.target)) handle.setPull(sideOf(next));
        };
        document.addEventListener("pointerover", enter);
        document.addEventListener("pointerout", exit);
        document.addEventListener("focusin", enter);
        document.addEventListener("focusout", exit);
        cleanups.push(() => {
          document.removeEventListener("pointerover", enter);
          document.removeEventListener("pointerout", exit);
          document.removeEventListener("focusin", enter);
          document.removeEventListener("focusout", exit);
        });
      }
      handle.resize(box.clientWidth, box.clientHeight);
      sync();
    }

    const run = () => { void boot(); };
    const idle = w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 1500 }) : window.setTimeout(run, 200);
    return () => {
      disposed = true;
      if (w.cancelIdleCallback && w.requestIdleCallback) w.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      cleanups.reverse().forEach((f) => f());
    };
  }, [variant]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className={`absolute inset-0 transition-opacity duration-300 ${ready ? "opacity-0" : "opacity-100"}`}>
        <ThreadFallback variant={variant} />
      </div>
      <canvas ref={canvasRef} className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}
```

（`ThreadFallback` 沒有 hooks，可以在 client 元件裡渲染；伺服器輸出的 HTML 一樣有 SVG。容器 `pointer-events-none`，游標事件掛在 window 上。）

- [ ] **Step 5：接上首頁**：`src/app/page.tsx` 的 `<Hero />` 改成 `<Hero scene={<ThreadCanvas variant="hero" />} />`，並 `import { ThreadCanvas } from "@/components/thread/ThreadCanvas";`。

- [ ] **Step 6：檢查 three 只出現在場景模組**

```bash
grep -rln "from \"three\"" src   # 預期只有 src/components/thread/thread-scene.ts
npm run lint && npm run typecheck && npm test
npm run build
# three 的 chunk 大小與隔離：找含 WebGLRenderer 的 chunk，算 gzip，並確認後台頁面的 manifest 不引用它
F=$(grep -l "WebGLRenderer" .next/static/chunks/*.js | head -1); echo "$F"; gzip -9 -c "$F" | wc -c   # 預期 ≤ 174080
grep -rl "$(basename "$F")" .next/server/app/brand .next/server/app/creator .next/server/app/admin 2>/dev/null   # 預期沒有輸出（後台頁面的任何 manifest 都不引用 three 的 chunk）
```

- [ ] **Step 7：截圖驗收（`npm run start`）**：`/` 在 390×844、1280×900 × 深色、淺色；1280 深色時把滑鼠移到「我是品牌」再截一張（線往左收緊）；`page.emulateMedia({ reducedMotion: "reduce" })` 截一張（只有 SVG、沒有 canvas 內容）。用 `PerformanceObserver` 收 `largest-contentful-paint`，確認 LCP 元素是 `h1#hero-title`；`layout-shift` 總和為 0。關掉 server。

- [ ] **Step 8：Commit**

```bash
git add package.json package-lock.json src/components/thread src/components/landing/Hero.tsx src/app/page.tsx
git commit -m "UI 升級 Task 5：three.js 紅線場景（verlet 繩索、牽線開場、入口張力、主題換色、SVG 後備、動態載入）"
```

---

### Task 6: 登入、註冊、Onboarding

**Files:**
- Create: `src/components/auth/AuthShell.tsx`
- Modify: `src/app/login/page.tsx`、`src/app/signup/page.tsx`、`src/components/auth/AuthForm.tsx`、`src/components/auth/RolePicker.tsx`、`src/components/auth/DevLoginBox.tsx`（手機排版）、`src/app/onboarding/layout.tsx`、`src/app/onboarding/page.tsx`、`src/app/onboarding/BrandOnboardingForm.tsx`、`src/app/onboarding/CreatorOnboardingForm.tsx`、`src/components/forms/LogoField.tsx`、`src/components/forms/AvatarField.tsx`、`src/lib/validation/onboarding.ts`（加 `isEmail`）、`src/lib/validation/onboarding.test.ts`

- [ ] **Step 1：`isEmail` 與測試（取代瀏覽器原生 email 驗證，QA m6）**

`src/lib/validation/onboarding.ts` 加：

```ts
/** 寄驗證碼前的 Email 格式檢查（寬鬆：有一個 @、網域有點、沒有空白）；真正的驗證交給寄信。 */
export function isEmail(v: string): boolean {
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}
```

`onboarding.test.ts` 加：

```ts
describe("isEmail", () => {
  it("一般格式通過、缺 @ 或網域時不通過", () => {
    expect(isEmail("a@b.co")).toBe(true);
    expect(isEmail("name+tag@kollink.com.tw")).toBe(true);
    expect(isEmail("ab.co")).toBe(false);
    expect(isEmail("a@b")).toBe(false);
    expect(isEmail("a @b.co")).toBe(false);
    expect(isEmail("")).toBe(false);
  });
});
```

- [ ] **Step 2：`src/components/auth/AuthShell.tsx`**

```tsx
import Link from "next/link";
import { ThreadCanvas } from "@/components/thread/ThreadCanvas";
import { ThemeSelect } from "@/components/theme/ThemeSelect";
import { SkipLink } from "@/components/ui/SkipLink";
import { SITE_NAME } from "@/lib/site";

/** 登入／註冊外框（規格 §7）：桌面左 55% 是安靜的紅線，右邊是實心表單；手機是 160px 的紅線帶＋表單。 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100svh] bg-bg md:grid md:grid-cols-[55fr_45fr]">
      <SkipLink />
      <div className="relative isolate h-40 overflow-hidden md:h-auto md:min-h-[100svh]">
        <ThreadCanvas variant="quiet" />
        <Link href="/" className="absolute left-5 top-4 z-10 flex h-11 items-center gap-2 text-lg font-extrabold text-ink md:left-12 md:top-8">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />{SITE_NAME}
        </Link>
        <p className="absolute bottom-12 left-12 z-10 hidden max-w-sm font-serif text-[28px] font-bold leading-snug text-ink md:block">
          每一次合作，都從一條線開始。
        </p>
      </div>
      <main id="main" tabIndex={-1} className="flex flex-col justify-center bg-panel px-4 py-8 outline-none md:px-12">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="rounded-card border border-line bg-surface p-5 md:p-8">{children}</div>
          <div className="mt-6 flex justify-center"><ThemeSelect /></div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3：`src/app/login/page.tsx`** 的外框換成 `AuthShell`：

```tsx
export default function LoginPage({ searchParams }: { searchParams: SP }) {
  return (
    <AuthShell>
      <h1 className="font-serif text-[28px] font-bold text-ink">登入</h1>
      <p className="mt-1 text-sm text-muted">我們會寄一組驗證碼到你的信箱，不用記密碼。</p>
      <div className="mt-6">
        <Suspense fallback={<Skeleton className="h-[188px] w-full" />}>
          <Login searchParams={searchParams} />
        </Suspense>
      </div>
      <DevLoginBox />
      <Suspense fallback={null}>
        <SwitchLink searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
```

`Login` 內的兩個錯誤 `<p role="alert">` 換成 `<Notice tone="danger" className="mb-4">登入沒有完成，請再試一次</Notice>`（另一則同理）；`SwitchLink` 的連結 class 換成 `textLink`（`@/components/ui/styles`）。`import { AuthShell } from "@/components/auth/AuthShell"; import { Skeleton } from "@/components/ui/Skeleton"; import { Notice } from "@/components/ui/Notice"; import { textLink } from "@/components/ui/styles";`；移除 `SITE_NAME` import（不再用）。

- [ ] **Step 4：`src/app/signup/page.tsx`** 同樣換成 `AuthShell`；h1「加入 Kollink」用 `` `加入 ${SITE_NAME}` ``、class 同上；第 1 步的說明改「先選身分，下一步用 Email 收驗證碼。」；第 2 步：

```tsx
      <p className="mb-4 flex flex-wrap items-center gap-x-2 text-sm text-muted">
        以{role === "brand" ? "品牌" : "創作者"}身分註冊
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className={textLink}>更改身分</Link>
      </p>
```

- [ ] **Step 5：`src/components/auth/RolePicker.tsx` 整個換成**

```tsx
import Link from "next/link";
import { Building2, Sparkles } from "lucide-react";

const card = "flex min-h-11 items-start gap-4 rounded-card border border-line-strong bg-surface p-5 hover:border-thread hover:bg-subtle";

export function RolePicker({ hrefFor }: { hrefFor: (r: "brand" | "creator") => string }) {
  return (
    <div className="grid gap-3">
      <Link href={hrefFor("brand")} className={card}>
        <Building2 size={24} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
        <span>
          <span className="block text-lg font-bold text-ink">我是品牌</span>
          <span className="mt-1 block text-sm text-muted">找創作者、刊登招募、付款與追蹤合作進度。</span>
        </span>
      </Link>
      <Link href={hrefFor("creator")} className={card}>
        <Sparkles size={24} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
        <span>
          <span className="block text-lg font-bold text-ink">我是創作者</span>
          <span className="mt-1 block text-sm text-muted">建立公開頁、接品牌合作、完成後收款。</span>
        </span>
      </Link>
    </div>
  );
}
```

（`hrefFor` 是函式，只能在伺服器元件之間傳——`signup/page.tsx` 與 `onboarding/page.tsx` 都是伺服器元件，維持現狀。）

- [ ] **Step 6：`src/components/auth/AuthForm.tsx` 的 return 與狀態改成下列版本（`sendCode`、`verify`、`google` 的邏輯不變，只加 email 檢查與「進行中」文字）**

在 `sendCode()` 開頭加：

```ts
    if (!isEmail(email.trim())) {
      setError("請輸入正確的 Email，例如 you@example.com");
      return;
    }
```

`verify()` 成功（`window.location.assign` 之前）加 `setDone(true);`，並新增 state `const [done, setDone] = useState(false);`。import `isEmail`（`@/lib/validation/onboarding`）、`btn`、`input`（`@/components/ui/styles`）、`ErrorText`。return 換成：

```tsx
  return (
    <div>
      {googleEnabled && (
        <>
          <button type="button" onClick={google} disabled={pending} className={`${btn.secondary} w-full`}>用 Google 繼續</button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />或用 Email<span className="h-px flex-1 bg-line" /></div>
        </>
      )}

      {step === "email" ? (
        <form noValidate onSubmit={(e) => { e.preventDefault(); void sendCode(); }} className="space-y-3">
          <label htmlFor="auth-email" className="text-sm font-bold text-ink">Email</label>
          <input
            id="auth-email" type="email" autoComplete="email" inputMode="email" value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="you@example.com"
            aria-invalid={error ? true : undefined} className={input}
          />
          <button type="submit" disabled={pending} className={`${btn.primary} w-full`}>
            {pending ? "寄送中…" : "寄驗證碼"}
          </button>
        </form>
      ) : (
        <form noValidate onSubmit={(e) => { e.preventDefault(); void verify(); }} className="space-y-3">
          <p className="break-words text-sm text-muted">驗證碼已寄到 <span className="font-bold text-ink">{email}</span>，請在 10 分鐘內輸入。</p>
          <label htmlFor="auth-code" className="text-sm font-bold text-ink">驗證碼</label>
          <input
            id="auth-code" ref={codeRef} inputMode="numeric" autoComplete="one-time-code" maxLength={OTP_MAX_LENGTH}
            value={code} onChange={(e) => { setCode(toOtpCode(e.target.value)); setError(null); }} placeholder="6 到 8 碼"
            aria-invalid={error ? true : undefined} className={`${input} tracking-[0.3em]`}
          />
          <button type="submit" disabled={pending || done} className={`${btn.primary} w-full`}>
            {done ? "登入成功，正在帶你進去…" : pending ? "登入中…" : "登入"}
          </button>
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" disabled={cooldown > 0 || pending} onClick={() => void sendCode()} className={btn.ghost}>
              {cooldown > 0 ? `${cooldown} 秒後可以重寄` : "重寄驗證碼"}
            </button>
            <button type="button" disabled={pending} onClick={() => { setStep("email"); setCode(""); setError(null); }} className={btn.ghost}>
              更改 Email
            </button>
          </div>
        </form>
      )}

      <div key={attempt} className="mt-3"><ErrorText message={error} /></div>
    </div>
  );
```

（`ErrorText` 自帶 `role="alert"`；`key={attempt}` 讓同一則錯誤再次出現時重新宣讀。Google 未設定時整段不顯示，QA m5。）

- [ ] **Step 7：`DevLoginBox.tsx`**：按鈕改 `btn.secondary w-full`、文字 `whitespace-nowrap` 外層 `grid gap-2`（390 寬不折行，QA m5）。只在本機出現，不另寫測試。

- [ ] **Step 8：Onboarding**
  - `src/app/onboarding/layout.tsx`：外框換成

    ```tsx
    <div className="min-h-[100svh] bg-bg">
      <SkipLink />
      <header className="mx-auto flex h-16 max-w-xl items-center px-4">
        <Link href="/" className="flex h-11 items-center gap-2 font-extrabold text-ink"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />{SITE_NAME}</Link>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-xl px-4 pb-16 outline-none">
        <Suspense fallback={<Skeleton className="h-96 w-full" />}><Gate>{children}</Gate></Suspense>
      </main>
    </div>
    ```

  - `onboarding/page.tsx`、`brand/page.tsx`、`creator/page.tsx` 的 h1 用 `h1`（styles）；表單外框 `cardPad`。
  - `BrandOnboardingForm.tsx`、`CreatorOnboardingForm.tsx`：表單加 `noValidate`、移除 `required`／`pattern`（既有的 `validate*` 已在送出時檢查並回傳繁中錯誤，QA m6）；送出按鈕 `btn.primary w-full sm:w-auto`；錯誤用 `ErrorText`。
  - `LogoField.tsx`、`AvatarField.tsx`：原生 `<input type="file">` 換成 `FilePicker`：

    ```tsx
    <FilePicker
      label={path ? "更換圖片" : "選擇圖片"} ariaLabel="上傳頭像" accept="image/png,image/jpeg,image/webp"
      busy={busy} disabled={disabled} fileName={path ? "已上傳" : null}
      describedBy={note ? noteId : undefined} invalid={note ? true : undefined}
      onFiles={(files) => void onFile(files[0])}
    />
    ```

    （Logo 的 `ariaLabel="上傳 Logo"`；「移除頭像／移除 Logo」按鈕改 `btn.ghost`；字母頭像底色改 `bg-subtle text-ink`；`fileRef` 不再需要時刪除。）

- [ ] **Step 9：檢查、截圖、Commit**

```bash
npm run lint && npm run typecheck && npm test
npm run build   # 截圖：/login、/signup、/signup?role=brand、/onboarding（測試帳號）在 390／1280 × 深／淺；/login 在 reduced-motion
git add src/components/auth src/app/login/page.tsx src/app/signup/page.tsx src/app/onboarding src/components/forms/LogoField.tsx \
  src/components/forms/AvatarField.tsx src/lib/validation/onboarding.ts src/lib/validation/onboarding.test.ts
git commit -m "UI 升級 Task 6：登入／註冊的安靜紅線版面、Email 繁中驗證與進行中文字、Onboarding 與自訂檔案欄位"
```

---

### Task 7: 創作者公開頁、OG 圖、格式錯誤的公開頁回 404

**Files:**
- Modify: `src/app/c/layout.tsx`、`src/app/c/[handle]/ProfileView.tsx`、`src/app/c/[handle]/page.tsx`（骨架）、`src/app/c/[handle]/not-found.tsx`、`src/app/c/[handle]/opengraph-image.tsx`、`src/components/collabs/InvitePanel.tsx`、`src/proxy.ts`、`src/lib/auth/routes.ts`、`src/lib/auth/routes.test.ts`、`src/lib/format.ts`、`src/lib/format.test.ts`

- [ ] **Step 1：測試 — `routes.test.ts` 加入**

```ts
import { invalidCreatorPath } from "./routes";

describe("invalidCreatorPath（格式不合法的公開頁直接 404，QA m1 的一部分）", () => {
  it("/c/<不合法> 為 true；合法、多段、其他路徑為 false", () => {
    expect(invalidCreatorPath("/c/Bad!")).toBe(true);
    expect(invalidCreatorPath("/c/ab")).toBe(true);
    expect(invalidCreatorPath("/c/good_handle")).toBe(false);
    expect(invalidCreatorPath("/c/good_handle/opengraph-image")).toBe(false);
    expect(invalidCreatorPath("/brand")).toBe(false);
  });
});
```

並在 `routes.ts` 加：

```ts
import { HANDLE_RE } from "@/lib/validation/onboarding";

/** /c/<handle>（只有一段）且 handle 不符合格式：proxy 直接回 404（Suspense 內的 notFound() 只能回 200＋noindex）。 */
export function invalidCreatorPath(pathname: string): boolean {
  const m = /^\/c\/([^/]+)$/.exec(pathname);
  if (!m) return false;
  let h: string;
  try {
    h = decodeURIComponent(m[1]);
  } catch {
    return true;
  }
  return !HANDLE_RE.test(h);
}
```

（`validation/onboarding.ts` 沒有 `server-only`，proxy 可以 import。）

- [ ] **Step 2：`src/proxy.ts`** 在 `updateSession` 之前加（不需要 session）：

```ts
  // 格式不合法的公開頁：rewrite 到不存在的路由，Next 會以 404 狀態渲染 app/not-found.tsx（Next 文件 loading.md「Status codes」）
  if (invalidCreatorPath(request.nextUrl.pathname)) {
    return NextResponse.rewrite(new URL("/_kollink-not-found", request.url));
  }
```

import `invalidCreatorPath`。**驗證**（Step 9 的 server 起來後）：`curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/c/Bad%21` 必須是 `404`，且 HTML 內有「這一頁不存在」。若不是 404（rewrite 到不存在路由的行為與文件不符），改成 `return new NextResponse(null, { status: 404 })` 前先停下來回報 controller，不要自行改用其他方式。

- [ ] **Step 3：互動率一位小數（QA p1）**：`src/lib/format.ts`

```ts
/** 互動率；沒填顯示「—」。固定一位小數（QA p1）。 */
export function formatPercent(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}%`;
}
```

`format.test.ts` 對應的期望改成一位小數（例如 `2` → `"2.0%"`、`6.667` → `"6.7%"`）；`grep -rn "formatPercent" src --include=*.test.ts` 找出其他斷言一併更新。

- [ ] **Step 4：公開頁外框 `src/app/c/layout.tsx`**

```tsx
import Link from "next/link";
import { AccountLink } from "@/components/shell/AccountLink";
import { SkipLink } from "@/components/ui/SkipLink";
import { SITE_NAME } from "@/lib/site";

/** 公開頁外框：頂列＋內容，不套登入後的側邊導覽。 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <SkipLink />
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex h-11 items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />{SITE_NAME}
        </Link>
        <AccountLink />
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] outline-none md:pb-12">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5：`ProfileView.tsx`** — 頭部改成 ribbon＋頭像結（規格 §8）。`HeaderCard` 換成：

```tsx
function HeaderCard({ c, favorite }: { c: PublicCreator; favorite?: boolean }) {
  const avatar = creatorMediaUrl(c.avatarPath);
  return (
    <section className="relative overflow-hidden rounded-card border border-line bg-surface">
      {/* 頂部 96px 的紅線帶（規格 §8）：桌面滑鼠裝置用 WebGL，其他一律 SVG */}
      <div className="relative h-24 bg-panel">
        <ThreadCanvas variant="ribbon" />
      </div>
      <div className="px-5 pb-5 md:px-8 md:pb-8">
        <div className="-mt-12 flex items-end justify-between gap-3">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="relative h-24 w-24 shrink-0 rounded-full border-2 border-thread bg-subtle object-cover" />
          ) : (
            <div aria-hidden="true" className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-thread bg-subtle font-serif text-4xl font-bold text-ink">
              {initialOf(c.displayName)}
            </div>
          )}
          {favorite !== undefined && <FavoriteButton creatorId={c.userId} name={c.displayName} initial={favorite} />}
        </div>
        <h1 className="mt-4 min-w-0 break-words font-serif text-[28px] font-bold leading-tight text-ink md:text-[40px]">{c.displayName}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
          <span>@{c.handle}</span>
          {c.region && <span className="inline-flex items-center gap-1"><MapPin size={14} strokeWidth={1.5} aria-hidden="true" />{c.region}</span>}
        </p>
        {c.categories.length > 0 && <div className="mt-4"><Chips label="內容領域" items={c.categories} dark /></div>}
        <p className="mt-4 flex items-center gap-1 text-sm text-muted">
          <Star size={14} strokeWidth={1.5} aria-hidden="true" />新創作者・尚無評價
        </p>
        {c.bio && <p className="mt-4 whitespace-pre-line break-words text-sm text-ink">{c.bio}</p>}
      </div>
    </section>
  );
}
```

其他：`card` 常數改成 `cardPad`（styles）；`Section` 的 h2 用 `h2`；`Chips` 的淡色版 `bg-subtle text-ink`、`dark` 版維持 `bg-ink text-on-ink`；`StatsCard` 的數字 `font-sans text-2xl font-bold tabular-nums`；報價鎖定區塊與「合作過的品牌」空狀態改用 `bg-subtle`。`import { ThreadCanvas } from "@/components/thread/ThreadCanvas"; import { cardPad, h2 } from "@/components/ui/styles";`。

`page.tsx` 的 `ProfileSkeleton` 換成與實際版面同構：

```tsx
function ProfileSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4 pt-2 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6 md:pt-6">
      <p className="sr-only">載入中…</p>
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="h-24 bg-panel" />
        <div className="space-y-3 p-5"><Skeleton className="-mt-14 h-24 w-24 rounded-full" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-1/3" /></div>
      </div>
      <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div>
    </div>
  );
}
```

`not-found.tsx`（`/c/[handle]`）：

```tsx
import Link from "next/link";
import { ThreadMark } from "@/components/ui/ThreadMark";
import { btn, h1 } from "@/components/ui/styles";

export default function CreatorNotFound() {
  return (
    <div className="mx-auto mt-10 flex max-w-md flex-col items-center rounded-card border border-line bg-surface p-8 text-center">
      <ThreadMark variant="broken" />
      <h1 className={`${h1} mt-4`}>找不到這位創作者</h1>
      <p className="mt-2 text-sm text-muted">網址可能有誤，或這個頁面還沒有公開。</p>
      <Link href="/" className={`${btn.primary} mt-6`}>回首頁</Link>
    </div>
  );
}
```

- [ ] **Step 6：`InvitePanel.tsx`**：「邀請合作」按鈕 `${btn.primary} w-full`；外框維持（手機固定底部、safe-area）。

- [ ] **Step 7：OG 圖 `opengraph-image.tsx`**：`OG_COLORS` 換成深色 token，並加紅線（satori 支援內嵌 `<svg>`）：

```tsx
// ImageResponse 不吃 Tailwind class；值與 src/app/globals.css 的深色 token 相同（規格 §2.1、§8）
const OG_COLORS = { bg: "#0D1424", surface: "#1A2540", line: "#2A3654", ink: "#EEF1F7", muted: "#9AA6BF", thread: "#F0483E" };
```

根 `<div>` 的 `background` 用 `OG_COLORS.bg`、`color` 用 `OG_COLORS.ink`；頭像（圖或字母）加 `border: \`6px solid ${OG_COLORS.thread}\``；字母頭像底色 `OG_COLORS.surface`、字色 `OG_COLORS.ink`；在根 div 的第一個子元素前加：

```tsx
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
          <path d="M172 272 C 420 520, 760 560, 1080 540" fill="none" stroke={OG_COLORS.thread} strokeWidth="5" strokeLinecap="round" />
          <circle cx="1080" cy="540" r="10" fill="none" stroke={OG_COLORS.thread} strokeWidth="5" />
        </svg>
```

（路徑從頭像中心附近出發、結束在右下角字標旁；根 div 要有 `position: "relative"`。其他 `OG_COLORS.onInk` 的用法改成 `OG_COLORS.ink`。）

- [ ] **Step 8：檢查**

```bash
npm run lint && npm run typecheck && npm test
```

- [ ] **Step 9：建置、截圖、狀態碼**

```bash
npm run build && (npm run start > /tmp/kollink-start.log 2>&1 &) && sleep 6
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/c/Bad%21          # 預期 404
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" localhost:3000/c/devcreator/opengraph-image   # 預期 200 image/png（本機種子創作者）
# 截圖：/c/devcreator 以訪客、品牌在 390／1280 × 深／淺；OG 圖存檔目視
kill $(lsof -ti :3000)
```

- [ ] **Step 10：Commit**

```bash
git add src/app/c src/components/collabs/InvitePanel.tsx src/proxy.ts src/lib/auth/routes.ts src/lib/auth/routes.test.ts src/lib/format.ts src/lib/format.test.ts $(git diff --name-only -- 'src/**/*.test.ts')
git commit -m "UI 升級 Task 7：創作者公開頁（紅線 ribbon、頭像結）、深色 OG 圖、格式錯誤的公開頁回 404、互動率一位小數"
```

---

### Task 8: 品牌頁面（廣場、招募、報名者、設定）

**Files:**
- Modify: `src/lib/briefs/view.ts`、`src/lib/briefs/view.test.ts`、`src/lib/validation/brief.ts`、`src/lib/validation/brief.test.ts`、`src/components/briefs/ApplicantList.tsx`、`src/app/brand/briefs/[id]/page.tsx`、`src/components/briefs/BriefForm.tsx`、`src/components/briefs/BriefOwnerActions.tsx`、`src/app/brand/briefs/page.tsx`、`src/app/brand/briefs/new/page.tsx`、`src/app/brand/briefs/[id]/edit/page.tsx`、`src/components/forms/CoverField.tsx`、`src/components/forms/ChipMultiSelect.tsx`、`src/components/forms/CategoryPicker.tsx`、`src/components/square/SquareView.tsx`、`SquareResults.tsx`、`CreatorCard.tsx`、`FilterPanel.tsx`、`FilterDrawer.tsx`、`CreatorTable.tsx`、`src/app/brand/page.tsx`、`src/app/brand/settings/BrandSettingsForm.tsx`、`src/app/brand/settings/page.tsx`
- Create: `src/lib/briefs/wizard.ts`、`src/lib/briefs/wizard.test.ts`

- [ ] **Step 1：測試先行（純函式）**

`src/lib/briefs/view.test.ts` 加：

```ts
import { parseApplicantFilter, sortApplicants } from "./view";

describe("parseApplicantFilter（篩選寫進網址，QA m16）", () => {
  it("認得的值照用，其他退回 all", () => {
    expect(parseApplicantFilter("applied")).toBe("applied");
    expect(parseApplicantFilter(["rejected", "x"])).toBe("rejected");
    expect(parseApplicantFilter("bogus")).toBe("all");
    expect(parseApplicantFilter(undefined)).toBe("all");
  });
});

describe("sortApplicants（同時間報名時順序穩定）", () => {
  it("新的在前；時間相同時依 id", () => {
    const a = (id: string, createdAt: string) => ({ id, createdAt }) as Parameters<typeof sortApplicants>[0][number];
    const list = [a("b", "2026-11-26T01:00:00Z"), a("a", "2026-11-26T01:00:00Z"), a("c", "2026-11-26T02:00:00Z")];
    expect(sortApplicants(list).map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(list.map((x) => x.id)).toEqual(["b", "a", "c"]); // 不改原陣列
  });
});
```

`src/lib/briefs/wizard.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { canJumpToStep, isBlankBrief } from "./wizard";

describe("canJumpToStep（步驟可點，QA m15）", () => {
  it("可以回到任何到過的步驟；不能跳過還沒到的", () => {
    expect(canJumpToStep(1, 3, 3)).toBe(true);
    expect(canJumpToStep(3, 1, 3)).toBe(true);
    expect(canJumpToStep(4, 2, 3)).toBe(false);
    expect(canJumpToStep(2, 2, 2)).toBe(false); // 目前這一步不用跳
  });
});

describe("isBlankBrief（全空時不能存草稿）", () => {
  it("案名空白就是空白草稿", () => {
    expect(isBlankBrief({ title: "  " })).toBe(true);
    expect(isBlankBrief({ title: "夏季新品" })).toBe(false);
  });
});
```

`src/lib/validation/brief.test.ts`：把「草稿可以沒有案名」之類的斷言改成：

```ts
  it("存成草稿至少要有案名（QA m15：不再產生空白草稿）", () => {
    expect(validateBrief({ ...emptyInput, title: "" }, "draft", today)?.title).toBe("存成草稿前請先填寫案名");
    expect(validateBrief({ ...emptyInput, title: "夏季新品" }, "draft", today)).toBeNull();
  });
```

（`emptyInput`、`today` 用該測試檔既有的 fixture 名稱；若名稱不同，以檔案現有的為準。）

- [ ] **Step 2：實作純函式**

`src/lib/briefs/view.ts`（`filterApplicants` 下方）加：

```ts
export function parseApplicantFilter(v: string | string[] | undefined): ApplicantFilter {
  const x = Array.isArray(v) ? v[0] : v;
  return APPLICANT_FILTERS.some((f) => f.value === x) ? (x as ApplicantFilter) : "all";
}

/** 新的在前；同一時間依 id，順序穩定（QA m16）。不改原陣列。 */
export function sortApplicants<T extends { id: string; createdAt: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt < b.createdAt ? 1 : -1));
}
```

`src/lib/briefs/wizard.ts`：

```ts
import type { BriefStep } from "@/lib/validation/brief";

/** 步驟指示器：可以點回任何到過的步驟（maxVisited），不能跳過還沒到的。 */
export function canJumpToStep(target: BriefStep, current: BriefStep, maxVisited: BriefStep): boolean {
  return target !== current && target <= maxVisited;
}

/** 「存成草稿」至少要有案名。 */
export function isBlankBrief(v: { title: string }): boolean {
  return v.title.trim() === "";
}
```

`src/lib/validation/brief.ts` 的 `validateBrief` 案名那段改成：

```ts
  if (hasBadChar(i.title)) e.title = BAD_CHAR_MESSAGE;
  else if (len(i.title) > 60) e.title = "案名最多 60 字";
  else if (i.title === "") e.title = publish ? "請填寫案名（60 字以內）" : "存成草稿前請先填寫案名";
```

`firstErrorStep` 已把 `title` 對應到第 1 步，不用改。執行 `npx vitest run src/lib/briefs src/lib/validation/brief.test.ts` 全過。

- [ ] **Step 3：報名者列表（QA M1、m16）** — `src/components/briefs/ApplicantList.tsx`
  - Props 加 `initialFilter: ApplicantFilter`；`useState<ApplicantFilter>(initialFilter)`；切換時：

    ```ts
    function choose(f: ApplicantFilter) {
      setFilter(f);
      const url = new URL(window.location.href);
      if (f === "all") url.searchParams.delete("applicants");
      else url.searchParams.set("applicants", f);
      window.history.replaceState(null, "", url);
    }
    ```

  - `const shown = sortApplicants(filterApplicants(applicants, filter));`
  - 篩選按鈕 class 換成 `chip(filter === f.value)`（`@/components/ui/styles`），外層 `flex gap-2 overflow-x-auto pb-1`；計數放 `<span className="tabular-nums opacity-80">`。
  - 每位報名者的外框從卡片改成列：外層 `<ul className={rows}>`，`<li className="p-4 md:p-5">`（不再各自 `rounded-card`）。
  - 空狀態換成 `<EmptyState text="沒有符合的報名者" />`。
  - `reject()` 與「婉拒」按鈕整段刪除，改成：

    ```tsx
      {a.status === "applied" && !accepting && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
          <button type="button" onClick={() => setAccepting(true)} className={`${btn.primary} w-full sm:w-auto`}>錄取</button>
          <ConfirmAction
            label="婉拒報名" danger icon="x" confirmLabel="確定婉拒"
            message={`婉拒後不能復原，${a.displayName} 會看到「未錄取」。確定要婉拒嗎？`}
            onConfirm={() => rejectApplicationAction(a.id, briefId)}
          />
        </div>
      )}
    ```

    （`ConfirmAction` 已處理狀態已變的重新整理與錯誤；`useTransition`、`router`、`notice` 等只為 reject 存在的 state 一併刪除。）
  - 「查看合作案 →」改成 `<Link … className={textLink}>查看合作案</Link>`。
  - 錄取表單外框 `bg-bg` → `bg-subtle`。

  `src/app/brand/briefs/[id]/page.tsx`：在讀 `params` 的 Suspense 內容裡同時讀 `searchParams`，傳 `initialFilter={parseApplicantFilter((await searchParams).applicants)}`（頁面 props 加 `searchParams: Promise<Record<string, string | string[] | undefined>>`）；`text-accent` 的酬勞保留；h1 用 `PageHeader`（back `{ href: "/brand/briefs", label: "我的招募" }`）。

- [ ] **Step 4：招募精靈（QA m15）** — `src/components/briefs/BriefForm.tsx`
  - state 加 `const [maxStep, setMaxStep] = useState<BriefStep>(initialStep);`，`goTo(next)` 裡 `setMaxStep((m) => (next > m ? next : m));`。
  - 網址：把 `replaceState` 的 effect 換成在 `goTo` 裡 `pushState`，並監聽上一頁：

    ```ts
      function goTo(next: BriefStep, push = true) {
        setClientErrors({});
        setShowSaved(false);
        setStep(next);
        setMaxStep((m) => (next > m ? next : m));
        if (push) {
          const url = new URL(window.location.href);
          url.searchParams.set("step", String(next));
          url.searchParams.delete("saved");
          window.history.pushState(null, "", url);
        }
        window.scrollTo({ top: 0 });
      }

      // 瀏覽器上一頁／下一頁：回到網址上的步驟（QA m15：上一頁不再直接離開精靈）
      useEffect(() => {
        function onPop() {
          const s = Number(new URL(window.location.href).searchParams.get("step"));
          if (s === 1 || s === 2 || s === 3 || s === 4) goTo(s as BriefStep, false);
        }
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
      });
    ```

    （effect 沒有依賴陣列是刻意的：每次 render 拿到最新的 `goTo`；監聽器只掛一個。）
  - 離開提示：

    ```ts
      const dirty = JSON.stringify(values) !== JSON.stringify(initial);
      useEffect(() => {
        if (!dirty || pending) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
      }, [dirty, pending]);
    ```

  - 步驟指示器換成可點的按鈕（手機也顯示標籤，可橫捲）：

    ```tsx
      <ol className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:px-0" aria-label="步驟">
        {STEPS.map((s) => {
          const current = s.step === step;
          const reachable = canJumpToStep(s.step, step, maxStep);
          return (
            <li key={s.step} className="shrink-0 md:shrink">
              <button
                type="button" disabled={!reachable && !current} aria-current={current ? "step" : undefined}
                onClick={() => reachable && goTo(s.step)}
                className={`flex h-11 w-full items-center gap-2 whitespace-nowrap rounded-btn border px-4 text-sm font-bold ${
                  current ? "border-ink bg-ink text-on-ink" : s.step <= maxStep ? "border-line-strong bg-surface text-ink hover:bg-subtle" : "border-line text-muted"
                }`}
              >
                <span className="tabular-nums">{s.step}</span>{s.label}
              </button>
            </li>
          );
        })}
      </ol>
    ```

  - 「存成草稿」：`disabled={busy || isBlankBrief(values)}`，按鈕旁（`isBlankBrief` 時）加 `<span className="text-xs text-muted">填寫案名後就能存成草稿</span>`。
  - 主要按鈕（下一步、發佈、儲存變更）→ `btn.primary`；上一步、存成草稿 → `btn.secondary`；各 `section` 外框 → `cardPad`；`text-success` 的「已存成草稿」換成 `<Notice tone="success">已存成草稿</Notice>`。
  - import：`canJumpToStep`、`isBlankBrief`（`@/lib/briefs/wizard`）、`btn`、`cardPad`、`Notice`。

- [ ] **Step 5：招募列表與動作**
  - `src/app/brand/briefs/page.tsx`：頁首 `PageHeader title="我的招募" action={<Link href="/brand/briefs/new" className={btn.primary}>刊登招募</Link>}`；分頁標籤 `chip(active)`；列表外框 `rows`、每列 `row`；空狀態 `<EmptyState text="還沒有招募。刊登第一個招募，讓創作者來報名。" action={{ href: "/brand/briefs/new", label: "刊登招募" }} />`（各分頁文字依原本的空狀態文字，只有「全部／草稿」顯示動作）。
  - `BriefOwnerActions.tsx`：「發佈」連結 `btn.primary`；「編輯」`btn.secondary`；「關閉招募」與「刪除草稿」的 `ConfirmAction` 加 `icon="ban"`／`icon="trash"`，label 改「關閉招募」「刪除草稿」。
  - `new/page.tsx`、`[id]/edit/page.tsx`：h1 改 `PageHeader`（back 到 `/brand/briefs`）。
  - `CoverField.tsx`：原生檔案欄位換 `FilePicker`（`label={path ? "更換封面" : "選擇封面"}`、`ariaLabel="上傳封面"`，其餘同 Task 6 的 LogoField 寫法）。
  - `ChipMultiSelect.tsx`、`CategoryPicker.tsx`：按鈕 class 換成 `chip(on)`（`h-11`），外層 `flex flex-wrap gap-2`。

- [ ] **Step 6：創作者廣場（QA p2、p3、m7、m8）**
  - `SquareView.tsx`：`router.replace(squareHref(next), { scroll: false })` 改 `router.push(...)`（上一頁逐步退回篩選）；手機的「篩選／排序」列外層加 `sticky top-0 z-10 -mx-4 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0`；排序 `<select>` class 換 `input`（16px）。
  - `SquareResults.tsx`：卡片格線 `grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3`；空狀態換 `EmptyState`（文字沿用）；「載入更多」→ `btn.secondary`；錯誤 → `ErrorText`。
  - `CreatorCard.tsx`（手機兩欄緊湊卡）：
    - 封面：`aspect-[3/1]` → `aspect-[4/3] sm:aspect-[3/1]`；手機只顯示第一張作品：`thumbs` 的 `<img>` 第 2、3 張加 `hidden sm:block`，格線 class 改成 ``grid-cols-1 ${THUMB_COLS_SM[thumbs.length]}``（`THUMB_COLS_SM = ["", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3"]`）。沒有作品時的大字母底 `bg-subtle`。
    - 內容：`p-5 gap-4` → `p-3 gap-3 sm:p-5 sm:gap-4`；頭像在手機隱藏（`<div className="hidden sm:block"><Avatar … /></div>`），名字 `text-sm sm:text-base`。
    - 數據：手機只顯示粉絲與互動率（起價那格加 `hidden sm:block`，格線 `grid-cols-2 sm:grid-cols-3`）。
    - 標籤列 `hidden sm:flex`；標籤底色 `bg-subtle`。
    - 外框 `hover:border-ink` → `hover:border-line-strong`。
  - `FilterPanel.tsx`：標籤 class 換 `chip(on)`；`FilterDrawer.tsx`：`backdrop:bg-ink/40` → `backdrop:bg-bg/70`，關閉按鈕 `btn.icon`，「查看 N 位創作者」`btn.primary w-full`。
  - `CreatorTable.tsx`：列 hover `hover:bg-subtle`；連結 44px（`inline-flex min-h-11 items-center`）。
  - `src/app/brand/page.tsx`：h1 → `PageHeader title="創作者廣場"`。

- [ ] **Step 7：品牌設定**：`BrandSettingsForm.tsx` 表單 `noValidate`、送出 `btn.primary`、外框 `cardPad`、成功訊息 `Notice tone="success"`（下次 `onChange` 時清掉）、錯誤 `ErrorText`；`settings/page.tsx` 的 h1 → `PageHeader title="品牌設定"`。

- [ ] **Step 8：檢查、截圖、Commit**

```bash
npm run lint && npm run typecheck && npm test
# 主要按鈕不應再是反白膠囊（選中標籤除外）；預期沒有輸出
grep -rnE "className=\{?[\"\`][^\"\`]*\bbg-ink\b[^\"\`]*text-on-ink" src/components/briefs src/components/square src/components/forms src/app/brand | grep -vE "border-ink bg-ink|chip\(|aria-current"
npm run build   # 截圖（品牌測試帳號）：/brand（390 兩欄卡、1280）、/brand/briefs、/brand/briefs/new 第 1、3 步、/brand/briefs/[有報名者] 展開「婉拒報名」確認、/brand/settings；390／1280 × 深／淺
git add src/lib/briefs src/lib/validation/brief.ts src/lib/validation/brief.test.ts src/components/briefs src/components/forms \
  src/components/square src/app/brand
git commit -m "UI 升級 Task 8：品牌頁面改版；婉拒報名要確認、報名者篩選寫進網址、招募精靈步驟可點與上一頁、空白不能存草稿、廣場手機兩欄"
```

---

### Task 9: 創作者頁面（機會、我的、收款帳戶提醒、狀態橫幅）

**Files:**
- Create: `src/lib/creators/payout-prompt.ts`、`payout-prompt.test.ts`、`src/lib/creators/payout-status.ts`、`src/components/collabs/PayoutPrompt.tsx`、`src/components/ui/CopyButton.tsx`、`src/components/forms/useUnsavedChanges.ts`、`src/components/forms/UnsavedBadge.tsx`、`src/app/creator/briefs/[id]/not-found.tsx`
- Modify: `src/app/creator/page.tsx`、`src/app/creator/StatusBanner.tsx`、`src/app/creator/ResubmitButton.tsx`、`src/components/briefs/OpportunityCard.tsx`、`OpportunityFilters.tsx`、`OpportunityResults.tsx`、`MyApplicationList.tsx`、`ApplyPanel.tsx`、`BriefDetailView.tsx`、`src/app/creator/me/page.tsx`（重寫）、`src/app/creator/me/profile/page.tsx`（改成導向）、`PublicProfileForm.tsx`、`PortfolioForm.tsx`、`RatesForm.tsx`、`src/app/creator/me/CreatorSettingsForm.tsx`、`src/app/creator/me/payout/page.tsx`、`PayoutAccountForm.tsx`、`src/app/creator/me/actions.ts`（只改文字）

- [ ] **Step 1：收款帳戶提醒的純函式與測試（QA m19）**

```ts
// src/lib/creators/payout-prompt.ts
import type { CollabStatus } from "@/lib/collabs/view";

/** 品牌已付款、還沒撥款的狀態：這時候沒有收款帳戶，之後平台就無法撥款。 */
const PAID_OPEN: readonly CollabStatus[] = ["awaiting_submission", "in_review", "awaiting_publish", "awaiting_payout"];

export function needsPayoutPrompt(status: CollabStatus, hasPayoutAccount: boolean): boolean {
  return !hasPayoutAccount && PAID_OPEN.includes(status);
}

export function anyNeedsPayoutPrompt(statuses: CollabStatus[], hasPayoutAccount: boolean): boolean {
  return statuses.some((s) => needsPayoutPrompt(s, hasPayoutAccount));
}
```

```ts
// src/lib/creators/payout-prompt.test.ts
import { describe, expect, it } from "vitest";
import { anyNeedsPayoutPrompt, needsPayoutPrompt } from "./payout-prompt";

describe("needsPayoutPrompt", () => {
  it("已付款到撥款前、沒有帳戶時提醒", () => {
    for (const s of ["awaiting_submission", "in_review", "awaiting_publish", "awaiting_payout"] as const) {
      expect(needsPayoutPrompt(s, false)).toBe(true);
      expect(needsPayoutPrompt(s, true)).toBe(false);
    }
  });
  it("付款前與結束後不提醒", () => {
    for (const s of ["invited", "awaiting_payment", "completed", "declined", "cancelled"] as const) expect(needsPayoutPrompt(s, false)).toBe(false);
  });
  it("任何一個合作案需要就提醒", () => {
    expect(anyNeedsPayoutPrompt(["invited", "in_review"], false)).toBe(true);
    expect(anyNeedsPayoutPrompt(["invited"], false)).toBe(false);
  });
});
```

```ts
// src/lib/creators/payout-status.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

/** 創作者本人有沒有收款帳戶（RLS 只讓本人讀自己的列；只選 user_id，不碰帳號欄位）。呼叫前要先 requireRole("creator")。 */
export async function loadHasPayoutAccount(uid: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("creator_payout_accounts").select("user_id", { count: "exact", head: true }).eq("user_id", uid);
  if (error) throw error;
  return (count ?? 0) > 0;
}
```

- [ ] **Step 2：`src/components/collabs/PayoutPrompt.tsx`**

```tsx
import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { btn } from "@/components/ui/styles";

/** 沒有收款帳戶的提醒（QA m19）：合作案行動卡上方與機會頁頂部。 */
export function PayoutPrompt() {
  return (
    <Notice tone="warning" title="還沒有收款帳戶，平台無法撥款給你">
      <p>填好帳戶後，合作完成就會全額撥款。只有你和平台看得到，品牌看不到。</p>
      <Link href="/creator/me/payout" className={`${btn.secondary} mt-3`}>設定收款帳戶</Link>
    </Notice>
  );
}
```

- [ ] **Step 3：機會頁（創作者首頁）**：`src/app/creator/page.tsx` 在讀資料的 Suspense 內容（已 `requireRole("creator")`）加：

```tsx
  const [active, hasAccount] = await Promise.all([loadMyCollabs("active"), loadHasPayoutAccount(me.id)]);
  // …原本的內容前面：
  {anyNeedsPayoutPrompt(active.map((c) => c.status), hasAccount) && <div className="mb-6"><PayoutPrompt /></div>}
```

（`CollabListItem` 的狀態欄位名稱以 `lib/collabs/view.ts` 為準。）h1 → `PageHeader title="機會"`。

- [ ] **Step 4：狀態橫幅（QA M4、p9）**

`src/components/ui/CopyButton.tsx`：

```tsx
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
```

`src/app/creator/StatusBanner.tsx` 整個換成：

```tsx
import type { CurrentUser } from "@/lib/auth/current-user";
import { CopyButton } from "@/components/ui/CopyButton";
import { Notice } from "@/components/ui/Notice";
import { SupportLink } from "@/components/ui/SupportLink";
import { ResubmitButton } from "./ResubmitButton";

function Code({ code }: { code: string }) {
  return (
    <span className="mt-2 inline-flex flex-wrap items-center gap-2">
      <b className="rounded-input border border-line-strong bg-surface px-3 py-1 font-mono text-base tracking-[0.3em] text-ink">{code}</b>
      <CopyButton text={code} label="複製驗證碼" />
    </span>
  );
}

export function StatusBanner({ me }: { me: CurrentUser }) {
  const s = me.creator?.status;
  if (s === "pending") {
    return (
      <Notice tone="info" title="審核中，通常 1–2 個工作天" className="mb-6">
        {me.verificationCode && (
          <>
            <p>請把驗證碼暫時加到 IG 自我介紹，審核通過後就可以刪掉。</p>
            <Code code={me.verificationCode} />
          </>
        )}
      </Notice>
    );
  }
  if (s === "rejected") {
    return (
      <Notice tone="danger" title="審核沒有通過，請修正後重新送審" className="mb-6">
        {me.creator?.reviewNote && <p className="whitespace-pre-wrap break-words">原因：{me.creator.reviewNote}</p>}
        {me.verificationCode && (<><p className="mt-1">驗證碼要在 IG 自我介紹裡。</p><Code code={me.verificationCode} /></>)}
        <div className="mt-3"><ResubmitButton /></div>
      </Notice>
    );
  }
  if (s === "suspended") {
    return (
      <Notice tone="danger" title="帳號已暫停" className="mb-6">
        {me.creator?.reviewNote && <p className="whitespace-pre-wrap break-words">原因：{me.creator.reviewNote}</p>}
        <p className="mt-1">暫停期間不能報名、接案或傳訊息。對暫停有疑問，請聯絡客服：</p>
        <SupportLink subject="帳號暫停" />
      </Notice>
    );
  }
  return null;
}
```

`ResubmitButton.tsx` 的按鈕 → `btn.primary`。`src/app/creator/me/actions.ts` 的「帳號目前暫停中，請聯絡客服」維持（文字含「聯絡客服」，顯示處改用 `ErrorText` 時會自動接上聯絡方式）。

- [ ] **Step 5：機會卡片與篩選（QA m18、m7）**
  - `OpportunityCard.tsx`：狀態膠囊文字 `{o.myStatus === "withdrawn" ? "已撤回" : "你已報名"}`；報名人數那格：

    ```tsx
          <div><dt className="sr-only">報名人數</dt><dd className="text-muted">{formatNumber(o.applicantCount)} 人報名</dd></div>
    ```

    外框 `hover:border-ink` → `hover:border-line-strong`。
  - `OpportunityFilters.tsx`：標籤換 `chip(active)`；外層 `-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0`（手機單列可橫捲）。
  - `OpportunityResults.tsx`、`MyApplicationList.tsx`：空狀態 `EmptyState`（「還沒有符合的機會。換個篩選條件試試。」／「還沒有報名。看看最新的機會。」＋`{ href: "/creator", label: "看機會" }`）；「載入更多」`btn.secondary`。
  - `ApplyPanel.tsx`：送出 `btn.primary`、輸入 `input`／`textarea`、「撤回報名」的 `ConfirmAction` 加 `icon="undo"`、label「撤回報名」。
  - `BriefDetailView.tsx`：標題 `font-serif`、酬勞 `text-accent`（Task 1 已換）。

- [ ] **Step 6：已結束的招募（QA m3）**：`src/app/creator/briefs/[id]/not-found.tsx`

```tsx
import Link from "next/link";
import { ThreadMark } from "@/components/ui/ThreadMark";
import { btn, h1 } from "@/components/ui/styles";

/** 招募關閉、過期、還是草稿或不存在：創作者看不到內容（RLS），一律說「已結束或不存在」。 */
export default function BriefNotFound() {
  return (
    <div className="mx-auto mt-6 flex max-w-md flex-col items-center rounded-card border border-line bg-surface p-8 text-center">
      <ThreadMark variant="broken" />
      <h1 className={`${h1} mt-4`}>這則招募已結束或不存在</h1>
      <p className="mt-2 text-sm text-muted">品牌可能已經關閉招募，或連結有誤。看看其他正在招募的機會吧。</p>
      <Link href="/creator" className={`${btn.primary} mt-6`}>看其他機會</Link>
    </div>
  );
}
```

- [ ] **Step 7：未儲存提示（QA m11）**

```ts
// src/components/forms/useUnsavedChanges.ts
"use client";
import { useEffect } from "react";

/** 有未儲存的變更時，離開頁面前請瀏覽器提示（不能自訂文字）。 */
export function useUnsavedChanges(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
```

```tsx
// src/components/forms/UnsavedBadge.tsx
/** 段落標題旁的「尚未儲存」：點＋文字，不只靠顏色。 */
export function UnsavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-xs font-bold text-accent">
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />尚未儲存
    </span>
  );
}
```

- [ ] **Step 8：「我的」合併成一頁（QA m11、m12）**

`src/app/creator/me/page.tsx` 整個換成：

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { loadOwnPublicProfile } from "@/lib/creators/own-profile";
import { loadHasPayoutAccount } from "@/lib/creators/payout-status";
import { HelpLink } from "@/components/shell/HelpLink";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { ThemeSelect } from "@/components/theme/ThemeSelect";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { btn } from "@/components/ui/styles";
import { CreatorSettingsForm } from "./CreatorSettingsForm";
import { PortfolioForm } from "./profile/PortfolioForm";
import { ProfileAndRates } from "./profile/ProfileAndRates";

export const metadata: Metadata = { title: "我的" };

const SECTIONS = [
  { id: "profile", label: "公開頁" },
  { id: "portfolio", label: "作品" },
  { id: "account", label: "帳號" },
  { id: "payout", label: "收款帳戶" },
];

export default function CreatorMePage() {
  return (
    <>
      <PageHeader title="我的" description="這裡的資料會出現在你的公開頁；報價只有品牌看得到。" />
      <nav aria-label="本頁段落" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="inline-flex h-11 shrink-0 items-center rounded-btn border border-line-strong px-4 text-sm font-bold text-ink hover:bg-subtle">{s.label}</a>)}
      </nav>
      <Suspense fallback={<div className="space-y-6"><Skeleton className="h-96 w-full" /><Skeleton className="h-64 w-full" /></div>}>
        <Editor />
      </Suspense>
      <section aria-labelledby="look-title" className="mt-10 max-w-xl space-y-3 border-t border-line pt-6">
        <h2 id="look-title" className="text-lg font-bold text-ink">外觀與帳號</h2>
        <ThemeSelect />
        <div className="flex flex-wrap gap-2"><HelpLink /><SignOutButton /></div>
      </section>
    </>
  );
}

async function Editor() {
  const me = await requireRole("creator");
  if (!me.creator || !me.profile) return null;
  const c = me.creator;
  const [own, hasAccount] = await Promise.all([loadOwnPublicProfile(me.id), loadHasPayoutAccount(me.id)]);
  return (
    <div className="space-y-10">
      <section id="profile" aria-labelledby="profile-title" className="scroll-mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="profile-title" className="font-serif text-2xl font-bold text-ink">公開頁</h2>
          <Link href={`/c/${c.handle}`} className={btn.secondary}>預覽公開頁</Link>
        </div>
        <ProfileAndRates userId={me.id} displayName={me.profile.displayName} profile={own.profile} rates={own.rates} />
      </section>
      <section id="portfolio" aria-labelledby="portfolio-title" className="scroll-mt-6 space-y-4">
        <h2 id="portfolio-title" className="font-serif text-2xl font-bold text-ink">作品</h2>
        <PortfolioForm userId={me.id} initial={own.portfolio} />
      </section>
      <section id="account" aria-labelledby="account-title" className="scroll-mt-6 space-y-4">
        <h2 id="account-title" className="font-serif text-2xl font-bold text-ink">帳號</h2>
        <CreatorSettingsForm
          displayName={me.profile.displayName} handle={c.handle} igUsername={c.igUsername}
          followerCount={c.followerCount} region={c.region} categories={c.categories}
          handleEditable={!c.handleLocked}
        />
      </section>
      <section id="payout" aria-labelledby="payout-title" className="scroll-mt-6 space-y-3">
        <h2 id="payout-title" className="font-serif text-2xl font-bold text-ink">收款帳戶</h2>
        {hasAccount
          ? <Notice tone="success">已設定收款帳戶。</Notice>
          : <Notice tone="warning">還沒有收款帳戶。合作完成後平台需要它才能撥款。</Notice>}
        <Link href="/creator/me/payout" className={btn.secondary}>{hasAccount ? "查看或修改" : "設定收款帳戶"}</Link>
      </section>
    </div>
  );
}
```

（顯示名稱同時出現在 `CreatorSettingsForm` 與 `PublicProfileForm` 的情況：維持現有兩個表單各自的欄位，不搬動資料流程；本次只合併頁面。）

新檔 `src/app/creator/me/profile/ProfileAndRates.tsx`（client，讓勾選合作形式即時影響報價段落）：

```tsx
"use client";

import { useState } from "react";
import type { Rate } from "@/lib/creators/view";
import type { OwnPublicProfile } from "@/lib/creators/own-profile";
import { PublicProfileForm } from "./PublicProfileForm";
import { RatesForm } from "./RatesForm";

/**
 * 公開頁與報價同一段（QA m12）：PublicProfileForm 勾選合作形式時回報目前勾選（live），
 * RatesForm 依 live 顯示欄位；已儲存的形式（saved）才能填（資料庫依已儲存的合作形式檢查報價）。
 */
export function ProfileAndRates({ userId, displayName, profile, rates }: {
  userId: string; displayName: string; profile: OwnPublicProfile["profile"]; rates: Rate[];
}) {
  const [live, setLive] = useState<string[]>(profile.collabTypes);
  return (
    <div className="space-y-4">
      <PublicProfileForm userId={userId} displayName={displayName} initial={profile} onCollabTypesChange={setLive} />
      <RatesForm collabTypes={live} savedCollabTypes={profile.collabTypes} initial={rates} />
    </div>
  );
}
```

（`OwnPublicProfile` 若 `own-profile.ts` 沒有匯出這個型別，就在該檔加 `export type OwnPublicProfile = Awaited<ReturnType<typeof loadOwnPublicProfile>>;`。）

`PublicProfileForm.tsx`：
  - props 加 `onCollabTypesChange?: (types: string[]) => void`，合作形式勾選的 `onChange` 裡呼叫它。
  - `const dirty = JSON.stringify(currentValues) !== JSON.stringify(savedValues)`（`currentValues` 是表單的受控 state；`savedValues` 在 `state.ok` 時更新成當下值）；標題列加 `<UnsavedBadge show={dirty} />`；`useUnsavedChanges(dirty)`。
  - 頭像上傳即儲存：`AvatarField` 加 prop `onUploaded?: () => void`（上傳成功、`setPath` 之後呼叫）；這裡傳 `() => formRef.current?.requestSubmit()`（`formRef` 指向這個表單）。
  - 「已儲存」訊息：只在最近一次送出成功、且之後沒有任何 `onChange` 時顯示（`onChange` 裡 `setShowSaved(false)`；錯誤出現時也清掉）。
  - 送出 `btn.primary`；外框 `cardPad`。

`RatesForm.tsx`：
  - props 改成 `{ collabTypes: string[]; savedCollabTypes: string[]; initial: Rate[] }`。
  - `collabTypes.length === 0` 的說明改「先在上方勾選想接的合作形式。」
  - 每個形式：若 `!savedCollabTypes.includes(t)`，輸入框 `disabled` 並在下方寫「按上方『儲存』後就能填這個報價」。
  - 儲存成功後（`router.refresh()` 由既有 action／元件處理；若沒有，在 `state.ok` 時 `router.refresh()`），`savedCollabTypes` 會更新。
  - `parseRatesForm` 只讀已儲存的形式（伺服器端不變），所以停用的欄位不會被送出也不會造成錯誤。
  - 送出 `btn.primary`；外框 `cardPad`；`UnsavedBadge`＋`useUnsavedChanges`。

`PortfolioForm.tsx`：
  - 檔案欄位換 `FilePicker`（`label="新增作品圖片"`、`ariaLabel="上傳作品圖片"`）；上傳成功後 `formRef.current?.requestSubmit()`（上傳即儲存）。
  - 上移／下移／刪除改成 44px 圖示按鈕：`btn.icon`＋`ArrowUp`／`ArrowDown`／`Trash2`，各自 `<span className="sr-only">上移第 n 個作品</span>` 等。
  - `smallBtn` 常數刪除。`UnsavedBadge`（作品說明文字改了但還沒存時）。

`CreatorSettingsForm.tsx`：`noValidate`、送出 `btn.primary`、`UnsavedBadge`＋`useUnsavedChanges`、成功訊息同上規則、錯誤 `ErrorText`。

`src/app/creator/me/profile/page.tsx` 整個換成（舊連結不壞）：

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "公開頁" };

/** 公開頁編輯已併入「我的」（QA m12）。 */
export default function CreatorProfileEditPage() {
  return (
    <Suspense fallback={null}>
      <Go />
    </Suspense>
  );
}

async function Go(): Promise<null> {
  await requireRole("creator");
  redirect("/creator/me#profile");
}
```

`grep -rn "/creator/me/profile" src` 找出其他連結，改成 `/creator/me#profile`。

- [ ] **Step 9：收款帳戶頁**：`payout/page.tsx` 頁首 `PageHeader title="收款帳戶" back={{ href: "/creator/me", label: "我的" }}`；資料卡 `cardPad`。`PayoutAccountForm.tsx`：表單 `noValidate`、移除 `pattern`／`required`，送出前用 `src/lib/payout-account.ts` 既有的驗證函式產生繁中欄位錯誤（QA m6），輸入 `input`，送出 `btn.primary`，錯誤 `Field` 的 `error`。

- [ ] **Step 10：檢查、截圖、Commit**

```bash
npm run lint && npm run typecheck && npm test
npm run build   # 截圖（創作者測試帳號）：/creator（含收款帳戶提醒）、/creator/me（四段、未儲存標記）、/creator/me/payout、/creator/briefs/<關閉的招募 id>、停權帳號的 /creator；390／1280 × 深／淺
git add src/lib/creators src/components/collabs/PayoutPrompt.tsx src/components/ui/CopyButton.tsx src/components/forms \
  src/components/briefs src/app/creator
git commit -m "UI 升級 Task 9：創作者頁面；「我的」合併成一頁（未儲存提示、上傳即儲存）、收款帳戶提醒、停權橫幅接客服、已結束招募頁"
```

---

### Task 10: 合作案（紅線進度條、確認、金額上限、付款返回自動更新）

**Files:**
- Create: `src/lib/payments/poll.ts`、`poll.test.ts`、`src/components/collabs/PaymentStatusPoller.tsx`、`src/app/brand/collabs/[id]/not-found.tsx`、`src/app/creator/collabs/[id]/not-found.tsx`
- Modify: `src/lib/validation/collab.ts`、`src/lib/validation/collab.test.ts`、`src/app/brand/briefs/actions.ts`、`src/app/brand/collabs/actions.ts`（只改 `parseOfferForm` 的呼叫端若需要；見 Step 2）、`src/components/collabs/Stepper.tsx`（重寫）、`ActionCard.tsx`、`CollabActions.tsx`、`OfferForm.tsx`、`PublishForm.tsx`、`RevisionForm.tsx`、`SubmitPanel.tsx`、`SubmissionList.tsx`、`FileTile.tsx`、`CollabHeader.tsx`、`CollabList.tsx`、`EventList.tsx`、`CollabDetail.tsx`、`CollabPages.tsx`、`CollabStatusBadge.tsx`、`src/lib/collabs/load.ts`（只改 `fileLabel` 的呼叫）、`src/lib/deliverables.ts`、`src/lib/deliverables.test.ts`

- [ ] **Step 1：測試先行**

`src/lib/validation/collab.test.ts` 加：

```ts
import { PAYMENT_MAX_TWD } from "@/lib/payments/limits";
import { exceedsOnlineLimit, validateOffer } from "./collab";

describe("金額超過線上付款上限（QA M2）", () => {
  const base = { title: "夏季合作", deliverables: "IG 貼文 1 篇", amount: "", offlineAck: false };
  it("上限以內不需要確認", () => {
    expect(exceedsOnlineLimit(PAYMENT_MAX_TWD)).toBe(false);
    expect(validateOffer({ ...base, amount: String(PAYMENT_MAX_TWD) }, true)).toBeNull();
  });
  it("超過上限要勾選「我了解這筆要線下付款」", () => {
    expect(exceedsOnlineLimit(PAYMENT_MAX_TWD + 1)).toBe(true);
    expect(validateOffer({ ...base, amount: "250000" }, true)?.offlineAck).toBe("超過線上付款上限，請勾選確認這筆要線下付款");
    expect(validateOffer({ ...base, amount: "250000", offlineAck: true }, true)).toBeNull();
  });
});
```

（既有呼叫 `validateOffer({ title, deliverables, amount }, …)` 的測試加上 `offlineAck: false`。）

`src/lib/payments/poll.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { nextPollDelay, POLL_MAX_ATTEMPTS } from "./poll";

describe("付款返回後的自動更新節奏", () => {
  it("每 5 秒，最多 36 次（3 分鐘）", () => {
    expect(nextPollDelay(0)).toBe(5000);
    expect(nextPollDelay(35)).toBe(5000);
    expect(nextPollDelay(POLL_MAX_ATTEMPTS)).toBeNull();
    expect(POLL_MAX_ATTEMPTS * 5000).toBe(180_000);
  });
});
```

`src/lib/deliverables.test.ts`：`fileLabel` 的斷言改成新簽名（Step 2）：

```ts
  it("fileLabel：第 n 次交稿・種類 序號（QA p5 的無障礙名稱）", () => {
    expect(fileLabel("u/c/abc.jpg", 0, 2)).toBe("第 2 次交稿・圖片 1");
    expect(fileLabel("u/c/abc.pdf", 2, 1)).toBe("第 1 次交稿・PDF 3");
  });
```

（`KIND_LABEL` 的實際文字以檔案為準，例如圖片是「圖片」。）

- [ ] **Step 2：實作**

`src/lib/validation/collab.ts`：

```ts
import { PAYMENT_MAX_TWD } from "@/lib/payments/limits";

/** 超過線上付款上限（綠界單筆 PAYMENT_MAX_TWD）：建立可以，但之後只能由平台協助線下付款。 */
export function exceedsOnlineLimit(amount: number | null): boolean {
  return amount !== null && amount > PAYMENT_MAX_TWD;
}

export type OfferInput = { title: string; deliverables: string; amount: string; offlineAck: boolean };

export function parseOfferForm(fd: FormData): OfferInput {
  return {
    title: cleanText(str(fd, "title")),
    deliverables: cleanLongText(str(fd, "deliverables")),
    amount: str(fd, "amount"),
    offlineAck: str(fd, "offlineAck") === "1",
  };
}
```

`validateOffer` 的金額那行後面加：

```ts
  else if (exceedsOnlineLimit(parseAmount(i.amount)) && !i.offlineAck) e.offlineAck = "超過線上付款上限，請勾選確認這筆要線下付款";
```

（把原本的 `if (parseAmount(i.amount) === null) e.amount = …` 改成 `if … else if …` 的寫法。）錄取與邀約的 Server Action（`acceptApplicationAction`、`inviteCreatorAction`）已經用 `parseOfferForm` → `validateOffer`，不用改；確認它們回傳 `fieldErrors` 時包含 `offlineAck`（`OfferState.fieldErrors` 是 `Record<string,string>`，可以）。

`src/lib/payments/poll.ts`：

```ts
/** 從綠界付款頁回來後，每 5 秒重新整理一次合作案，最多 3 分鐘（綠界通知通常幾秒到幾分鐘）。 */
export const POLL_INTERVAL_MS = 5000;
export const POLL_MAX_ATTEMPTS = 36;

export function nextPollDelay(attempt: number): number | null {
  return attempt < POLL_MAX_ATTEMPTS ? POLL_INTERVAL_MS : null;
}
```

`src/lib/deliverables.ts`：

```ts
/** 檔案的名稱（圖片 alt、連結名稱）：「第 n 次交稿・種類 序號」。 */
export function fileLabel(path: string, index: number, round: number): string {
  return `第 ${round} 次交稿・${KIND_LABEL[fileKindOf(path)]} ${index + 1}`;
}
```

`src/lib/collabs/load.ts`：`fileLabel(p, i)` → `fileLabel(p, i, s.round)`。

- [ ] **Step 3：`src/components/collabs/Stepper.tsx` 整個換成（紅線與結，規格 §9.7；修 m17 用語）**

```tsx
import { COLLAB_STATUS_LABEL, COLLAB_STEPS, stepNumber, stepStates, type CollabStatus } from "@/lib/collabs/view";

/**
 * 合作進度：一條紅線穿過 7 個結。已完成的段是實線紅、未完成是虛線；已完成的結實心、目前的結較大並有光暈、之後空心。
 * 所有尺寸都顯示「目前：狀態名稱・第 n / 7 步」（前台、後台用語一致）。手機不顯示每一步的標籤。
 */
export function Stepper({ status }: { status: CollabStatus }) {
  const states = stepStates(status);
  const n = stepNumber(status);
  if (!states || n === null) return null;
  const total = COLLAB_STEPS.length;
  const done = status === "completed";
  return (
    <section aria-label="合作進度" className="rounded-card border border-line bg-surface p-4 md:p-6">
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-bold text-ink">目前：{COLLAB_STATUS_LABEL[status]}</span>
        <span className="tabular-nums text-muted">{done ? "全部完成" : `第 ${n} / ${total} 步`}</span>
      </p>
      <ol className="mt-4 flex items-start">
        {COLLAB_STEPS.map((label, i) => {
          const s = states[i];
          const leftDone = i > 0 && states[i - 1] !== "todo" && s !== "todo";
          const rightDone = i < total - 1 && s === "done";
          return (
            <li key={label} aria-current={s === "current" ? "step" : undefined} className="flex min-w-0 flex-1 flex-col items-center text-center">
              <div className="flex h-6 w-full items-center">
                <span aria-hidden="true" className={`flex-1 ${i === 0 ? "" : leftDone ? "h-0.5 bg-thread" : "border-t border-dashed border-line-strong"}`} />
                <span
                  aria-hidden="true"
                  className={`shrink-0 rounded-full ${
                    s === "done" ? "h-3 w-3 bg-thread"
                      : s === "current" ? "h-4 w-4 bg-primary ring-[6px] ring-primary-soft motion-safe:animate-[knot_600ms_ease-out_1]"
                        : "h-3 w-3 border-2 border-line-strong bg-surface"
                  }`}
                />
                <span aria-hidden="true" className={`flex-1 ${i === total - 1 ? "" : rightDone ? "h-0.5 bg-thread" : "border-t border-dashed border-line-strong"}`} />
              </div>
              <span className={`mt-2 hidden px-0.5 text-xs md:block ${s === "todo" ? "text-muted" : s === "current" ? "font-bold text-ink" : "text-ink"}`}>
                {label}
              </span>
              <span className="sr-only">{label}{s === "done" ? "（已完成）" : s === "current" ? "（目前）" : ""}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
```

`globals.css` 加（目前的結點亮時光暈擴散一次）：

```css
@keyframes knot {
  from { box-shadow: 0 0 0 0 var(--color-primary-soft); }
  to { box-shadow: 0 0 0 14px transparent; }
}
```

- [ ] **Step 4：行動卡與動作（QA M3、M2、m19、p6）**

`ActionCard.tsx`：
  - props 加 `hasPayoutAccount: boolean`。
  - 外框：`copy.mine` 時 `border-primary bg-primary-soft`（紅線語意：輪到你），否則 `border-line bg-surface`；`border-2` → `border`。
  - h2 前加：`{side === "creator" && needsPayoutPrompt(c.status, hasPayoutAccount) && <div className="mb-4"><PayoutPrompt /></div>}`
  - `copy.body`：創作者在 `awaiting_payout` 且沒有帳戶時改顯示「平台撥款前需要你的收款帳戶，請先設定。」（其餘照 `actionCardCopy`）。
  - 貼文連結 `textLink` 樣式但保留 `break-all`。

`CollabDetail.tsx`：props 加 `hasPayoutAccount: boolean` 並傳給 `ActionCard`；在 `<ActionCard>` 之前加 `{side === "brand" && c.status === "awaiting_payment" && summary.recentCreditPending && <PaymentStatusPoller />}`。

`CollabPages.tsx` 的 `CollabDetailSection`：

```tsx
  const hasPayoutAccount = side === "creator" ? await loadHasPayoutAccount(me.id) : true;
  …
    <CollabDetail … hasPayoutAccount={hasPayoutAccount} />
```

`src/components/collabs/PaymentStatusPoller.tsx`：

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { nextPollDelay } from "@/lib/payments/poll";
import { btn } from "@/components/ui/styles";

/** 從綠界回來、款項確認中：每 5 秒重新整理（分頁隱藏時跳過），最多 3 分鐘；付款確認後頁面狀態改變，這個元件就不再渲染。 */
export function PaymentStatusPoller() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const delay = nextPollDelay(attempt);

  useEffect(() => {
    if (delay === null) return;
    const t = window.setTimeout(() => {
      if (!document.hidden) router.refresh();
      setAttempt((a) => a + 1);
    }, delay);
    return () => window.clearTimeout(t);
  }, [attempt, delay, router]);

  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-input border border-line bg-subtle p-4 text-sm text-ink">
      <span className="flex items-center gap-2">
        <RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" className={delay !== null ? "motion-safe:animate-spin" : ""} />
        {delay !== null ? "正在確認付款…確認後頁面會自動更新。" : "還沒收到付款確認。綠界有時需要幾分鐘，可以稍後再重新整理。"}
      </span>
      <button type="button" onClick={() => { setAttempt(0); router.refresh(); }} className={btn.secondary}>重新整理</button>
    </div>
  );
}
```

`CollabActions.tsx`：
  - `const primary = …` 刪除，所有用到的地方改 `` `${btn.primary} w-full sm:w-auto` ``。
  - **接受邀約加確認**（`InviteReply`）：

    ```tsx
        <ConfirmAction
          label={fromApplication ? "接受條件" : "接受邀約"} icon="check" block confirmLabel="確定接受"
          message="接受後品牌就可以付款；付款後只有平台能取消這個合作案。確定要接受嗎？"
          onConfirm={() => creatorCollabAction(collabId, "accept")}
        />
        <ConfirmAction label="婉拒" danger icon="x" confirmLabel="確定婉拒" message={…原文…} onConfirm={…原本…} />
    ```

    （`useCollabAction`／`Feedback` 在 `InviteReply` 不再需要時刪掉。）
  - **審核通過加確認（M3）**（`Review`）：

    ```tsx
    function Review({ collabId }: { collabId: string }) {
      return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <ConfirmAction
            label="審核通過" icon="check" block confirmLabel="確定通過"
            message="通過後就不能再要求修改；創作者發佈貼文、送出連結後，平台會把款項撥給創作者。確定要通過嗎？"
            onConfirm={() => brandCollabAction(collabId, "approve")}
          />
          <RevisionForm collabId={collabId} />
        </div>
      );
    }
    ```

  - 退出合作、取消合作：`icon="leave"`／`icon="x"`。
  - 測試模式提示（p6）換成 `<Notice tone="info" title="測試模式">目前使用綠界測試環境，不會真的扣款，付款完成也不會撥款給創作者。</Notice>`。
  - `AtmCard`：外框 `rounded-input border border-line-strong bg-subtle`；虛擬帳號旁加 `<CopyButton text={atm.vAccount} label="複製帳號" />`。
  - `PayForm`：radio 外層每個選項 `label` 加 `min-h-11 items-center`；錯誤用 `<ErrorText message={error} subject="付款協助" />`（金額超過上限的錯誤含「請聯絡平台」，會自動接上聯絡方式，M2）；線上付款尚未開放的說明用 `Notice tone="info"`。
  - `Feedback` 的錯誤 → `ErrorText`。
  - `DevMarkPaid` 不動。

`PublishForm.tsx`（送出貼文連結要確認）：把 `<form onSubmit>` 的送出改成先檢查網址、通過後展開確認：

```tsx
export function PublishForm({ collabId }: { collabId: string }) {
  const [url, setUrl] = useState("");
  const [checked, setChecked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  return (
    <div className="w-full space-y-3">
      <form
        noValidate className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = url.trim();
          if (!isValidPostUrl(v)) return setError("請貼上完整的貼文網址（https:// 開頭、含路徑）");
          setError(null);
          setChecked(v);
        }}
      >
        <label htmlFor={id} className="text-sm font-bold text-ink">貼文連結</label>
        <input
          id={id} type="url" inputMode="url" value={url} placeholder="https://www.instagram.com/p/..."
          onChange={(e) => { setUrl(e.target.value); setChecked(null); setError(null); }}
          aria-invalid={error ? true : undefined} className={input}
        />
        {!checked && <button className={`${btn.primary} w-full sm:w-auto`}>下一步：確認連結</button>}
        <ErrorText message={error} />
      </form>
      {checked && (
        <ConfirmAction
          label="送出貼文連結" icon="send" block confirmLabel="確定送出"
          message={`送出後會進入撥款，連結不能再改：${checked}`}
          onConfirm={() => publishCollabAction(collabId, checked)}
        />
      )}
    </div>
  );
}
```

（`ConfirmAction` 一開始是收合的：使用者再按一次「送出貼文連結」才展開說明與「確定送出」。`useCollabAction` 在這裡不再需要。）

`RevisionForm.tsx`：「要求修改」按鈕 `btn.secondary`；textarea `textarea`（16px）；字數即時、超過停用送出。

`SubmitPanel.tsx`：檔案欄位換 `FilePicker`（`label="選擇檔案"`、`multiple`、`ariaLabel="上傳交稿檔案"`），已選檔案列出原始檔名（上傳前的 `File.name`，只在這個畫面）＋「移除」（`btn.ghost`）；上傳中顯示「上傳中 n / 總數」；送出 `btn.primary`。

`SubmissionList.tsx`、`FileTile.tsx`、`EventList.tsx`、`CollabHeader.tsx`：卡片改 `cardPad`／列 `rows`；金額 `font-serif text-2xl font-bold tabular-nums`；`CollabStatusBadge.tsx` 改規格 §9.6 的徽章（進行中用 `bg-subtle` 加紅點、`completed` 用 `success`、`declined`／`cancelled` 中性）。

`CollabList.tsx`：分頁標籤 `chip(active)`；列表 `rows`／`row`；空狀態 `EmptyState`（品牌「還沒有合作案。到創作者廣場邀請第一位創作者。」＋`/brand`「去創作者廣場」；創作者「還沒有合作。看看最新的機會。」＋`/creator`「看機會」）。

`OfferForm.tsx`（M2）：
  - state 加 `const [offlineAck, setOfflineAck] = useState(false);`；`validateOffer({ title: …, deliverables: …, amount, offlineAck }, withTitle)`。
  - 金額欄位下方：

    ```tsx
      {exceedsOnlineLimit(amountPreview) && (
        <Notice tone="warning" title={`超過線上付款上限 ${formatTwd(PAYMENT_MAX_TWD)}`}>
          <p>建立後無法線上付款，需要由平台協助線下匯款。</p>
          <SupportLink subject="線下付款" />
          <label className="mt-3 flex min-h-11 items-center gap-2 font-bold">
            <input type="checkbox" name="offlineAck" value="1" checked={offlineAck} onChange={(e) => setOfflineAck(e.target.checked)}
              aria-invalid={fe.offlineAck ? true : undefined} className="h-5 w-5 accent-primary" />
            我了解這筆要線下付款
          </label>
          {fe.offlineAck && <p className="text-sm text-danger">{fe.offlineAck}</p>}
        </Notice>
      )}
    ```

  - 金額的 hint 改成 `` amountPreview ? `NT$${amountPreview.toLocaleString("en-US")}` : `1 到 10,000,000 的整數（線上付款上限 ${formatTwd(PAYMENT_MAX_TWD)}）` ``。
  - textarea → `textarea` class；送出 `btn.primary`；取消 `btn.secondary`；`formError` 用 `ErrorText`。
  - 「低於創作者的報價…」那行從 `text-danger` 改成 `Notice tone="warning"`（不是錯誤）。

兩個 `not-found.tsx`（`src/app/brand/collabs/[id]/` 與 `src/app/creator/collabs/[id]/`）：

```tsx
import Link from "next/link";
import { ThreadMark } from "@/components/ui/ThreadMark";
import { btn, h1 } from "@/components/ui/styles";

export default function CollabNotFound() {
  return (
    <div className="mx-auto mt-6 flex max-w-md flex-col items-center rounded-card border border-line bg-surface p-8 text-center">
      <ThreadMark variant="broken" />
      <h1 className={`${h1} mt-4`}>找不到這個合作案</h1>
      <p className="mt-2 text-sm text-muted">連結可能有誤，或你不是這個合作案的參與者。</p>
      <Link href="/brand/collabs" className={`${btn.primary} mt-6`}>回合作案列表</Link>
    </div>
  );
}
```

（創作者版的連結是 `/creator/collabs`。）

- [ ] **Step 5：檢查、截圖、Commit**

```bash
npm run lint && npm run typecheck && npm test
npm run build   # 截圖：品牌／創作者的合作案詳情各狀態（invited、awaiting_payment、in_review 展開「審核通過」確認、awaiting_publish 確認連結、awaiting_payout 沒有收款帳戶）、錄取表單金額 250000、合作案列表；390／1280 × 深／淺
git add src/lib/validation/collab.ts src/lib/validation/collab.test.ts src/lib/payments/poll.ts src/lib/payments/poll.test.ts \
  src/lib/deliverables.ts src/lib/deliverables.test.ts src/lib/collabs/load.ts src/components/collabs src/app/globals.css \
  "src/app/brand/collabs/[id]/not-found.tsx" "src/app/creator/collabs/[id]/not-found.tsx"
git commit -m "UI 升級 Task 10：合作案紅線進度條；審核通過／接受邀約／送出連結要確認、金額超過上限要確認線下付款、付款返回自動更新、收款帳戶提醒"
```

---

### Task 11: 訊息

**Files:**
- Modify: `src/lib/messages/view.ts`、`src/lib/messages/view.test.ts`、`src/components/messages/Composer.tsx`、`ThreadHeader.tsx`、`ThreadView.tsx`、`MessageBubble.tsx`、`ConversationList.tsx`、`MessagesPages.tsx`、`MessageButton.tsx`

- [ ] **Step 1：測試先行（`view.test.ts` 加）**

```ts
import { composerKeyAction, listTimeLabel } from "./view";

describe("composerKeyAction（桌面 Enter 送出，QA m13）", () => {
  const k = (key: string, o: Partial<{ shift: boolean; composing: boolean; finePointer: boolean; mod: boolean }> = {}) =>
    composerKeyAction({ key, shift: false, composing: false, finePointer: true, mod: false, ...o });
  it("桌面：Enter 送出、Shift+Enter 換行", () => {
    expect(k("Enter")).toBe("send");
    expect(k("Enter", { shift: true })).toBe("newline");
  });
  it("選字中（注音、倉頡）的 Enter 不送出", () => {
    expect(k("Enter", { composing: true })).toBeNull();
  });
  it("觸控裝置：Enter 換行；Ctrl／⌘+Enter 一律送出", () => {
    expect(k("Enter", { finePointer: false })).toBe("newline");
    expect(k("Enter", { finePointer: false, mod: true })).toBe("send");
  });
  it("其他按鍵不處理", () => {
    expect(k("a")).toBeNull();
  });
});

describe("listTimeLabel：今年以前加年份", () => {
  it("跨年顯示 YYYY/MM/DD", () => {
    expect(listTimeLabel("2025-03-04T04:00:00Z", "2026-11-26")).toBe("2025/03/04");
    expect(listTimeLabel("2026-11-25T15:59:00Z", "2026-11-26")).toBe("11/25");
  });
});
```

- [ ] **Step 2：實作（`src/lib/messages/view.ts`）**

```ts
/** 輸入框按鍵（QA m13）：桌面（精準指標）Enter 送出、Shift+Enter 換行；觸控裝置 Enter 換行；Ctrl／⌘+Enter 一律送出；選字中不處理。 */
export function composerKeyAction(e: { key: string; shift: boolean; composing: boolean; finePointer: boolean; mod: boolean }): "send" | "newline" | null {
  if (e.key !== "Enter" || e.composing) return null;
  if (e.mod) return "send";
  if (e.shift || !e.finePointer) return "newline";
  return "send";
}
```

`listTimeLabel` 改成：

```ts
/** 列表的時間：台灣今天顯示 HH:mm，今年顯示 MM/DD，更早顯示 YYYY/MM/DD。today 是伺服器算好的 YYYY-MM-DD。 */
export function listTimeLabel(iso: string, today: string): string {
  if (Number.isNaN(Date.parse(iso))) return "";
  const t = formatDateTimeTw(iso); // YYYY/MM/DD HH:mm
  if (t.slice(0, 10) === today.replaceAll("-", "/")) return t.slice(11);
  return t.slice(0, 4) === today.slice(0, 4) ? t.slice(5, 10) : t.slice(0, 10);
}
```

- [ ] **Step 3：`Composer.tsx`**
  - `const finePointer = useSyncExternalStore(subscribeFine, () => window.matchMedia("(pointer: fine)").matches, () => true);`（`subscribeFine` 監聽該 media query 的 change）。
  - `onKeyDown`：

    ```ts
        onKeyDown={(e) => {
          const a = composerKeyAction({ key: e.key, shift: e.shiftKey, composing: e.nativeEvent.isComposing, finePointer, mod: e.metaKey || e.ctrlKey });
          if (a === "send") {
            e.preventDefault();
            send(false);
          }
        }}
    ```

  - textarea class → `textarea`（16px，QA m8）加 `max-h-40 min-h-11 resize-none`。
  - 字數：超過 `MESSAGE_BODY_MAX` 時送出按鈕 `disabled`，計數 `text-danger font-bold`；提示文字：桌面 `Enter 送出・Shift + Enter 換行`、觸控不顯示。
  - 聯絡方式警告換 `Notice tone="warning"`，按鈕 `btn.primary`（仍要送出）／`btn.secondary`（修改訊息）。
  - 送出 `btn.primary`；錯誤 `ErrorText`。
  - 外框：`sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))]`（底部導覽改成 56px 高），`md:static`。

- [ ] **Step 4：`ThreadHeader.tsx`** — sticky（QA m13）、停權不連公開頁：
  - `<header>` class：`sticky top-0 z-10 -mx-4 shrink-0 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-card md:border md:bg-surface md:p-4`。
  - 返回連結 `btn.icon -ml-2 md:hidden`。
  - 「查看公開頁」只在 `other.handle && !c.closed` 時顯示（`c.closed` 是暫停對話的既有欄位；若欄位名不同以 `Conversation` 型別為準），連結 `inline-flex min-h-11 items-center text-xs text-muted underline-offset-2 hover:underline`。
  - 合作案膠囊 `bg-subtle`、`min-h-11 inline-flex items-center`。

- [ ] **Step 5：`ThreadView.tsx`、`MessageBubble.tsx`、`ConversationList.tsx`、`MessagesPages.tsx`**
  - `MessageBubble`：自己的訊息 `bg-primary-soft`（紅線語意）、對方 `border border-line bg-surface`；新訊息 `motion-safe:animate-[fade-in_120ms_ease-out]`，`globals.css` 加 `@keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }`。
  - `ThreadView`：所有合作案都已結束（`collabs.every((k) => ["completed", "declined", "cancelled"].includes(k.status))` 且 `collabs.length > 0`）時，在訊息列表上方顯示 `<Notice tone="info">合作已結束，訊息仍會保留。</Notice>`（QA p7）；「還沒有訊息」空狀態用 `EmptyState`（無動作）；「載入較早訊息」`btn.ghost`。
  - `ConversationList`：列 `row`（整列可點、44px 以上），選中 `bg-subtle`；「暫停」膠囊 `bg-subtle`。
  - `MessagesPages`：頁首 `PageHeader title="訊息"`；空列表 `EmptyState`（文字沿用 `EMPTY_LIST_TEXT`）。
  - `MessageButton`：`btn.secondary w-full`。

- [ ] **Step 6：檢查、截圖、Commit**

```bash
npm run lint && npm run typecheck && npm test
npm run build   # 截圖：/brand/messages、/brand/messages/[id]（長對話捲到中間，標頭仍在）、創作者對話（含聯絡方式警告）；390／1280 × 深／淺；
                # 桌面實測：輸入「測試」按 Enter 送出；Shift+Enter 換行；用注音輸入時 Enter 選字不送出（手動）
git add src/lib/messages/view.ts src/lib/messages/view.test.ts src/components/messages src/app/globals.css
git commit -m "UI 升級 Task 11：訊息；桌面 Enter 送出、Shift+Enter 換行、選字不誤送、sticky 標頭、字數即時、跨年日期、合作結束提示"
```

---

### Task 12: 管理後台

**Files:**
- Modify: `src/lib/admin/notes.ts`、`src/lib/admin/notes.test.ts`、`src/components/admin/NoteAction.tsx`、`AdminCollabPanel.tsx`、`LostPaymentForm.tsx`、`CreatorReviewActions.tsx`、`CreatorReviewList.tsx`、`FilterChips.tsx`、`SearchForm.tsx`、`Pagination.tsx`、`PaymentRows.tsx`、`PayoutList.tsx`、`RefundAction.tsx`、`ReviewButton.tsx`、`AnomalyList.tsx`、`AdminCollabList.tsx`、`MfaForm.tsx`、`src/app/admin/(console)/*.tsx`、`src/app/admin/(console)/collabs/[id]/page.tsx`、`src/app/admin/mfa/page.tsx`

- [ ] **Step 1：測試先行（`notes.test.ts` 加）**

```ts
import { amountMatches } from "./notes";

describe("amountMatches（人工標記已付款要核對金額，QA m17）", () => {
  it("去掉千分位與空白後必須等於報價", () => {
    expect(amountMatches("12,000", 12000)).toBe(true);
    expect(amountMatches(" 12000 ", 12000)).toBe(true);
    expect(amountMatches("1200", 12000)).toBe(false);
    expect(amountMatches("", 12000)).toBe(false);
    expect(amountMatches("12000.5", 12000)).toBe(false);
  });
});
```

`src/lib/admin/notes.ts` 加：

```ts
/** 人工標記已付款前的金額核對：只在畫面上擋（伺服器端的 admin_record_* 不變）。 */
export function amountMatches(input: string, expected: number): boolean {
  const d = input.replace(/[,，\s]/g, "");
  return /^\d{1,9}$/.test(d) && Number(d) === expected;
}
```

- [ ] **Step 2：`NoteAction.tsx`** 加可選的金額核對：
  - props 加 `confirmAmount?: number`；state `const [amount, setAmount] = useState("");`。
  - 展開區塊在說明欄位之前加（只有 `confirmAmount !== undefined` 時）：

    ```tsx
          <Field label={`核對金額（應為 ${formatTwd(confirmAmount)}）`} error={amountError ?? undefined}>
            {(c) => <input {...c} inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value); setAmountError(null); }} className={input} />}
          </Field>
    ```

  - `submit()` 開頭：`if (confirmAmount !== undefined && !amountMatches(amount, confirmAmount)) return setAmountError("金額不一致，請確認入帳金額");`
  - 第一顆按鈕：`danger` 時 `btn.danger`＋`XCircle` 圖示，否則 `btn.secondary`；確定按鈕 `danger ? btn.dangerConfirm : btn.primary`；textarea → `textarea`；錯誤 `ErrorText`；展開時焦點移到說明（同 `ConfirmAction`）。

- [ ] **Step 3：`AdminCollabPanel.tsx`**：外框 `border-2 border-ink` → `border border-line-strong`；人工標記已付款的 `NoteAction` 加 `confirmAmount={amount}`；`h3` 用 `text-lg font-bold`。

- [ ] **Step 4：`collabs/[id]/page.tsx`**：只有 `c.status === "awaiting_payment"` 時才算 `lost`（已取消／完成的合作案不顯示「綠界已扣款但沒收到通知」補登，QA m17）：

```ts
  const lost = c.status === "awaiting_payment"
    ? lostPaymentCandidates(payments).map((p) => ({ merchantTradeNo: p.merchantTradeNo, amount: p.amount }))
    : [];
```

頁首 `PageHeader`（back `{ href: "/admin/collabs", label: "合作案" }`）；Stepper 已共用（Task 10 改了用語）。

- [ ] **Step 5：其餘後台元件的類別遷移**（規則，逐檔套用）
  - 篩選標籤（`FilterChips.tsx`）：`chip(active)`；外層 `-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0`。
  - 主要按鈕（核准、送出、標記撥款）：`btn.primary`；次要：`btn.secondary`；退回、停權、平台取消、退款：`NoteAction danger`（自動 `btn.danger`＋圖示）。
  - 列表（`CreatorReviewList`、`AdminCollabList`、`PaymentRows`、`PayoutList`、`AnomalyList`、違規訊息）：`rows`／`row`；空狀態 `EmptyState`（無動作，文字沿用 `emptyClassName` 那幾段）。
  - `CreatorReviewList`：IG 驗證碼旁 `CopyButton`；IG 連結 `textLink`。
  - `SearchForm`：輸入 `input`、按鈕 `btn.secondary`；`Pagination`：`btn.secondary`（44px）。
  - 總覽（`(console)/page.tsx`）：計數卡 hover `hover:bg-subtle`，數字 `font-serif text-[40px] font-bold tabular-nums`。
  - 違規訊息內容底 `bg-subtle`（Task 1 已換）。
  - `MfaForm.tsx`、`mfa/page.tsx`：輸入 `input`、送出 `btn.primary`、外框 `cardPad`；QR Code 的 `<img>` 外加 `rounded-input border border-line bg-surface p-2`。QR 圖（data URL PNG）本身是白底黑碼、含靜區，深色主題下仍可掃描——Task 14 用手機驗證器實際掃一次；掃不到時停下來回報（不要自行加色碼）。
  - 每頁 h1 → `PageHeader`。

- [ ] **Step 6：檢查、截圖、Commit**

```bash
npm run lint && npm run typecheck && npm test
npm run build   # 截圖（管理員測試帳號，先完成 MFA）：/admin、/admin/creators、/admin/collabs、/admin/collabs/[awaiting_payment]（人工標記已付款的金額核對）、/admin/collabs/[cancelled]（沒有補登）、/admin/payments、/admin/messages；390／1280 × 深／淺
git add src/lib/admin/notes.ts src/lib/admin/notes.test.ts src/components/admin "src/app/admin"
git commit -m "UI 升級 Task 12：管理後台改版；人工標記已付款要核對金額、已結束的合作案不顯示補登、列表與篩選統一"
```

---

### Task 13: 全站一致性收尾（按鈕、觸控、字級、原生驗證、檔案欄位、「→」）

**Files:** 以 grep 找到的檔案（預期是前面 task 沒碰到的零星元件，例如 `components/briefs/StatusBadges.tsx`、`BrandMark.tsx`、`BriefCover.tsx`、`components/collabs/Counterpart.tsx`、`components/square/Avatar.tsx`、`FavoriteButton.tsx`、`components/shell/ComingSoon.tsx`、`components/forms/Field.tsx` 的 `inputClass` 別名）

- [ ] **Step 1：逐條 grep，每條的預期結果都是「沒有輸出」，有輸出就照右欄修**

```bash
# 1. 主要按鈕不再用反白膠囊（選中標籤 chip()、aria-current 的導覽除外）→ 換 btn.primary
grep -rnE "className=\{?[\"\`][^\"\`]*\bbg-ink\b[^\"\`]*text-on-ink" src --include=*.tsx | grep -vE "border-ink bg-ink|chip\(|aria-current"
# 2. 原生檔案欄位 → FilePicker
grep -rn 'type="file"' src --include=*.tsx | grep -v "components/ui/FilePicker.tsx"
# 3. 原生驗證屬性 → noValidate＋自己的檢查
grep -rnE '\b(required|pattern=)' src --include=*.tsx | grep -v "aria-required"
grep -rn "<form" src --include=*.tsx | grep -v "noValidate" | grep -v "action={signOut}\|mark-paid\|formRef\|method=\"post\" action={form.action}"
# 4. 小於 44px 的可點目標（h-8、h-9、h-10 的按鈕或連結；min-h-9）→ h-11
grep -rnE "<(button|Link|a)\b[^>]*\b(h-8|h-9|h-10|min-h-9)\b" src --include=*.tsx
# 5. 小於 16px 的輸入（text-sm／text-xs 在 input、textarea、select 上）→ text-base
grep -rnE "<(input|textarea|select)\b[^>]*\btext-(xs|sm)\b" src --include=*.tsx | grep -v "ThemeSelect.tsx"
# 6. 按鈕文字的「→」
grep -rn "→" src --include=*.tsx
# 7. 舊 class 與色碼
grep -rnE "\btext-white\b|\bbg-black\b|#[0-9A-Fa-f]{6}" src --include=*.tsx | grep -v "opengraph-image.tsx\|layout.tsx"
# 8. inputClass 別名不再使用 → 直接用 input（styles）
grep -rn "inputClass\b" src --include=*.tsx | grep -v "components/forms/Field.tsx"
```

- [ ] **Step 2**：8 全部清掉後，刪除 `Field.tsx` 的 `inputClass` 別名；`ComingSoon.tsx` 改用 `PageHeader`＋`EmptyState text="即將推出"`。

- [ ] **Step 3：檢查與 Commit**

```bash
npm run lint && npm run typecheck && npm test
git add -A src
git commit -m "UI 升級 Task 13：全站一致性收尾（主要按鈕、44px 觸控、16px 輸入、移除原生驗證與檔案欄位、移除「→」）"
```

---

### Task 14: 文件、完整 E2E、Lighthouse、視覺檢查

**Files:**
- Modify: `README.md`、`docs/superpowers/plans/2026-11-22-foundation-followups.md`、`docs/superpowers/specs/2026-11-24-ui-refresh-design.md`（開頭加一行「視覺已由 2026-11-27-ui-upgrade-design.md 取代」）
- Scratchpad（不進 repo）：`ui-e2e/` 的腳本與截圖

- [ ] **Step 1：README**：
  - 「技術」段加 three（只在首頁、登入／註冊、公開頁；動態載入）。
  - 新增「設計系統」小節：token 在 `src/app/globals.css`（深色預設、淺色兩段必須一致、測試會檢查）；共用元件在 `src/components/ui/`；主要按鈕 `btn.primary`、破壞性 `btn.danger`＋`ConfirmAction`；3D 在 `src/components/thread/`。
  - 「上線前檢查」：Task 2 加的 `SUPPORT_EMAIL` 一條；另加「`src/lib/site.ts` 的 `HERO_HEADLINE` 確認用哪一句」。
- [ ] **Step 2：followups** 加入規格 §15 的延後項目（每條一行，附原因）。

- [ ] **Step 3：E2E（`npm run build && npm run start`，本機 Supabase、測試帳號；腳本在 scratchpad `ui-e2e/`）**。每一項記錄「通過／失敗＋截圖路徑」：
  1. 主題：首次載入跟隨系統（`emulateMedia({ colorScheme })` 兩種）；切到淺色後重新整理仍是淺色、沒有閃（載入時 `<html data-theme>` 在第一個 `DOMContentLoaded` 前已是 light）；切回「跟隨系統」。
  2. 首頁：LCP 元素是 `h1#hero-title`、CLS 0、three 的 chunk 在 idle 後才請求；滑過「我是品牌」線收緊（截圖比對）；reduced-motion 時沒有載入 three（network 沒有該 chunk）。
  3. `/brand`、`/creator`、`/admin` 的 network 沒有 three 的 chunk。
  4. 已登入者造訪 `/login`、`/signup` 被導走；`/login?error=profile` 不循環。
  5. `/c/Bad%21` 回 404 且是品牌化頁面；`/nonexistent` 是品牌化 404；關閉的招募對創作者顯示「已結束或不存在」。
  6. M1：婉拒報名要確認，取消後狀態不變；確定後「已婉拒」。
  7. M2：錄取金額 250000 → 出現上限說明與核取方塊，沒勾送不出；勾了建立成功；合作案付款區顯示上限說明與聯絡方式。
  8. M3：審核通過要確認。接受邀約、送出貼文連結要確認。
  9. M4：停權創作者的橫幅有信箱連結；`/help` 可從首頁頁尾、側欄、帳號頁到達。
  10. m19：沒有收款帳戶的創作者在待交稿合作案與機會頁看到提醒；設定後消失。
  11. 我的：頭像上傳後重新整理仍在（上傳即儲存）；改顯示名稱後出現「尚未儲存」，離開時瀏覽器提示；勾新的合作形式→報價欄停用並提示→儲存→可以填。
  12. 招募精靈：空白時「存成草稿」停用；第 3 步按上一頁回到第 2 步；點步驟 1 跳回；有未存內容離開時提示。
  13. 訊息：桌面 Enter 送出、Shift+Enter 換行；長對話標頭 sticky；超過 2000 字送出停用。
  14. 付款返回：模擬 `recentCreditPending`（本機用 ATM／信用卡建單後回到詳情頁），出現「正在確認付款…」，用 dev 標記已付款後 5 秒內頁面自動進入交稿。
  15. 每頁 `<title>` 不同（爬 25 個頁面的 `document.title`，不可重複「Kollink」單獨出現，首頁除外）。
  16. 390 寬所有頁面 `scrollWidth <= innerWidth`；量測所有可見的 `a, button, input, select, textarea, [role=button]` 的 bounding box，高度 < 44 的列出（行內段落連結以外應為 0）；所有 `input, textarea, select` 的 computed font-size ≥ 16px（桌面側欄的 ThemeSelect 除外）。
  17. 鍵盤：首頁 Tab 第一下是「跳到主要內容」；確認區塊 Esc 收回、焦點回到按鈕。
  18. 既有流程回歸（QA 報告第 5 節「已驗證通過」全部重跑一次的精簡版：註冊 OTP、onboarding、廣場篩選、刊登招募、報名／撤回、錄取、合作案完整生命週期到撥款、訊息即時、後台審核／撥款／取消）。

- [ ] **Step 4：Lighthouse 行動版（首頁）**：`npx lighthouse http://localhost:3000/ --form-factor=mobile --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=<scratchpad>/ui-e2e/lh-home.json --chrome-flags="--headless"`（lighthouse 用 `npx` 臨時下載，不加進專案）。目標：Performance ≥ 90、Accessibility ≥ 95、Best Practices ≥ 95、SEO ≥ 95、CLS 0、LCP ≤ 2.5s。`/login`、`/c/devcreator` 各跑一次（同目標）。不達標時記錄主要扣分項，修正後重跑；三次仍不達標就回報 controller。另外比較首頁首次載入的 JS（不含 three 的 chunk）gzip 總量與 Task 1 Step 0 的基準（`ui-shots/baseline.txt`）的差，必須 ≤ 30KB（規格 §12）。

- [ ] **Step 5：視覺檢查**：25 個頁面 × 390×844／1280×900 × 深／淺 = 200 張截圖，放 `ui-e2e/shots/`，逐張目視（Read 圖片），清單記錄任何對比、裁切、重疊、水平捲動問題並修正。

- [ ] **Step 6：Commit**

```bash
npm run lint && npm run typecheck && npm test
git add README.md docs/superpowers/plans/2026-11-22-foundation-followups.md docs/superpowers/specs/2026-11-24-ui-refresh-design.md $(git diff --name-only -- src)
git commit -m "UI 升級 Task 14：文件（設計系統、上線前檢查、延後事項）、E2E 與 Lighthouse 修正"
```

---

## 自我檢查（撰寫者執行過）

**規格覆蓋**

| 規格 | Task |
|---|---|
| §2 token、對照、對比、success 修正 | 1（13 收尾） |
| §3 字體 | 1 |
| §4 主題切換、ThemeSelect 位置 | 1、3、4、6、9 |
| §5 首頁（結構、文案、捲動紅線、已登入「進入後台」） | 4 |
| §6 three.js（視覺、行為、技術、三個變體） | 5（hero）、6（quiet）、7（ribbon） |
| §7 登入／註冊／Onboarding | 6；已登入導向 3 |
| §8 公開頁與 OG | 7 |
| §9.1 殼 | 3 |
| §9.2 頁首與 title | 2（PageHeader）、3（title） |
| §9.3 列 vs 卡、手機兩欄 | 8–12 |
| §9.4 按鈕 | 2、各畫面 task、13 |
| §9.5 表單、字數、FilePicker | 2、6、8、9、10、11、13 |
| §9.6 徽章 | 10（CollabStatusBadge）、13（StatusBadges） |
| §9.7 Stepper | 10 |
| §9.8 骨架 | 2、3、7 |
| §9.9 空狀態 | 2、8–12 |
| §9.10 通知 | 2、各 task |
| §9.11 確認規則 | 2、8（婉拒）、10（審核通過、接受、送出連結）、12 |
| §9.12 觸控 | 2、3、8、9、13、14 |
| §9.13 焦點 | 1 |
| §9.14 404／已結束／狀態碼 | 2、7、9、10 |
| §10.1–10.10 體驗改善 | 2／3（客服）、10（M2、輪詢）、9（m19、我的）、8（廣場、精靈、報名者）、11（訊息） |
| §11 動態 | 1（reduced motion）、4、5、10、11 |
| §12 效能預算 | 5、14 |
| §13 無障礙清單 | 1、2、3、14 |

**QA Major／Minor**：M1→8、M2→10（＋2 錯誤文字）、M3→10、M4→2／3／9／10；m1→7（部分）＋規格 §15；m2→3；m3→2／9／10；m4→3／4；m5→6（OTP 主旨延後）；m6→6／8／9／13；m7→2／3／8／9／13／14；m8→2／8／11／13；m9→1；m10→2／6／8／9／10；m11→9；m12→9；m13→11；m14 不存在；m15→8；m16→8；m17→10（用語）／12；m18→9；m19→9／10。

**名稱一致性**：`btn`／`input`／`textarea`／`chip`／`rows`／`row`／`cardPad`／`h1`／`h2`／`textLink`（`components/ui/styles.ts`）；`ThreadVariant`（`thread/types.ts` 與 `thread-scene.ts` 同值）；`ThreadPalette`、`createThreadScene`、`ThreadSceneHandle`（`thread-scene.ts`）；`readPalette`、`shouldLoadScene`、`normalizePointer`（`thread/palette.ts`）；`THEME_SCRIPT`、`applyThemePref`、`readThemePref`、`parseThemePref`、`watchSystemTheme`（`lib/theme.ts`）；`SUPPORT_EMAIL`、`SUPPORT_LINE_URL`、`SUPPORT_PAGE`、`supportMailto`、`HERO_HEADLINE`（`lib/site.ts`）；`mentionsSupport`（`lib/support.ts`）；`authPageRedirect`、`invalidCreatorPath`（`lib/auth/routes.ts`）；`exceedsOnlineLimit`、`OfferInput.offlineAck`（`lib/validation/collab.ts`）；`nextPollDelay`、`POLL_MAX_ATTEMPTS`（`lib/payments/poll.ts`）；`needsPayoutPrompt`、`anyNeedsPayoutPrompt`（`lib/creators/payout-prompt.ts`）、`loadHasPayoutAccount`（`lib/creators/payout-status.ts`）；`composerKeyAction`（`lib/messages/view.ts`）；`parseApplicantFilter`、`sortApplicants`（`lib/briefs/view.ts`）；`canJumpToStep`、`isBlankBrief`（`lib/briefs/wizard.ts`）；`amountMatches`（`lib/admin/notes.ts`）；`ConfirmAction` 的 `icon` 值 `trash|x|ban|leave|undo|check|send`。

**沒有佔位**：除了刻意的 `SUPPORT_EMAIL = "support@example.com"`（擁有者必填，README 上線前檢查有一條）外，每個 step 都有完整程式或逐條的 class 遷移規則。依現有檔案內容而定、撰寫時無法逐字給出的地方（例如既有測試 fixture 名稱、`CollabListItem` 的欄位名）都註明「以檔案現有的為準」。
