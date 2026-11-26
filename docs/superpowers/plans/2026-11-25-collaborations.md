# Kollink 合作案 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 品牌從招募錄取（同時設定金額與交付內容）或在創作者公開頁直接邀請，建立合作案；雙方在 `/brand/collabs`、`/creator/collabs` 看列表與詳情（標題區、7 步進度條、「現在要做什麼」卡片、交稿紀錄、系統事件），依狀態接受／婉拒／取消／交稿（上傳檔案到私密 bucket）／審核通過／要求修改／填貼文連結；付款與撥款在計畫 8、9 之前由管理員用 README 的 SQL 標記（本機另有測試按鈕）；審核逾期由 Vercel Cron 每天自動通過。

**Architecture:** 三個 migration：`20261125000100_collab_create.sql`（收回 `collaborations`／`conversations` 的直接 insert、索引、`accept_application_with_collab`、`invite_creator`、`decide_application` 只剩婉拒、`list_brief_applicants` 加 `collaboration_id`）、`20261125000200_deliverables.sql`（私密 bucket `deliverables` 與 policy、`collaboration_submissions`、`submit_deliverables`）、`20261125000300_collab_reads.sql`（`collab_turn`、`list_my_collaborations`、`get_collaboration`、`list_collaboration_events`、只給 service_role 的 `auto_approve_due`）。所有狀態變更仍只經過計畫 1 的 `transition_collaboration`；標記已付款仍只經過 `record_payment_success`。TS 端：純函式（狀態 → 步驟／輪到誰／文字、金額與託管文字、倒數、網址檢查、表單驗證）放 `src/lib/collabs/`、`src/lib/validation/collab.ts`、`src/lib/deliverables.ts`；伺服器讀取 `src/lib/collabs/load.ts`（使用者自己的 client，signed URL 1 小時）；Server Actions 分品牌與創作者兩個檔；兩個 route：`/api/cron/auto-approve`（Bearer `CRON_SECRET`、常數時間比對、service_role 呼叫 RPC）與 `/api/dev/mark-paid`（只在 `isDevLoginEnabled()`）。頁面都在 `<Suspense>` 內 `requireRole` 後讀取，詳情由同一個 `CollabDetail` 元件依視角呈現。

**Tech Stack:** Next.js 16.4.6（App Router、`cacheComponents`、Server Actions、`useActionState`、Route Handlers）、React 19.3、TypeScript、Tailwind v4、Supabase CLI 3.2（Postgres 17、Storage）、pgTAP、Vitest、lucide-react、Vercel Cron（`vercel.json`）。

**Spec:** `docs/superpowers/specs/2026-11-25-collaborations-design.md`（含使用者決定；視覺沿用 `docs/superpowers/specs/2026-11-24-ui-refresh-design.md`；延後事項與既有決定見 `docs/superpowers/plans/2026-11-22-foundation-followups.md`）

## Global Constraints

- Next.js 16 與訓練資料不同：寫程式前先讀 `node_modules/next/dist/docs/` 對應文件（本計畫用到的已列在下方「設計決定」）。`middleware.ts` 已改名為 `proxy.ts`。
- `cacheComponents` 已開啟：讀 `cookies()`、`headers()`、`searchParams`、`params` 的元件必須在 `<Suspense>` 內；不要在 layout 最外層 await session（`node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`）。不可使用 `export const runtime`、`export const dynamic`。讀現在時間（`Date.now()`、`new Date()`）只能在 `requireRole()`（內部已 `await connection()`）之後；client 元件不自己算現在時間，由伺服器把算好的文字當 prop 傳下去。
- 金鑰：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（瀏覽器可見）、`SUPABASE_SECRET_KEY`、`CRON_SECRET`（只能出現在伺服器端；`SUPABASE_SECRET_KEY` 只在 import `server-only` 的檔案）。絕不加 `NEXT_PUBLIC_` 前綴。
- 品牌與創作者的讀取與動作一律用**使用者自己的** client（`src/lib/supabase/server.ts`；瀏覽器上傳／刪除未交出的檔案用 `src/lib/supabase/client.ts`）。用 service_role 呼叫 `transition_collaboration` 會被判定為 system，品牌或創作者的動作會被拒絕（followups「6. 合作案詳情頁」）。`createAdminClient()` 只用在兩個地方：`/api/cron/auto-approve`（system 身分）與 `/api/dev/mark-paid`（本機、建付款單 + `record_payment_success`）。
- 標記已付款只有一條路：service_role 先 insert `payments`（只能填 `collaboration_id, provider, merchant_trade_no, amount_twd`），再呼叫 `record_payment_success`。不新增任何捷徑函式；service_role 不能直接呼叫 `mark_paid`。
- SQL 函式一律 `set search_path = ''`，物件名稱寫完整 schema；`RETURNS TABLE` 的 plpgsql 函式加 `#variable_conflict use_column`，欄位一律加表別名。
- 權限寫在 migration（followups「資料表權限寫在 migration」）：資料表先 `revoke all ... from anon, authenticated, service_role` 再明確 `grant`；新函式先 `revoke execute ... from public, anon, authenticated, service_role` 再 `grant` 給需要的角色。只給 definer 函式或 policy 內部用的 helper 不 grant 給任何 API 角色（policy 會呼叫的 helper grant 給 authenticated）。
- 寫入一律經由 definer 函式：`collaborations`、`conversations`、`collaboration_submissions` 不給任何 API 角色 INSERT／UPDATE／DELETE。
- 錯誤碼（TS 端只透過 `src/lib/collabs/errors.ts` 轉成中文）：身分 `42501`（`not authenticated`、`not a brand`、`not collaboration creator`）；找不到 `P0002`（`application not found`、`creator not found`、`collaboration not found`）；狀態 `55000`（`application not pending`、`collaboration not awaiting submission`）；格式 `22023`（`invalid <title|deliverables|amount_twd|note|links|file_paths|accept>`、`empty submission`、`invalid transition: …`）；重複 `23505`（`already invited`、`collaboration exists`）。
- 文字欄位：JS 端 `cleanText`／`cleanTextWithin`（換行先 CRLF → LF）與 SQL 端 `clean_text` 清理；JS 用 `hasBadChar`（bidi 或 NUL）擋、SQL 用 `has_bidi` 擋；字數一律以 code point 計（`textLength`）。JS 與 SQL 的規則（長度、數量、網址 regex、檔名 regex、輪到誰）必須一致，兩邊的註解互相指向。
- 網址的 `?tab=` 任何值都不能讓頁面或資料庫報錯（不認得就當「進行中」）。
- 每個讀取使用者資料的頁面與 Server Action 都要呼叫 `requireRole("brand")` 或 `requireRole("creator")`（layout 的 Gate 不算數）。
- Server Action 是公開的 POST 端點：參數一律當成 `unknown` 檢查型別與範圍；id 一律用 `isUuid` 檢查（`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`「Security」）。
- `supabase gen types` 產生的 RPC 回傳型別把 `RETURNS TABLE` 的欄位都標成非 null，實際上可能是 null：mapper 一律用自己定義、欄位可為 null 的 Row 型別（`src/lib/collabs/view.ts`），`data` 先轉成 `unknown` 再轉型。
- React 19 在 form action 結束後會重設非受控欄位：任何「錯誤時要保留」的輸入一律受控（`value` + `onChange`）。
- 送出按鈕：進行中一律 `disabled`；同一個位置的按鈕在 submit／button 兩種 type 間切換時給不同的 `key`，submit 按鈕只放在真正要送出的那個 `<form>` 裡。
- 連點或另一個分頁已處理（狀態已變）：不當成錯誤，顯示「狀態已更新，已為你重新整理」並 `router.refresh()`（`isStaleStateMessage`，Task 4 擴充到合作案）。
- 介面文字為繁體中文；產品名稱只從 `src/lib/site.ts` 的 `SITE_NAME` 取得。
- 顏色只用 `src/app/globals.css` 的 token class：`bg-bg`、`bg-panel`、`bg-surface`、`border-line`、`divide-line`、`text-ink`、`bg-ink`、`text-muted`、`text-on-ink`、`text-primary`、`bg-primary`、`border-primary`、`bg-primary-soft`、`ring-primary-soft`、`text-success`、`bg-success-soft`、`text-danger`、`bg-danger`、`border-danger`、`ring-ink`、`accent-ink`；圓角 `rounded-card`、`rounded-btn`、`rounded-nav`、`rounded-input`。不可用 `text-white` 或其他色碼。
- 手機 390 寬不可出現整頁水平捲軸：可左右捲動的容器加 `relative`（裡面有 `sr-only` 文字時）；長文字加 `break-words`／`min-w-0`。
- 確認一律用頁面內的確認區塊（`ConfirmAction` 或同樣的展開區塊），不可用瀏覽器的 `confirm()`。
- 不新增 npm 套件。圖示用已安裝的 `lucide-react`，`strokeWidth={1.5}`、`aria-hidden="true"`。
- 只動**本機** Supabase：不可執行 `supabase link`、`db push --remote`、`supabase config push`，也不可連到正式專案。
- 不可同時跑兩個 `next build`／`next dev`／`next start`（共用 `.next`）；同一時間只能有一個 agent 在跑這些指令。只有 Task 11 會啟動伺服器（一個 dev server、一個 port），用完要關掉。
- 每個 task 結束時：`npm run lint && npm run typecheck && npm test` 全過；有動到 SQL 的 task 另跑 `npx supabase test db` 全過。畫面元件沒有單元測試環境（vitest 是 node 環境），由 typecheck、lint、Task 11 的 build 與 E2E 驗證。
- pgTAP fixture 一律寫在該測試檔自己的 transaction 裡（結尾 `rollback`），id 用本計畫專屬的前綴（`…0007xx`、`…00007…`），不能影響 `01`、`05` 這些會數列數的舊測試。
- Commit 訊息用中文寫「計畫 6 Task N：重點」，結尾加你所在環境指定的 Co-Authored-By 歸屬行（寫實際執行的模型）。
- 前置：Docker Desktop 已啟動，`npx supabase start` 已執行，`.env.local` 已設定（見 README「本機開發」）。每個 DB task 開始前先 `npx supabase migration up` 套用新 migration。

## 設計決定

讀過的文件：
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`（「When Cache Components is enabled, `GET` Route Handlers follow the same model as normal UI routes」：讀 `request.headers` 會讓 GET 停止預渲染、在請求時執行。cron route 第一件事就是讀 `authorization` 標頭，所以一定是動態的，不需要也不可以加 `export const dynamic`）
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`（`GET(request: Request)`、回傳 `Response`／`Response.json`）
- `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`（「Security」：action 是公開的 POST；`revalidatePath`／`redirect` 在同一個回應帶回新畫面，`redirect` 之後的程式不會執行，revalidate 要放在 redirect 前）
- `node_modules/next/dist/docs/01-app/02-guides/forms.md`（`useActionState(action, initial)` 回傳 `[state, formAction, pending]`）
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`、`dynamic-routes.md`（`params`、`searchParams` 是 Promise，要在 `<Suspense>` 內 await）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md`（在 `<Suspense>` 內呼叫時回應碼仍是 200 + `noindex`，畫面是 not-found UI = spec 的 soft 404）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md`（`requireRole` → `getCurrentUser` 已 `await connection()`，之後才能讀現在時間）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`
- `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`

決定：
1. **錄取的新函式 `accept_application_with_collab(p_application_id, p_amount_twd, p_deliverables) → uuid`。** 計畫 5 的 `decide_application` 改成只能婉拒（`p_accept` 不是 `false` 一律 `22023 invalid accept`），錄取只剩新函式這條路；`11_briefs.test.sql` 的三個錄取斷言改呼叫新函式（斷言數不變）。合作案的案名 = 招募名稱（spec 的錄取表單沒有案名欄）。報名狀態、對話、合作案在同一個函式（= 同一個 transaction）裡完成；`(brief_id, creator_id)` 唯一索引在資料庫層再擋一次「同一則報名只能一個合作案」，也當 `collaborations(brief_id)` 的索引。
2. **對話用 `ensure_conversation`（內部 helper）取得或建立並 `for update` 鎖住。** `conversations` 本來就是 `unique (brand_id, creator_id)`（一對品牌／創作者只有一個對話），所以「建立對話」其實是「取得或建立」。鎖住這一列讓同一對的邀請一個一個來，「已有 invited 就不能再邀」不用唯一索引也沒有競態（唯一索引會讓計畫 1 `03_collaborations.test.sql` 同一對有兩筆 invited 的 fixture 失敗）。
3. **直接 insert 全部收回。** `collaborations`、`conversations` 對 anon／authenticated／service_role 都 `revoke all` 後只 `grant select` 給 authenticated、service_role（`revoke all` 會連計畫 1 的欄位 insert 權限一起收回），並 drop 兩個 insert policy。`03_collaborations.test.sql` 第一個 `lives_ok`（品牌直接建立邀約）改成 `throws_ok 42501`，之後由 postgres 建立同一筆邀約，其餘斷言不變（44 個）。
4. **詳情拆成三個來源**：`get_collaboration`（合作案 + 雙方公開資料 + 招募名稱 + 我是哪一方，0 列 = 404）、`list_collaboration_events`（audit log + 做事的人的名稱，讀取時才 join）、交稿紀錄直接用 RLS 讀 `collaboration_submissions`（參與者與管理員可讀，不必再包一層）。spec 寫「`get_collaboration` 回傳……交稿紀錄、系統事件」：拆開是為了型別（jsonb 欄位在產生的型別裡只是 `Json`），結果相同。
5. **列表只列自己參與的。** `list_my_collaborations` 只回傳呼叫者是品牌或創作者的合作案（管理員看全部是計畫 9 的後台）；`get_collaboration`、`list_collaboration_events` 允許管理員（spec 的「參與者和管理員」）。頁面另外要求 `my_side` 等於該區（品牌頁 `brand`、創作者頁 `creator`），否則 404。
6. **輪到誰只寫一份規則、兩邊各一份實作。** SQL `collab_turn(status)`（列表排序用）與 TS `turnOf(status)`：invited → 創作者、awaiting_payment → 品牌、awaiting_submission → 創作者、in_review → 品牌、awaiting_publish → 創作者、awaiting_payout → 平台、其他 → 無。
7. **進度條 7 步的對應**：invited → 第 1 步「邀約」；awaiting_payment → 第 2 步「確認」（品牌「確認並付款」一個動作涵蓋確認與付款託管）；awaiting_submission → 第 4 步「交稿」（「付款託管」已完成）；in_review → 5；awaiting_publish → 6；awaiting_payout → 7「撥款」；completed → 全部完成；declined／cancelled 不顯示進度條。從招募來的合作案從 awaiting_payment 開始，所以「邀約」自然是已完成。
8. **交稿檔名。** 路徑 `<collab_id>/<creator_id>/<uuid>.<副檔名>`（spec「亂數檔名」）。原始檔名不保存，所以畫面上的「檔名」是「圖片 1」「影片 2」「PDF 3」加圖示（依副檔名判斷種類）。上傳在瀏覽器以創作者自己的 client 直接傳到 Storage（50 MB 不經過 Server Action 的 body 限制）；送出前移除的檔案立即刪除（policy 允許刪除還沒交出的檔案）；其餘孤兒檔（上傳後離開頁面）交給共用的清理排程（followups）。`submit_deliverables` 檢查每個檔案都已存在於 `storage.objects`（postgres 有 BYPASSRLS 與 SELECT 權限，本機已確認）。
9. **signed URL**：詳情頁伺服器端用使用者自己的 client `createSignedUrls(paths, 3600)`（RLS 只讓參與者與管理員簽得出來）。頁面不快取，所以每次開頁都是新的 1 小時連結；圖片縮圖也用同一個 signed URL。
10. **自動通過**：`auto_approve_due()` 回傳 `(approved integer, failed uuid[])`，每件用 `begin … exception` 包起來（一件失敗不影響其他件，失敗寫 `raise warning` 並回傳 id，route 再 `console.error`）。Cron 設定用 **`vercel.json`**，不用 `vercel.ts`：`vercel.ts` 需要新增 `@vercel/config` 套件（違反「不新增 npm 套件」），而這裡只有一行 cron，JSON 就夠。排程 `0 1 * * *`（UTC 01:00 = 台灣 09:00）；Hobby 方案一天一次、而且可能在該小時內任何時間觸發，所以實際是「到期後最晚隔天自動通過」。Vercel 在專案有 `CRON_SECRET` 環境變數時，cron 請求會自動帶 `Authorization: Bearer <CRON_SECRET>`。route 用 GET（Vercel Cron 送 GET）。比對用 `timingSafeEqual` 比較兩邊的 SHA-256（長度固定，不洩漏長度）。`CRON_SECRET` 沒設定時回 500 並記 log（不能讓「沒設定」等於「不檢查」）。proxy 的 matcher 排除 `api/cron`（cron 不帶 cookie，不需要更新 session）。
11. **「確認並付款」在計畫 8 前**：按下只展開說明文字（不改狀態、不呼叫任何 action）；卡片顯示「等待付款確認」。本機測試按鈕「標記已付款（本機）」是一個一般的 `<form method="post" action="/api/dev/mark-paid">`（不需要 JS），只有伺服器端 `isDevLoginEnabled()` 為真時才渲染；route 本身也再檢查一次，正式環境一律 404。route 先用使用者自己的 client 呼叫 `get_collaboration` 確認登入者是參與者、狀態是 awaiting_payment，再用 service_role 建付款單（`DEV` + 17 位大寫十六進位）並呼叫 `record_payment_success`，303 導回詳情。
12. **README 的管理員 SQL** 用 `set_config('kollink.case_code', '<案號>', true)` 只填一次案號，後面的語句都讀 `current_setting('kollink.case_code')`；先用 `do` 區塊檢查案號格式與「剛好找到一個合作案」，不符就丟錯（整個 transaction 不生效）。標記已付款：`set local role service_role` + JWT claims 後 insert 付款單、呼叫 `record_payment_success`（本計畫撰寫時已在本機 rollback 的 transaction 裡實際跑過，結果 `paid` → `awaiting_submission`）。撥款：同樣以 service_role 呼叫 `transition_collaboration(id, 'payout', '人工撥款')`。
13. **審核倒數**：`reviewCountdown(dueIso, nowMs)`：剩 1 小時以上 →「剩 N 天 HH 小時後自動通過」（HH 補零）；剩不到 1 小時 →「不到 1 小時後自動通過」；到期 →「即將自動通過」。伺服器在 `requireRole` 之後用 `Date.now()` 算好文字傳給卡片。
14. **貼文連結檢查**：`isValidPostUrl`：先比對與資料庫相同的 regex `^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}/\S+$`，再用 `new URL()` 檢查每個網域標籤都非空、不以 `-` 開頭結尾（擋掉 `a..b.com`），而且路徑不是只有 `/`。交稿的連結用同樣的主機檢查，但路徑可以省略（資料庫 regex `^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/\S*)?$`）。
15. **錄取表單的預設值**：金額 = 報名報價 → 招募預算上限 → 下限 → 空白（只提供產品的招募要品牌自己填）；交付內容 = 招募合作形式（`、` 連接）+ 換行 + 說明的前 200 字（超過加「…」），整體不超過 1000 字。
16. **列表的「輪到你／等對方」標記**：`awaiting_payout` 兩邊都顯示「撥款處理中」；已完成與已取消分頁不顯示標記。
17. **事件文字**：`create` 依目標狀態分「發出邀約」與「錄取並建立合作案」；`mark_paid`「款項已託管」；`auto_approve`「審核期限已到，自動通過」；`request_changes`「要求修改：<說明>」；`payment_requires_refund`「收到付款，但合作案已不在待付款，需退款」；其他動作照表（Task 4 的 `eventText`）。日期顯示台灣時間 `MM/DD HH:mm`。要求修改的說明另外掛在對應那一輪交稿下方：掛到「建立時間 ≤ 該事件時間」的最後一輪。

## File Structure

| 檔案 | 責任 |
|---|---|
| `supabase/migrations/20261125000100_collab_create.sql` | 收回直接 insert、索引、`ensure_conversation`、`check_collab_offer`、`accept_application_with_collab`、`decide_application`（只剩婉拒）、`invite_creator`、`list_brief_applicants`（加 `collaboration_id`） |
| `supabase/migrations/20261125000200_deliverables.sql` | bucket `deliverables` 與 policy、`deliverable_path_ok`、`can_*_deliverable`、`collaboration_submissions`、`submit_deliverables` |
| `supabase/migrations/20261125000300_collab_reads.sql` | `collab_turn`、`list_my_collaborations`、`get_collaboration`、`list_collaboration_events`、`auto_approve_due` |
| `supabase/tests/13_collab_create.test.sql`（37）、`14_deliverables.test.sql`（34）、`15_collab_reads.test.sql`（22） | pgTAP |
| `supabase/tests/03_collaborations.test.sql`、`11_briefs.test.sql` | 配合收回 insert 與新的錄取函式 |
| `src/lib/supabase/database.types.ts` | `npm run db:types` 產生（不手改） |
| `src/lib/collabs/view.ts` | 狀態型別與文字、輪到誰、進度條、託管文字、案號、分頁、卡片文字、倒數、事件文字、修改說明對應、Row → 顯示物件 |
| `src/lib/validation/collab.ts` | 金額、案名、交付內容、修改說明、貼文連結、交稿連結與檔案的解析與驗證、錄取預設值 |
| `src/lib/deliverables.ts` | bucket 常數、上傳路徑與檔案檢查、檔案種類與標籤 |
| `src/lib/collabs/errors.ts` | 資料庫錯誤 → 中文、欄位錯誤、狀態已變判斷 |
| `src/lib/briefs/errors.ts` | `isStaleStateMessage` 也認得合作案的「狀態已變」 |
| `src/lib/collabs/load.ts` | 伺服器端讀取（server-only）：列表、詳情（含 signed URL） |
| `src/lib/cron/auth.ts` | cron 的 Bearer secret 常數時間比對 |
| `src/lib/collabs/dev-payment.ts` | 本機付款單編號 |
| `src/app/brand/collabs/actions.ts` | 直接邀請、品牌的狀態動作（取消、通過、要求修改） |
| `src/app/creator/collabs/actions.ts` | 創作者的狀態動作（接受、婉拒）、交稿、填貼文連結 |
| `src/app/brand/briefs/actions.ts` | `decideApplicationAction` 換成 `acceptApplicationAction`（表單）與 `rejectApplicationAction` |
| `src/app/api/cron/auto-approve/route.ts`、`vercel.json`、`src/proxy.ts` | 自動通過 |
| `src/app/api/dev/mark-paid/route.ts` | 本機標記已付款 |
| `src/components/shell/nav.ts` | 「合作案」「合作」改成連結 |
| `src/components/collabs/CollabStatusBadge.tsx`、`CollabList.tsx`、`CollabTabs.tsx` | 列表 |
| `src/components/collabs/Stepper.tsx`、`CollabHeader.tsx`、`ActionCard.tsx`、`CollabActions.tsx`、`RevisionForm.tsx`、`SubmitPanel.tsx`、`PublishForm.tsx`、`SubmissionList.tsx`、`EventList.tsx`、`CollabDetail.tsx`、`FileTile.tsx` | 詳情 |
| `src/components/collabs/OfferForm.tsx`、`InvitePanel.tsx` | 錄取表單與邀請表單 |
| `src/app/brand/collabs/page.tsx`、`[id]/page.tsx`、`src/app/creator/collabs/page.tsx`、`[id]/page.tsx` | 頁面 |
| `src/components/briefs/ApplicantList.tsx`、`src/app/brand/briefs/[id]/page.tsx` | 錄取改成打開表單、已錄取連到合作案 |
| `src/app/c/[handle]/ProfileView.tsx` | 「邀請合作」打開邀請表單 |
| `README.md`、`.env.example`、`docs/superpowers/plans/2026-11-22-foundation-followups.md` | 文件同步 |

---

### Task 1: 資料庫：建立合作案只走函式（錄取、直接邀請）、收回直接 insert、索引

**Files:**
- Create: `supabase/migrations/20261125000100_collab_create.sql`、`supabase/tests/13_collab_create.test.sql`
- Modify: `supabase/tests/03_collaborations.test.sql`、`supabase/tests/11_briefs.test.sql`、`src/lib/supabase/database.types.ts`（產生）

**Interfaces:**
- Consumes: `public.clean_text(text)`、`public.has_bidi(text)`、`public.my_role()`、`public.today_tw()`、`public.transition_collaboration(...)`、`log_collaboration_created` trigger（既有）。
- Produces（後面的 task 依賴）：
  - `accept_application_with_collab(p_application_id uuid, p_amount_twd integer, p_deliverables text) → uuid`（合作案 id，狀態 `awaiting_payment`、`brief_id` = 招募、案名 = 招募名稱）。
  - `invite_creator(p_creator_id uuid, p_title text, p_deliverables text, p_amount_twd integer) → uuid`（狀態 `invited`）。
  - `decide_application(p_id uuid, p_accept boolean)`：只接受 `p_accept = false`。
  - `list_brief_applicants(p_brief_id uuid)` 多一欄 `collaboration_id uuid`（沒有合作案時是 null）。
  - 錯誤：`not authenticated`／`not a brand`（42501）、`application not found`／`creator not found`（P0002）、`application not pending`（55000）、`invalid title|deliverables|amount_twd|accept`（22023）、`already invited`／`collaboration exists`（23505）。
  - `collaborations`、`conversations`：任何 API 角色都只有 SELECT。

- [ ] **Step 1: 寫失敗的測試 `supabase/tests/13_collab_create.test.sql`**

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- 701、702 品牌；711、712 已審核創作者；713 待審核創作者
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000701', 'p6-b1@test.local'),
  ('00000000-0000-0000-0000-000000000702', 'p6-b2@test.local'),
  ('00000000-0000-0000-0000-000000000711', 'p6-c1@test.local'),
  ('00000000-0000-0000-0000-000000000712', 'p6-c2@test.local'),
  ('00000000-0000-0000-0000-000000000713', 'p6-c3@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000701', 'brand', '六號品牌'),
  ('00000000-0000-0000-0000-000000000702', 'brand', '別的品牌'),
  ('00000000-0000-0000-0000-000000000711', 'creator', '六號小美'),
  ('00000000-0000-0000-0000-000000000712', 'creator', '六號阿哲'),
  ('00000000-0000-0000-0000-000000000713', 'creator', '六號新人');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000701', '六號品牌'),
  ('00000000-0000-0000-0000-000000000702', '別的品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000711', 'p6mei', 'p6mei', 'approved'),
  ('00000000-0000-0000-0000-000000000712', 'p6zhe', 'p6zhe', 'approved'),
  ('00000000-0000-0000-0000-000000000713', 'p6new', 'p6new', 'pending');
insert into public.briefs
  (id, brand_id, title, description, collab_types, includes_product, deadline, status, published_at) values
  ('00000000-0000-0000-0000-00000007f001', '00000000-0000-0000-0000-000000000701',
   '六號招募', '說明', array['IG 貼文'], true, public.today_tw() + 7, 'open', now());
insert into public.brief_applications (id, brief_id, creator_id, proposed_price_twd) values
  ('00000000-0000-0000-0000-00000007a001', '00000000-0000-0000-0000-00000007f001', '00000000-0000-0000-0000-000000000711', 6000),
  ('00000000-0000-0000-0000-00000007a002', '00000000-0000-0000-0000-00000007f001', '00000000-0000-0000-0000-000000000712', null);
-- 701 與 712 之前就有對話：邀請時要沿用
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000007c001', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000712');

-- ── A. 不能直接建立 ──
select ok(not has_table_privilege('service_role', 'public.collaborations', 'INSERT'), 'service_role 不能直接 insert collaborations');
select ok(not has_column_privilege('authenticated', 'public.collaborations', 'title', 'INSERT'), '計畫 1 的欄位 insert 權限已收回');
select ok(not has_table_privilege('anon', 'public.conversations', 'INSERT'), 'anon 不能 insert conversations');
select ok(not has_table_privilege('service_role', 'public.conversations', 'INSERT'), 'service_role 不能直接 insert conversations');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000701","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.collaborations (brand_id, creator_id, conversation_id, title, deliverables, amount_twd)
    values ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000712',
            '00000000-0000-0000-0000-00000007c001', 'x', 'x', 1000)$$,
  '42501', null, '品牌不能直接 insert collaborations');
select throws_ok(
  $$insert into public.conversations (brand_id, creator_id)
    values ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000711')$$,
  '42501', null, '品牌不能直接 insert conversations');

-- ── B. 錄取並建立合作案 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000702","role":"authenticated"}', true);
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 6000, 'IG 貼文 1 篇')$$,
  'P0002', 'application not found', '別的品牌不能錄取');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000711","role":"authenticated"}', true);
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 6000, 'IG 貼文 1 篇')$$,
  'P0002', 'application not found', '創作者不能錄取');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 6000, 'IG 貼文 1 篇')$$,
  '42501', 'not authenticated', '沒有登入不能錄取');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000701","role":"authenticated"}', true);
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 0, 'IG 貼文 1 篇')$$,
  '22023', 'invalid amount_twd', '金額不能是 0');
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 10000001, 'IG 貼文 1 篇')$$,
  '22023', 'invalid amount_twd', '金額不能超過 10,000,000');
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 6000, E' \t')$$,
  '22023', 'invalid deliverables', '交付內容必填');
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 6000, repeat('字', 1001))$$,
  '22023', 'invalid deliverables', '交付內容最多 1000 字');
select is(
  (select status from public.brief_applications where id = '00000000-0000-0000-0000-00000007a001'),
  'applied', '格式錯誤時報名維持待處理（同一個 transaction）');
select lives_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 6000, ' IG 貼文 1 篇 ')$$,
  '招募主可以錄取並建立合作案');
select is(
  (select status from public.brief_applications where id = '00000000-0000-0000-0000-00000007a001'),
  'accepted', '報名改為已錄取');
select is(
  (select status::text || '|' || amount_twd || '|' || title || '|' || deliverables || '|' || brief_id::text
     from public.collaborations where creator_id = '00000000-0000-0000-0000-000000000711'),
  'awaiting_payment|6000|六號招募|IG 貼文 1 篇|00000000-0000-0000-0000-00000007f001',
  '合作案從確認開始、案名是招募名稱、交付內容已清理');
select is(
  (select count(*)::int from public.conversations
    where brand_id = '00000000-0000-0000-0000-000000000701' and creator_id = '00000000-0000-0000-0000-000000000711'),
  1, '同時建立對話');
select is(
  (select l.actor_kind || '|' || l.to_status::text from public.audit_logs l
     join public.collaborations c on c.id = l.collaboration_id
    where c.creator_id = '00000000-0000-0000-0000-000000000711' and l.action = 'create'),
  'brand|awaiting_payment', '建立紀錄寫進 audit log（品牌）');
select is(
  (select collaboration_id from public.list_brief_applicants('00000000-0000-0000-0000-00000007f001')
    where creator_id = '00000000-0000-0000-0000-000000000711'),
  (select id from public.collaborations where creator_id = '00000000-0000-0000-0000-000000000711'),
  '報名者列表帶出合作案 id');
select is(
  (select count(*)::int from public.list_brief_applicants('00000000-0000-0000-0000-00000007f001')
    where collaboration_id is null),
  1, '沒錄取的報名者沒有合作案 id');
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 6000, 'IG 貼文 1 篇')$$,
  '55000', 'application not pending', '同一則報名不能再錄取一次');
select throws_ok(
  $$select public.decide_application('00000000-0000-0000-0000-00000007a002', true)$$,
  '22023', 'invalid accept', '舊的錄取路徑已收回');
select lives_ok(
  $$select public.decide_application('00000000-0000-0000-0000-00000007a002', false)$$,
  '婉拒照舊');
reset role;
select throws_ok(
  $$insert into public.collaborations (brand_id, creator_id, brief_id, conversation_id, title, deliverables, amount_twd)
    select '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000711',
           '00000000-0000-0000-0000-00000007f001', cv.id, 'x', 'x', 1
      from public.conversations cv
     where cv.brand_id = '00000000-0000-0000-0000-000000000701' and cv.creator_id = '00000000-0000-0000-0000-000000000711'$$,
  '23505', null, '同一則報名（招募 × 創作者）在資料庫層也只能有一個合作案');

-- ── C. 直接邀請 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000711","role":"authenticated"}', true);
select throws_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', '邀約', 'Reels 1 支', 3000)$$,
  '42501', 'not a brand', '創作者不能邀請');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000701","role":"authenticated"}', true);
select throws_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000713', '邀約', 'Reels 1 支', 3000)$$,
  'P0002', 'creator not found', '不能邀請待審核的創作者');
select throws_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-0000000007ff', '邀約', 'Reels 1 支', 3000)$$,
  'P0002', 'creator not found', '不存在的創作者');
select throws_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', ' ', 'Reels 1 支', 3000)$$,
  '22023', 'invalid title', '案名必填');
select throws_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', repeat('案', 61), 'Reels 1 支', 3000)$$,
  '22023', 'invalid title', '案名最多 60 字');
select throws_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', '邀約', 'Reels 1 支', null)$$,
  '22023', 'invalid amount_twd', '金額必填');
select lives_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', '夏季邀約', 'Reels 1 支', 3000)$$,
  '品牌可以邀請已審核的創作者');
select is(
  (select status::text || '|' || coalesce(brief_id::text, 'null') || '|' || conversation_id::text
     from public.collaborations where title = '夏季邀約'),
  'invited|null|00000000-0000-0000-0000-00000007c001', '狀態是邀約、沒有招募、沿用既有對話');
select throws_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', '再一次', 'Reels 1 支', 3000)$$,
  '23505', 'already invited', '已有邀約中的合作案不能再邀');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000712","role":"authenticated"}', true);
select is(
  (select public.transition_collaboration(c.id, 'decline') from public.collaborations c where c.title = '夏季邀約'),
  'declined'::public.collab_status, '創作者婉拒');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000701","role":"authenticated"}', true);
select lives_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', '再一次', 'Reels 1 支', 3000)$$,
  '婉拒後可以再邀');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000702","role":"authenticated"}', true);
select lives_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', '別的品牌的邀約', 'Reels 1 支', 3000)$$,
  '別的品牌不受影響');

select * from finish();
rollback;
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx supabase test db`
Expected: `13_collab_create.test.sql` 失敗（`function public.accept_application_with_collab(...) does not exist` 之類），其他檔案通過。

- [ ] **Step 3: 寫 migration `supabase/migrations/20261125000100_collab_create.sql`**

```sql
-- 合作案（計畫 6）之一：建立合作案只能經由 definer 函式（招募錄取、直接邀請）、收回直接 insert、索引。
-- 權限一律在這裡明確寫出（雲端新專案不會自動授權，本機會；見 20261124000100_explicit_api_grants.sql）。

-- 1. 收回直接建立：計畫 1 開放了品牌直接 insert collaborations、參與者直接 insert conversations，
--    20261124000100 還誤給了 anon insert conversations。全部收回，只留 SELECT（RLS 照舊）。
drop policy collaborations_insert_brand on public.collaborations;
drop policy conversations_insert_participant on public.conversations;
revoke all on public.collaborations from anon, authenticated, service_role;
grant select on public.collaborations to authenticated, service_role;
revoke all on public.conversations from anon, authenticated, service_role;
grant select on public.conversations to authenticated, service_role;

-- 2. 索引（followups「4. 創作者廣場、5. 招募與機會頁」）。
--    (brief_id, creator_id) 唯一：同一則招募的同一位創作者（= 同一則報名）只能有一個合作案；也當 brief_id 的索引用。
create index conversations_creator_idx on public.conversations (creator_id);
create index collaborations_conversation_idx on public.collaborations (conversation_id);
create unique index collaborations_brief_creator_key on public.collaborations (brief_id, creator_id)
  where brief_id is not null;

-- 3. 取得（或建立）品牌與創作者之間唯一的對話，並鎖住這一列：
--    同一對品牌／創作者的建立動作因此一個一個來，「不能重複邀約」的檢查不會有競態。只給 definer 函式內部用。
create function public.ensure_conversation(p_brand_id uuid, p_creator_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  insert into public.conversations (brand_id, creator_id) values (p_brand_id, p_creator_id)
  on conflict (brand_id, creator_id) do nothing;
  select cv.id into v_id from public.conversations cv
   where cv.brand_id = p_brand_id and cv.creator_id = p_creator_id
   for update;
  return v_id;
end;
$$;
revoke execute on function public.ensure_conversation(uuid, uuid) from public, anon, authenticated, service_role;

-- 4. 合作條件的格式（與 src/lib/validation/collab.ts 相同規則）：
--    案名 1–60 字、交付內容 1–1000 字（都先 clean_text、不可有 bidi）、金額 1..10,000,000。
--    回傳清理後的文字；不合格就丟 22023 invalid <欄位>。只給 definer 函式內部用。
create function public.check_collab_offer(p_title text, p_deliverables text, p_amount_twd integer)
returns table (title text, deliverables text)
language plpgsql immutable set search_path = '' as $$
declare
  v_title text := nullif(public.clean_text(p_title), '');
  v_deliverables text := nullif(public.clean_text(p_deliverables), '');
begin
  if v_title is null or public.has_bidi(v_title) or char_length(v_title) > 60 then
    raise exception 'invalid title' using errcode = '22023';
  end if;
  if v_deliverables is null or public.has_bidi(v_deliverables) or char_length(v_deliverables) > 1000 then
    raise exception 'invalid deliverables' using errcode = '22023';
  end if;
  if p_amount_twd is null or p_amount_twd not between 1 and 10000000 then
    raise exception 'invalid amount_twd' using errcode = '22023';
  end if;
  return query select v_title, v_deliverables;
end;
$$;
revoke execute on function public.check_collab_offer(text, text, integer) from public, anon, authenticated, service_role;

-- 5. 招募主錄取報名並建立合作案（同一個 transaction）：報名 → accepted、取得或建立對話、
--    建立合作案（awaiting_payment，創作者報名時已同意，跳過邀約）。案名 = 招募名稱。回傳合作案 id。
--    招募關閉或截止後也可以錄取（同計畫 5）。
create function public.accept_application_with_collab(
  p_application_id uuid, p_amount_twd integer, p_deliverables text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_brief_id uuid;
  v_brief_title text;
  v_creator_id uuid;
  v_app_status text;
  v_deliverables text;
  v_conversation uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select a.brief_id, b.title, a.creator_id, a.status
    into v_brief_id, v_brief_title, v_creator_id, v_app_status
    from public.brief_applications a
    join public.briefs b on b.id = a.brief_id
   where a.id = p_application_id and b.brand_id = v_uid
   for update of a;
  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if v_app_status <> 'applied' then
    raise exception 'application not pending' using errcode = '55000';
  end if;
  select o.deliverables into v_deliverables
    from public.check_collab_offer(coalesce(v_brief_title, ''), p_deliverables, p_amount_twd) o;

  update public.brief_applications a set status = 'accepted' where a.id = p_application_id;
  v_conversation := public.ensure_conversation(v_uid, v_creator_id);
  begin
    insert into public.collaborations
      (brand_id, creator_id, brief_id, conversation_id, title, deliverables, amount_twd, status)
    values
      (v_uid, v_creator_id, v_brief_id, v_conversation, v_brief_title, v_deliverables, p_amount_twd, 'awaiting_payment')
    returning id into v_id;
  exception when unique_violation then
    raise exception 'collaboration exists' using errcode = '23505';
  end;
  return v_id;
end;
$$;
revoke execute on function public.accept_application_with_collab(uuid, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.accept_application_with_collab(uuid, integer, text) to authenticated;

-- 6. 計畫 5 的 decide_application 只剩婉拒：錄取必須帶金額與交付內容，改走 accept_application_with_collab。
create or replace function public.decide_application(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_accept is distinct from false then
    raise exception 'invalid accept' using errcode = '22023';
  end if;
  update public.brief_applications a
     set status = 'rejected'
    from public.briefs b
   where a.id = p_id and b.id = a.brief_id and b.brand_id = v_uid and a.status = 'applied';
  if not found then
    if exists (select 1 from public.brief_applications a join public.briefs b on b.id = a.brief_id
                where a.id = p_id and b.brand_id = v_uid) then
      raise exception 'application not pending' using errcode = '55000';
    end if;
    raise exception 'application not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.decide_application(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.decide_application(uuid, boolean) to authenticated;

-- 7. 品牌直接邀請已審核的創作者：取得或建立對話、建立合作案（invited）。回傳合作案 id。
--    同一個品牌對同一位創作者已有 invited 的合作案時不能再邀（23505 already invited）。
--    未審核、停權或不存在的創作者一律 P0002（不透露是否存在）。
create function public.invite_creator(
  p_creator_id uuid, p_title text, p_deliverables text, p_amount_twd integer
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text;
  v_deliverables text;
  v_conversation uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.my_role() is distinct from 'brand'
     or not exists (select 1 from public.brand_profiles bp where bp.user_id = v_uid) then
    raise exception 'not a brand' using errcode = '42501';
  end if;
  if not exists (select 1 from public.creator_profiles cp
                  where cp.user_id = p_creator_id and cp.status = 'approved') then
    raise exception 'creator not found' using errcode = 'P0002';
  end if;
  select o.title, o.deliverables into v_title, v_deliverables
    from public.check_collab_offer(p_title, p_deliverables, p_amount_twd) o;

  v_conversation := public.ensure_conversation(v_uid, p_creator_id);
  if exists (select 1 from public.collaborations c
              where c.brand_id = v_uid and c.creator_id = p_creator_id and c.status = 'invited') then
    raise exception 'already invited' using errcode = '23505';
  end if;
  insert into public.collaborations
    (brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status)
  values
    (v_uid, p_creator_id, v_conversation, v_title, v_deliverables, p_amount_twd, 'invited')
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.invite_creator(uuid, text, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.invite_creator(uuid, text, text, integer) to authenticated;

-- 8. 報名者列表多回傳 collaboration_id（已錄取的那一筆可以直接連到合作案）。回傳欄位變了，要先 drop。
drop function public.list_brief_applicants(uuid);
create function public.list_brief_applicants(p_brief_id uuid)
returns table (
  id uuid,
  creator_id uuid,
  handle text,
  display_name text,
  avatar_path text,
  follower_count integer,
  engagement_rate numeric,
  region text,
  message text,
  proposed_price_twd integer,
  status text,
  created_at timestamptz,
  collaboration_id uuid
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null
     or not exists (select 1 from public.briefs b where b.id = p_brief_id and b.brand_id = auth.uid()) then
    raise exception 'not brief owner' using errcode = '42501';
  end if;
  return query
  select a.id, a.creator_id, cp.handle, p.display_name, cp.avatar_path, cp.follower_count,
         cp.engagement_rate::numeric, cp.region, a.message, a.proposed_price_twd, a.status, a.created_at,
         c.id
    from public.brief_applications a
    join public.creator_profiles cp on cp.user_id = a.creator_id
    join public.profiles p on p.id = a.creator_id
    left join public.collaborations c on c.brief_id = a.brief_id and c.creator_id = a.creator_id
   where a.brief_id = p_brief_id
   order by a.created_at desc, a.id;
end;
$$;
revoke execute on function public.list_brief_applicants(uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_brief_applicants(uuid) to authenticated;
```

- [ ] **Step 4: 更新舊測試**

`supabase/tests/03_collaborations.test.sql`：把「品牌 b1 建立邀約」區塊的第一個斷言

```sql
select lives_ok(
  $$insert into public.collaborations
      (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd)
    values ('00000000-0000-0000-0000-00000000cc01',
            '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-00000000a001',
            '春季新品開箱', 'IG 貼文 1 篇 + 限動 2 則', 4500)$$,
  '品牌可以建立邀約');
```

整段換成（斷言數不變，`plan(44)` 不用改）：

```sql
select throws_ok(
  $$insert into public.collaborations
      (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd)
    values ('00000000-0000-0000-0000-00000000cc01',
            '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-00000000a001',
            '春季新品開箱', 'IG 貼文 1 篇 + 限動 2 則', 4500)$$,
  '42501', null, '計畫 6 起品牌不能直接建立合作案（改走 invite_creator）');
-- 之後的流程照舊：由擁有者建立同一筆邀約（JWT 仍是 b1，建立紀錄的身分是品牌）
reset role;
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd)
values ('00000000-0000-0000-0000-00000000cc01',
        '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-00000000a001',
        '春季新品開箱', 'IG 貼文 1 篇 + 限動 2 則', 4500);
set local role authenticated;
```

`supabase/tests/11_briefs.test.sql`「F. 錄取與婉拒」：三個錄取呼叫改成新函式（斷言數不變）：

```sql
-- 原本：$$select public.decide_application('00000000-0000-0000-0000-00000006a003', true)$$,
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000006a003', 5000, 'IG 貼文 1 篇')$$,
```
```sql
-- 原本：format('select public.decide_application(%L, true)',
  format('select public.accept_application_with_collab(%L, 5000, ''IG 貼文 1 篇'')',
```
```sql
-- 原本：$$select public.decide_application('00000000-0000-0000-0000-00000006a061', true)$$,
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000006a061', 5000, 'IG 貼文 1 篇')$$,
```
（只換這三行，斷言的期望值與說明文字不變：別的品牌與創作者錄取仍是 `P0002 application not found`，招募主錄取仍是 `lives_ok`；`decide_application(…, false)` 與 `null` 的斷言照舊。）

- [ ] **Step 5: 套用 migration、跑測試、產生型別**

```bash
npx supabase migration up
npx supabase test db
npm run db:types
```
Expected: 全部通過（`13_collab_create.test.sql` 37 個、`03` 44 個、`11` 斷言數不變）。本計畫撰寫時已在本機 rollback 的 transaction 裡跑過這份 migration 與上面四個測試檔，全部通過。`database.types.ts` 出現 `accept_application_with_collab`、`invite_creator`，`list_brief_applicants` 多了 `collaboration_id`。

- [ ] **Step 6: 其他檢查與 commit**

`src/app/brand/briefs/actions.ts` 還在呼叫 `decide_application(p_accept: true)`，這個 task 不改 TS（Task 5 改）；型別仍然相容，`npm run typecheck` 會過。

```bash
npm run lint && npm run typecheck && npm test
git add supabase/migrations/20261125000100_collab_create.sql supabase/tests/13_collab_create.test.sql \
  supabase/tests/03_collaborations.test.sql supabase/tests/11_briefs.test.sql src/lib/supabase/database.types.ts
git commit -m "計畫 6 Task 1：建立合作案只走函式（錄取、直接邀請）、收回直接 insert、索引"
```

---

### Task 2: 資料庫：交稿（私密 bucket、交稿紀錄、submit_deliverables）

**Files:**
- Create: `supabase/migrations/20261125000200_deliverables.sql`、`supabase/tests/14_deliverables.test.sql`
- Modify: `src/lib/supabase/database.types.ts`（產生）

**Interfaces:**
- Consumes: Task 1 的 migration；`public.text_items_within(text[], integer)`（計畫 5）、`transition_collaboration`。
- Produces：
  - bucket `deliverables`（私密、52428800 bytes、`image/jpeg, image/png, image/webp, video/mp4, video/quicktime, application/pdf`）；路徑 `<collab_id>/<creator_id>/<uuid>.<jpg|png|webp|mp4|mov|pdf>`。讀取：參與者與管理員；上傳：該合作案的創作者、自己的資料夾、狀態 awaiting_submission；刪除：上傳者本人、還沒出現在任何交稿紀錄；不能更新。
  - 資料表 `collaboration_submissions (id, collaboration_id, round, note, links text[], file_paths text[], created_at)`：參與者與管理員可 SELECT，沒有任何寫入權限。
  - `submit_deliverables(p_collab_id uuid, p_note text default null, p_links text[] default '{}', p_file_paths text[] default '{}') → integer`（第幾輪）。錯誤：`not authenticated`／`not collaboration creator`（42501）、`collaboration not found`（P0002）、`collaboration not awaiting submission`（55000）、`invalid note|links|file_paths`、`empty submission`（22023）。

- [ ] **Step 1: 寫失敗的測試 `supabase/tests/14_deliverables.test.sql`**

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- 721 品牌、722 別的品牌、731 創作者、739 管理員（沒有 profile）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000721', 'p6d-b1@test.local'),
  ('00000000-0000-0000-0000-000000000722', 'p6d-b2@test.local'),
  ('00000000-0000-0000-0000-000000000731', 'p6d-c1@test.local'),
  ('00000000-0000-0000-0000-000000000739', 'p6d-admin@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000721', 'brand', '交稿品牌'),
  ('00000000-0000-0000-0000-000000000722', 'brand', '旁觀品牌'),
  ('00000000-0000-0000-0000-000000000731', 'creator', '交稿創作者');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000739');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000721', '交稿品牌'),
  ('00000000-0000-0000-0000-000000000722', '旁觀品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000731', 'p6deliver', 'p6deliver', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000007c021', '00000000-0000-0000-0000-000000000721', '00000000-0000-0000-0000-000000000731');
-- dd01 待交稿、dd02 審核中
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status, review_due_at) values
  ('00000000-0000-0000-0000-0000000007d1', '00000000-0000-0000-0000-000000000721', '00000000-0000-0000-0000-000000000731',
   '00000000-0000-0000-0000-00000007c021', '待交稿', 'IG 貼文', 3000, 'awaiting_submission', null),
  ('00000000-0000-0000-0000-0000000007d2', '00000000-0000-0000-0000-000000000721', '00000000-0000-0000-0000-000000000731',
   '00000000-0000-0000-0000-00000007c021', '審核中', 'IG 貼文', 3000, 'in_review', now() + interval '3 days');

select is((select public from storage.buckets where id = 'deliverables'), false, 'bucket 是私密的');
select is((select file_size_limit from storage.buckets where id = 'deliverables'), 52428800::bigint, '檔案上限 50MB');
select is((select allowed_mime_types from storage.buckets where id = 'deliverables'),
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'application/pdf'],
  '只接受圖片、影片、PDF');

-- ── 上傳 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000731","role":"authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/11111111-1111-4111-8111-111111111111.jpg')$$,
  '創作者可以上傳到自己的資料夾');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/11111111-1111-4111-8111-111111111112.exe')$$,
  '42501', null, '副檔名不在清單裡');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d2/00000000-0000-0000-0000-000000000731/11111111-1111-4111-8111-111111111113.jpg')$$,
  '42501', null, '合作案不在待交稿時不能上傳');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000721/11111111-1111-4111-8111-111111111114.jpg')$$,
  '42501', null, '不能上傳到別人的資料夾');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/x/11111111-1111-4111-8111-111111111115.jpg')$$,
  '42501', null, '不能上傳到巢狀資料夾');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000721","role":"authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000721/11111111-1111-4111-8111-111111111116.jpg')$$,
  '42501', null, '品牌不能上傳');

-- ── 讀取 ──
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'), 1, '品牌讀得到合作案的檔案');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000722","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'), 0, '第三人讀不到');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000739","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'), 1, '管理員讀得到');

-- ── 交稿 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000721","role":"authenticated"}', true);
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null, array['https://drive.google.com/x'], '{}')$$,
  '42501', 'not collaboration creator', '品牌不能交稿');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000722","role":"authenticated"}', true);
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null, array['https://drive.google.com/x'], '{}')$$,
  'P0002', 'collaboration not found', '第三人看不到合作案');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000731","role":"authenticated"}', true);
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', '只有說明', '{}', '{}')$$,
  '22023', 'empty submission', '檔案或連結至少一個');
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null, '{}',
    array['00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/99999999-9999-4999-8999-999999999999.jpg'])$$,
  '22023', 'invalid file_paths', '檔案必須已經上傳');
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null, '{}',
    array['00000000-0000-0000-0000-0000000007d2/00000000-0000-0000-0000-000000000731/11111111-1111-4111-8111-111111111111.jpg'])$$,
  '22023', 'invalid file_paths', '檔案必須在這個合作案的資料夾');
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null, array['http://drive.google.com/x'], '{}')$$,
  '22023', 'invalid links', '連結必須是 https');
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null,
    array['https://a.com/1', 'https://a.com/2', 'https://a.com/3', 'https://a.com/4', 'https://a.com/5', 'https://a.com/6'], '{}')$$,
  '22023', 'invalid links', '連結最多 5 個');
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', repeat('字', 1001), array['https://a.com/1'], '{}')$$,
  '22023', 'invalid note', '說明最多 1000 字');
select is(
  public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', ' 初稿 ', array[' https://drive.google.com/x '],
    array['00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/11111111-1111-4111-8111-111111111111.jpg']),
  1, '第一次交稿');
select is(
  (select c.status::text || '|' || s.note || '|' || s.links[1] from public.collaborations c
     join public.collaboration_submissions s on s.collaboration_id = c.id
    where c.id = '00000000-0000-0000-0000-0000000007d1'),
  'in_review|初稿|https://drive.google.com/x', '交稿紀錄已清理，合作案進入審核');
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null, array['https://a.com/1'], '{}')$$,
  '55000', 'collaboration not awaiting submission', '審核中不能再交稿');
select throws_ok(
  $$insert into public.collaboration_submissions (collaboration_id, round, links)
    values ('00000000-0000-0000-0000-0000000007d1', 9, array['https://a.com/1'])$$,
  '42501', null, '不能直接寫入交稿紀錄');

-- ── 刪除 ──
select set_config('storage.allow_delete_query', 'true', true);
select lives_ok(
  $$delete from storage.objects where bucket_id = 'deliverables'
     and name = '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/11111111-1111-4111-8111-111111111111.jpg'$$,
  '刪除已交出的檔案不報錯（RLS 讓影響 0 列）');
reset role;
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'), 1, '已交出的檔案沒有被刪');

-- 品牌要求修改 → 創作者再上傳、刪掉一個、再交一次
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000721","role":"authenticated"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-0000000007d1', 'request_changes', '亮一點'),
  'awaiting_submission'::public.collab_status, '品牌要求修改');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000731","role":"authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/22222222-2222-4222-8222-222222222222.pdf')$$,
  '退回後可以再上傳');
select lives_ok(
  $$delete from storage.objects where bucket_id = 'deliverables'
     and name = '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/22222222-2222-4222-8222-222222222222.pdf'$$,
  '可以刪掉還沒交出的檔案');
reset role;
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'), 1, '還沒交出的檔案已刪除');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000731","role":"authenticated"}', true);
select is(
  public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null, array['https://drive.google.com/y'], '{}'),
  2, '第二次交稿的輪次是 2');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/33333333-3333-4333-8333-333333333333.jpg')$$,
  '42501', null, '交稿後（審核中）不能再上傳');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000721","role":"authenticated"}', true);
select is((select count(*)::int from public.collaboration_submissions), 2, '品牌讀得到兩次交稿');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000722","role":"authenticated"}', true);
select is((select count(*)::int from public.collaboration_submissions), 0, '第三人讀不到交稿紀錄');

select * from finish();
rollback;
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx supabase test db`
Expected: `14_deliverables.test.sql` 失敗（bucket 不存在、函式不存在），其他通過。

- [ ] **Step 3: 寫 migration `supabase/migrations/20261125000200_deliverables.sql`**

```sql
-- 合作案（計畫 6）之二：交稿。私密 bucket deliverables、交稿紀錄 collaboration_submissions、submit_deliverables。
-- 權限一律在這裡明確寫出（雲端新專案不會自動授權，本機會）。

-- 1. 私密 bucket：50 MB；圖片、影片、PDF。路徑 <collab_id>/<creator_id>/<uuid>.<副檔名>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deliverables', 'deliverables', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 路徑格式（與 src/lib/deliverables.ts 的 DELIVERABLE_NAME_RE 相同）：檔名是 uuid + 允許的副檔名
create function public.deliverable_path_ok(p_collab_id uuid, p_creator_id uuid, p_name text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    p_name ~ ('^' || p_collab_id::text || '/' || p_creator_id::text
              || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|mp4|mov|pdf)$'),
    false);
$$;
revoke execute on function public.deliverable_path_ok(uuid, uuid, text) from public, anon, authenticated, service_role;

-- 2. 交稿紀錄：只能經由 submit_deliverables 寫入；雙方與管理員可讀
create table public.collaboration_submissions (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations (id),
  round integer not null check (round >= 1),
  note text check (note is null or char_length(note) between 1 and 1000),
  links text[] not null default '{}'
    check (cardinality(links) <= 5 and public.text_items_within(links, 500)),
  file_paths text[] not null default '{}' check (cardinality(file_paths) <= 10),
  created_at timestamptz not null default now(),
  unique (collaboration_id, round),
  check (cardinality(links) + cardinality(file_paths) >= 1)
);
-- unique (collaboration_id, round) 本身就是 (collaboration_id, round) 的索引

alter table public.collaboration_submissions enable row level security;
create policy collaboration_submissions_select on public.collaboration_submissions
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.collaborations c
       where c.id = collaboration_submissions.collaboration_id
         and (c.brand_id = auth.uid() or c.creator_id = auth.uid())
    )
  );
revoke all on public.collaboration_submissions from anon, authenticated, service_role;
grant select on public.collaboration_submissions to authenticated, service_role;

-- 3. Storage policy 用的 helper（definer：讀合作案與交稿紀錄時不經過 RLS）
-- 讀取：該合作案的品牌、創作者或管理員
create function public.can_read_deliverable(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    public.is_admin()
    or exists (
      select 1 from public.collaborations c
       where p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
         and c.id = split_part(p_name, '/', 1)::uuid
         and (c.brand_id = auth.uid() or c.creator_id = auth.uid())
    )
  );
$$;
-- 上傳：只有該合作案的創作者、寫在自己的資料夾、合作案在 awaiting_submission、檔名合規
create function public.can_upload_deliverable(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.collaborations c
     where p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
       and c.id = split_part(p_name, '/', 1)::uuid
       and c.creator_id = auth.uid()
       and c.status = 'awaiting_submission'
       and public.deliverable_path_ok(c.id, c.creator_id, p_name)
  );
$$;
-- 刪除：只有上傳的創作者本人、而且這個檔案還沒出現在任何一次交稿紀錄裡
create function public.can_delete_deliverable(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and split_part(p_name, '/', 2) = auth.uid()::text
    and not exists (
      select 1 from public.collaboration_submissions s where p_name = any (s.file_paths)
    );
$$;
revoke execute on function public.can_read_deliverable(text) from public, anon, authenticated, service_role;
revoke execute on function public.can_upload_deliverable(text) from public, anon, authenticated, service_role;
revoke execute on function public.can_delete_deliverable(text) from public, anon, authenticated, service_role;
grant execute on function public.can_read_deliverable(text) to authenticated;
grant execute on function public.can_upload_deliverable(text) to authenticated;
grant execute on function public.can_delete_deliverable(text) to authenticated;

-- 沒有 update policy：交出去的檔案不能被換掉（上傳一律 upsert = false）
create policy deliverables_select on storage.objects
  for select to authenticated
  using (bucket_id = 'deliverables' and public.can_read_deliverable(name));
create policy deliverables_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'deliverables' and public.can_upload_deliverable(name));
create policy deliverables_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'deliverables' and public.can_delete_deliverable(name));

-- 4. 創作者交稿：在同一個 transaction 新增交稿紀錄並把合作案推進到 in_review。回傳第幾次交稿。
--    說明 ≤ 1000 字；連結 ≤ 5 個 https 網址、每個 ≤ 500 字；檔案 ≤ 10 個、不重複、
--    必須是這個合作案創作者資料夾裡、已經上傳的物件。檔案或連結至少一個。
create function public.submit_deliverables(
  p_collab_id uuid, p_note text default null, p_links text[] default '{}', p_file_paths text[] default '{}'
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  c public.collaborations%rowtype;
  v_note text := nullif(public.clean_text(p_note), '');
  v_links text[];
  v_files text[] := coalesce(p_file_paths, '{}');
  v_round integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into c from public.collaborations where id = p_collab_id for update;
  if not found or (c.brand_id <> v_uid and c.creator_id <> v_uid) then
    raise exception 'collaboration not found' using errcode = 'P0002';
  end if;
  if c.creator_id <> v_uid then
    raise exception 'not collaboration creator' using errcode = '42501';
  end if;
  if c.status <> 'awaiting_submission' then
    raise exception 'collaboration not awaiting submission' using errcode = '55000';
  end if;
  if v_note is not null and (public.has_bidi(v_note) or char_length(v_note) > 1000) then
    raise exception 'invalid note' using errcode = '22023';
  end if;
  select coalesce(array_agg(public.clean_text(l) order by o), '{}') into v_links
    from unnest(coalesce(p_links, '{}')) with ordinality as t(l, o);
  if cardinality(v_links) > 5 or exists (
       select 1 from unnest(v_links) l
        where l is null or char_length(l) > 500 or public.has_bidi(l)
           or l !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/\S*)?$'
     ) then
    raise exception 'invalid links' using errcode = '22023';
  end if;
  if cardinality(v_files) > 10
     or cardinality(v_files) <> (select count(distinct f) from unnest(v_files) f)
     or exists (
       select 1 from unnest(v_files) f
        where f is null
           or not public.deliverable_path_ok(c.id, c.creator_id, f)
           or not exists (select 1 from storage.objects o where o.bucket_id = 'deliverables' and o.name = f)
     ) then
    raise exception 'invalid file_paths' using errcode = '22023';
  end if;
  if cardinality(v_links) + cardinality(v_files) = 0 then
    raise exception 'empty submission' using errcode = '22023';
  end if;

  select coalesce(max(s.round), 0) + 1 into v_round
    from public.collaboration_submissions s where s.collaboration_id = c.id;
  insert into public.collaboration_submissions (collaboration_id, round, note, links, file_paths)
  values (c.id, v_round, v_note, v_links, v_files);
  perform public.transition_collaboration(c.id, 'submit');
  return v_round;
end;
$$;
revoke execute on function public.submit_deliverables(uuid, text, text[], text[]) from public, anon, authenticated, service_role;
grant execute on function public.submit_deliverables(uuid, text, text[], text[]) to authenticated;
```

- [ ] **Step 4: 套用、測試、產生型別**

```bash
npx supabase migration up
npx supabase test db
npm run db:types
```
Expected: 全部通過（`14_deliverables.test.sql` 34 個；撰寫時已在本機 rollback 的 transaction 裡跑過）。`database.types.ts` 出現 `collaboration_submissions` 與 `submit_deliverables`。

- [ ] **Step 5: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add supabase/migrations/20261125000200_deliverables.sql supabase/tests/14_deliverables.test.sql src/lib/supabase/database.types.ts
git commit -m "計畫 6 Task 2：交稿（私密 bucket deliverables、交稿紀錄、submit_deliverables）"
```

---

### Task 3: 資料庫：列表、詳情、系統事件、審核逾期自動通過

**Files:**
- Create: `supabase/migrations/20261125000300_collab_reads.sql`、`supabase/tests/15_collab_reads.test.sql`
- Modify: `src/lib/supabase/database.types.ts`（產生）

**Interfaces:**
- Consumes: Task 1、2 的 migration。
- Produces：
  - `list_my_collaborations(p_tab text default 'active')` → 列 `(id uuid, title text, amount_twd integer, status text, updated_at timestamptz, brief_id uuid, my_side text, counterpart_name text, counterpart_image_path text, counterpart_handle text, my_turn boolean)`；`my_side` 是 `brand`／`creator`；`counterpart_image_path` 在品牌視角是創作者的 `avatar_path`（bucket `creator-media`），在創作者視角是品牌的 `logo_path`（bucket `brand-logos`）；`counterpart_handle` 只有品牌視角有值。
  - `get_collaboration(p_id uuid)` → 0 或 1 列 `(id, title, deliverables, amount_twd, status text, review_due_at, published_url, created_at, updated_at, brief_id, brief_title, my_side text /* brand|creator|admin */, brand_id, brand_name, brand_logo_path, creator_id, creator_name, creator_handle, creator_avatar_path)`。
  - `list_collaboration_events(p_id uuid)` → 列 `(id bigint, action text, actor_kind text, actor_name text, from_status text, to_status text, note text, created_at timestamptz)`，依時間排序；看不到時 0 列。
  - `auto_approve_due()` → 一列 `(approved integer, failed uuid[])`，只有 service_role 能執行。
  - `collab_turn(status) → text`（內部用；TS 的 `turnOf` 同一條規則）。

- [ ] **Step 1: 寫失敗的測試 `supabase/tests/15_collab_reads.test.sql`**

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- 741 品牌、742 旁觀品牌、743 自動通過用的品牌；751、752 創作者；759 管理員（沒有 profile）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000741', 'p6r-b1@test.local'),
  ('00000000-0000-0000-0000-000000000742', 'p6r-b2@test.local'),
  ('00000000-0000-0000-0000-000000000743', 'p6r-b3@test.local'),
  ('00000000-0000-0000-0000-000000000751', 'p6r-c1@test.local'),
  ('00000000-0000-0000-0000-000000000752', 'p6r-c2@test.local'),
  ('00000000-0000-0000-0000-000000000759', 'p6r-admin@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000741', 'brand', '列表品牌'),
  ('00000000-0000-0000-0000-000000000742', 'brand', '旁觀品牌'),
  ('00000000-0000-0000-0000-000000000743', 'brand', '自動品牌'),
  ('00000000-0000-0000-0000-000000000751', 'creator', '列表小美'),
  ('00000000-0000-0000-0000-000000000752', 'creator', '待審阿哲');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000759');
insert into public.brand_profiles (user_id, brand_name, logo_path) values
  ('00000000-0000-0000-0000-000000000741', '列表品牌', null),
  ('00000000-0000-0000-0000-000000000742', '旁觀品牌', null),
  ('00000000-0000-0000-0000-000000000743', '自動品牌', null);
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000751', 'p6list', 'p6list', 'approved'),
  ('00000000-0000-0000-0000-000000000752', 'p6pending', 'p6pending', 'pending');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000007c041', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000751'),
  ('00000000-0000-0000-0000-00000007c042', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000752'),
  ('00000000-0000-0000-0000-00000007c043', '00000000-0000-0000-0000-000000000743', '00000000-0000-0000-0000-000000000751');
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status, review_due_at, updated_at) values
  ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000751',
   '00000000-0000-0000-0000-00000007c041', 'f1 邀約', 'x', 1000, 'invited', null, now() - interval '3 hours'),
  ('00000000-0000-0000-0000-0000000007e2', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000751',
   '00000000-0000-0000-0000-00000007c041', 'f2 待付款', 'x', 1000, 'awaiting_payment', null, now() - interval '2 hours'),
  ('00000000-0000-0000-0000-0000000007e3', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000751',
   '00000000-0000-0000-0000-00000007c041', 'f3 審核', 'x', 1000, 'in_review', now() + interval '2 days', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000007e4', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000751',
   '00000000-0000-0000-0000-00000007c041', 'f4 完成', 'x', 1000, 'completed', null, now()),
  ('00000000-0000-0000-0000-0000000007e5', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000751',
   '00000000-0000-0000-0000-00000007c041', 'f5 取消', 'x', 1000, 'cancelled', null, now()),
  ('00000000-0000-0000-0000-0000000007e6', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000752',
   '00000000-0000-0000-0000-00000007c042', 'f6 婉拒', 'x', 1000, 'declined', null, now()),
  ('00000000-0000-0000-0000-0000000007e7', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000752',
   '00000000-0000-0000-0000-00000007c042', 'f7 撥款', 'x', 1000, 'awaiting_payout', null, now() - interval '4 hours'),
  ('00000000-0000-0000-0000-0000000007e8', '00000000-0000-0000-0000-000000000743', '00000000-0000-0000-0000-000000000751',
   '00000000-0000-0000-0000-00000007c043', 'f8 逾期', 'x', 1000, 'in_review', now() - interval '1 minute', now()),
  ('00000000-0000-0000-0000-0000000007e9', '00000000-0000-0000-0000-000000000743', '00000000-0000-0000-0000-000000000751',
   '00000000-0000-0000-0000-00000007c043', 'f9 未到期', 'x', 1000, 'in_review', now() + interval '1 hour', now());

select is(public.collab_turn('in_review'), 'brand', '審核輪到品牌（與 TS 的 turnOf 相同）');

-- ── 列表 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000741","role":"authenticated"}', true);
select is(
  (select string_agg(t.title, ',' order by t.ordinality) from public.list_my_collaborations('active') with ordinality t),
  'f3 審核,f2 待付款,f1 邀約,f7 撥款', '品牌：輪到我的在前，其次依更新時間');
select is((select count(*)::int from public.list_my_collaborations('completed')), 1, '已完成分頁');
select is((select count(*)::int from public.list_my_collaborations('cancelled')), 2, '已取消分頁含婉拒');
select is((select count(*)::int from public.list_my_collaborations('垃圾')), 4, '不認得的分頁當成進行中');
select is(
  (select my_side || '|' || my_turn || '|' || counterpart_name || '|' || counterpart_handle
     from public.list_my_collaborations('active') where title = 'f3 審核'),
  'brand|true|列表小美|p6list', '品牌看到對方創作者的名稱與 handle');
select is(
  (select counterpart_name from public.list_my_collaborations('active') where title = 'f7 撥款'),
  '待審阿哲', '待審核創作者的名稱也帶得出來');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000751","role":"authenticated"}', true);
select is(
  (select string_agg(t.title, ',' order by t.ordinality) from public.list_my_collaborations('active') with ordinality t),
  'f1 邀約,f8 逾期,f9 未到期,f3 審核,f2 待付款', '創作者：輪到我的在前');
select is(
  (select my_side || '|' || counterpart_name || '|' || coalesce(counterpart_handle, 'null')
     from public.list_my_collaborations('active') where title = 'f1 邀約'),
  'creator|列表品牌|null', '創作者看到品牌名稱');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000742","role":"authenticated"}', true);
select is((select count(*)::int from public.list_my_collaborations('active')), 0, '第三人的列表是空的');

-- ── 詳情 ──
select is((select count(*)::int from public.get_collaboration('00000000-0000-0000-0000-0000000007e2')), 0, '第三人拿不到詳情');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000741","role":"authenticated"}', true);
select is(
  (select my_side || '|' || brand_name || '|' || creator_name || '|' || creator_handle || '|' || coalesce(brief_title, 'null')
     from public.get_collaboration('00000000-0000-0000-0000-0000000007e2')),
  'brand|列表品牌|列表小美|p6list|null', '品牌拿到詳情');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000751","role":"authenticated"}', true);
select is((select my_side from public.get_collaboration('00000000-0000-0000-0000-0000000007e2')), 'creator', '創作者拿到詳情');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000759","role":"authenticated"}', true);
select is((select my_side from public.get_collaboration('00000000-0000-0000-0000-0000000007e2')), 'admin', '管理員拿到詳情');

-- ── 系統事件 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000751","role":"authenticated"}', true);
select is(public.transition_collaboration('00000000-0000-0000-0000-0000000007e1', 'accept'),
  'awaiting_payment'::public.collab_status, '創作者接受邀約');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000741","role":"authenticated"}', true);
select is(
  (select string_agg(action || ':' || actor_kind || ':' || actor_name, ',' order by id)
     from public.list_collaboration_events('00000000-0000-0000-0000-0000000007e1')),
  'create:system:系統,accept:creator:列表小美', '事件附上做事的人的名稱');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000742","role":"authenticated"}', true);
select is((select count(*)::int from public.list_collaboration_events('00000000-0000-0000-0000-0000000007e1')), 0, '第三人拿不到事件');

-- ── 自動通過 ──
select throws_ok($$select * from public.auto_approve_due()$$, '42501', null, '一般使用者不能呼叫自動通過');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select ok((select approved from public.auto_approve_due()) >= 1, 'service_role 呼叫自動通過，回傳處理件數');
select is((select status::text from public.collaborations where id = '00000000-0000-0000-0000-0000000007e8'),
  'awaiting_publish', '逾期的審核自動通過');
select is((select status::text from public.collaborations where id = '00000000-0000-0000-0000-0000000007e9'),
  'in_review', '還沒到期的不動');
select is(
  (select actor_kind from public.audit_logs where collaboration_id = '00000000-0000-0000-0000-0000000007e8' and action = 'auto_approve'),
  'system', '自動通過記為系統');

select * from finish();
rollback;
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx supabase test db`
Expected: `15_collab_reads.test.sql` 失敗（函式不存在），其他通過。

- [ ] **Step 3: 寫 migration `supabase/migrations/20261125000300_collab_reads.sql`**

```sql
-- 合作案（計畫 6）之三：列表、詳情、系統事件的讀取函式，與審核逾期自動通過。
-- 權限一律在這裡明確寫出（雲端新專案不會自動授權，本機會）。

-- 1. 輪到誰（與 src/lib/collabs/view.ts 的 turnOf 相同規則）：brand、creator、platform 或 null（已結束）
create function public.collab_turn(p_status public.collab_status) returns text
language sql immutable set search_path = '' as $$
  select case p_status
    when 'invited' then 'creator'
    when 'awaiting_payment' then 'brand'
    when 'awaiting_submission' then 'creator'
    when 'in_review' then 'brand'
    when 'awaiting_publish' then 'creator'
    when 'awaiting_payout' then 'platform'
    else null
  end;
$$;
revoke execute on function public.collab_turn(public.collab_status) from public, anon, authenticated, service_role;

-- 2. 我的合作案列表。p_tab：active（invited..awaiting_payout）、completed、cancelled（declined + cancelled）；
--    其他值一律當 active。只列自己是品牌或創作者的（管理員看全部是計畫 9 的後台）。
--    對方的名稱與頭像：品牌讀不到 pending 創作者的 profile，所以用 definer 帶出。
--    排序：輪到我的在前，其次依更新時間由新到舊。最多 200 筆。
create function public.list_my_collaborations(p_tab text default 'active')
returns table (
  id uuid,
  title text,
  amount_twd integer,
  status text,
  updated_at timestamptz,
  brief_id uuid,
  my_side text,
  counterpart_name text,
  counterpart_image_path text,
  counterpart_handle text,
  my_turn boolean
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_statuses public.collab_status[] := case p_tab
    when 'completed' then array['completed']::public.collab_status[]
    when 'cancelled' then array['declined', 'cancelled']::public.collab_status[]
    else array['invited', 'awaiting_payment', 'awaiting_submission', 'in_review',
               'awaiting_publish', 'awaiting_payout']::public.collab_status[]
  end;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  return query
  select x.id, x.title, x.amount_twd, x.status::text, x.updated_at, x.brief_id, x.side,
         x.counterpart_name, x.counterpart_image_path, x.counterpart_handle,
         coalesce(public.collab_turn(x.status) = x.side, false)
    from (
      select c.id, c.title, c.amount_twd, c.status, c.updated_at, c.brief_id,
             case when c.brand_id = v_uid then 'brand' else 'creator' end as side,
             case when c.brand_id = v_uid then cp_profile.display_name else bp.brand_name end as counterpart_name,
             case when c.brand_id = v_uid then cp.avatar_path else bp.logo_path end as counterpart_image_path,
             case when c.brand_id = v_uid then cp.handle else null end as counterpart_handle
        from public.collaborations c
        join public.brand_profiles bp on bp.user_id = c.brand_id
        join public.creator_profiles cp on cp.user_id = c.creator_id
        join public.profiles cp_profile on cp_profile.id = c.creator_id
       where (c.brand_id = v_uid or c.creator_id = v_uid)
         and c.status = any (v_statuses)
    ) x
   order by coalesce(public.collab_turn(x.status) = x.side, false) desc, x.updated_at desc, x.id
   limit 200;
end;
$$;
revoke execute on function public.list_my_collaborations(text) from public, anon, authenticated, service_role;
grant execute on function public.list_my_collaborations(text) to authenticated;

-- 3. 一個合作案的詳情：合作案欄位、我是哪一方（brand > creator > admin，與 transition_collaboration 相同）、
--    雙方的公開資料、招募名稱。不是參與者也不是管理員：0 列（頁面顯示 404）。
create function public.get_collaboration(p_id uuid)
returns table (
  id uuid,
  title text,
  deliverables text,
  amount_twd integer,
  status text,
  review_due_at timestamptz,
  published_url text,
  created_at timestamptz,
  updated_at timestamptz,
  brief_id uuid,
  brief_title text,
  my_side text,
  brand_id uuid,
  brand_name text,
  brand_logo_path text,
  creator_id uuid,
  creator_name text,
  creator_handle text,
  creator_avatar_path text
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  return query
  select c.id, c.title, c.deliverables, c.amount_twd, c.status::text, c.review_due_at, c.published_url,
         c.created_at, c.updated_at, c.brief_id, b.title,
         case when c.brand_id = v_uid then 'brand' when c.creator_id = v_uid then 'creator' else 'admin' end,
         c.brand_id, bp.brand_name, bp.logo_path,
         c.creator_id, p.display_name, cp.handle, cp.avatar_path
    from public.collaborations c
    join public.brand_profiles bp on bp.user_id = c.brand_id
    join public.creator_profiles cp on cp.user_id = c.creator_id
    join public.profiles p on p.id = c.creator_id
    left join public.briefs b on b.id = c.brief_id
   where c.id = p_id
     and (c.brand_id = v_uid or c.creator_id = v_uid or public.is_admin());
end;
$$;
revoke execute on function public.get_collaboration(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_collaboration(uuid) to authenticated;

-- 4. 系統事件（audit_logs）依時間排列，附上做事的人的顯示名稱（讀取時才 join）：
--    品牌 → 品牌名稱、創作者 → 顯示名稱、管理員 → 「平台」、系統 → 「系統」。只有參與者與管理員看得到。
create function public.list_collaboration_events(p_id uuid)
returns table (
  id bigint,
  action text,
  actor_kind text,
  actor_name text,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.collaborations c
                  where c.id = p_id and (c.brand_id = v_uid or c.creator_id = v_uid or public.is_admin())) then
    return;
  end if;
  return query
  select l.id, l.action, l.actor_kind,
         case l.actor_kind
           when 'brand' then coalesce(bp.brand_name, '品牌')
           when 'creator' then coalesce(p.display_name, '創作者')
           when 'admin' then '平台'
           else '系統'
         end,
         l.from_status::text, l.to_status::text, l.note, l.created_at
    from public.audit_logs l
    left join public.brand_profiles bp on l.actor_kind = 'brand' and bp.user_id = l.actor_id
    left join public.profiles p on l.actor_kind = 'creator' and p.id = l.actor_id
   where l.collaboration_id = p_id
   order by l.created_at, l.id;
end;
$$;
revoke execute on function public.list_collaboration_events(uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_collaboration_events(uuid) to authenticated;

-- 5. 審核逾期自動通過：只給 service_role（Vercel Cron → /api/cron/auto-approve → PostgREST）。
--    transition_collaboration 要求「PostgREST 以 service_role 呼叫」才是 system；pg_cron（postgres）會被判定為不是參與者，
--    所以不用 pg_cron（followups「10. 審核逾期自動通過」）。一件失敗不影響其他件：失敗的 id 回傳給 route 記 log。
create function public.auto_approve_due()
returns table (approved integer, failed uuid[])
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_ok integer := 0;
  v_failed uuid[] := '{}';
begin
  for r in
    select c.id from public.collaborations c
     where c.status = 'in_review' and c.review_due_at <= now()
     order by c.review_due_at, c.id
  loop
    begin
      perform public.transition_collaboration(r.id, 'auto_approve');
      v_ok := v_ok + 1;
    exception when others then
      raise warning 'auto_approve_due: % failed: % %', r.id, sqlstate, sqlerrm;
      v_failed := v_failed || r.id;
    end;
  end loop;
  return query select v_ok, v_failed;
end;
$$;
revoke execute on function public.auto_approve_due() from public, anon, authenticated, service_role;
grant execute on function public.auto_approve_due() to service_role;
```

- [ ] **Step 4: 套用、測試、產生型別**

```bash
npx supabase migration up
npx supabase test db
npm run db:types
```
Expected: 全部通過（`15_collab_reads.test.sql` 22 個；撰寫時已在本機 rollback 的 transaction 裡跑過）。注意：`auto_approve_due` 的件數斷言是 `>= 1`，因為本機資料庫可能有 E2E 留下的逾期合作案；逐件的斷言只看本檔的 fixture。

- [ ] **Step 5: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add supabase/migrations/20261125000300_collab_reads.sql supabase/tests/15_collab_reads.test.sql src/lib/supabase/database.types.ts
git commit -m "計畫 6 Task 3：合作案列表、詳情、系統事件與審核逾期自動通過函式"
```

---

### Task 4: 純函式：狀態與文字、表單驗證、交稿檔案、錯誤對應

**Files:**
- Create: `src/lib/collabs/view.ts`、`src/lib/collabs/view.test.ts`、`src/lib/validation/collab.ts`、`src/lib/validation/collab.test.ts`、`src/lib/deliverables.ts`、`src/lib/deliverables.test.ts`、`src/lib/collabs/errors.ts`、`src/lib/collabs/errors.test.ts`
- Modify: `src/lib/briefs/errors.ts`、`src/lib/briefs/errors.test.ts`

**Interfaces:**
- Consumes: `formatTwd`（`src/lib/format.ts`）、`formatDateTimeTw`（`src/lib/briefs/dates.ts`）、`cleanText`／`cleanTextWithin`（`src/lib/validation/onboarding.ts`）、`hasBadChar`／`textLength`（`src/lib/validation/brief.ts`）。
- Produces（後面的 task 依賴，名稱與型別以下面的程式碼為準）：
  - `src/lib/collabs/view.ts`：`CollabStatus`、`CollabSide`、`Turn`、`toCollabStatus`、`COLLAB_STATUS_LABEL`、`turnOf`、`COLLAB_STEPS`、`StepState`、`stepStates`、`stepNumber`、`escrowLabel`、`caseCode`、`CollabTab`、`COLLAB_TABS`、`parseCollabTab`、`ListBadge`、`listBadge`、`CollabListItem`／`CollabListRow`／`toCollabListItem`、`Collab`／`CollabRow`／`toCollab`、`sourceLabel`、`actionCardCopy`、`nowMs`、`reviewCountdown`、`Submission`／`SubmissionRow`／`toSubmission`、`CollabEvent`／`EventRow`／`toCollabEvent`、`eventText`、`eventTime`、`revisionNotesByRound`。
  - `src/lib/validation/collab.ts`：`TITLE_MAX`、`DELIVERABLES_MAX`、`NOTE_MAX`、`LINKS_MAX`、`AMOUNT_MAX`、`cleanLongText`、`parseAmount`、`OfferInput`、`parseOfferForm`、`validateOffer(i, withTitle)`、`validateRevisionNote`、`isValidPostUrl`、`isValidLink`、`parseLinks`、`SubmissionInput`、`validateSubmission(i, collabId, uid)`、`acceptDefaults(proposedPrice, brief)`。
  - `src/lib/deliverables.ts`：`DELIVERABLES_BUCKET`、`DELIVERABLE_MAX_BYTES`、`MAX_DELIVERABLE_FILES`、`SIGNED_URL_SECONDS`、`DELIVERABLE_ACCEPT`、`planDeliverableUpload`、`isOwnDeliverablePath`、`FileKind`、`fileKindOf`、`fileLabel`。
  - `src/lib/collabs/errors.ts`：`COLLAB_STALE_MESSAGE`、`collabErrorMessage`、`collabFieldError`。
  - `isStaleStateMessage`（`src/lib/briefs/errors.ts`）也認得 `COLLAB_STALE_MESSAGE`，所以既有的 `ConfirmAction` 遇到合作案的「狀態已變」會自動重新整理。

- [ ] **Step 1: 寫失敗的測試**

`src/lib/collabs/view.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import {
  actionCardCopy, caseCode, COLLAB_STEPS, escrowLabel, eventText, eventTime, listBadge, parseCollabTab,
  reviewCountdown, revisionNotesByRound, stepNumber, stepStates, toCollab, toCollabEvent, toCollabListItem,
  toCollabStatus, toSubmission, turnOf, type CollabEvent, type CollabStatus, type Submission,
} from "./view";

const ALL: CollabStatus[] = [
  "invited", "awaiting_payment", "awaiting_submission", "in_review",
  "awaiting_publish", "awaiting_payout", "completed", "declined", "cancelled",
];

describe("狀態", () => {
  it("不認得的狀態當成已取消", () => {
    expect(toCollabStatus("in_review")).toBe("in_review");
    expect(toCollabStatus("bogus")).toBe("cancelled");
    expect(toCollabStatus(null)).toBe("cancelled");
  });
  it("輪到誰（與 SQL collab_turn 同一張表）", () => {
    expect(ALL.map(turnOf)).toEqual([
      "creator", "brand", "creator", "brand", "creator", "platform", null, null, null,
    ]);
  });
});

describe("進度條", () => {
  it("7 步", () => expect(COLLAB_STEPS).toHaveLength(7));
  it("待付款：邀約已完成、確認是目前步驟", () => {
    expect(stepStates("awaiting_payment")).toEqual(["done", "current", "todo", "todo", "todo", "todo", "todo"]);
    expect(stepNumber("awaiting_payment")).toBe(2);
  });
  it("待交稿：付款託管已完成", () => {
    expect(stepStates("awaiting_submission")).toEqual(["done", "done", "done", "current", "todo", "todo", "todo"]);
    expect(stepNumber("awaiting_submission")).toBe(4);
  });
  it("撥款中是第 7 步；已完成全部完成", () => {
    expect(stepNumber("awaiting_payout")).toBe(7);
    expect(stepStates("completed")).toEqual(Array(7).fill("done"));
    expect(stepNumber("completed")).toBe(7);
  });
  it("婉拒與取消沒有進度條", () => {
    expect(stepStates("declined")).toBeNull();
    expect(stepNumber("cancelled")).toBeNull();
  });
});

describe("金額與案號", () => {
  it("託管文字", () => {
    expect(escrowLabel("awaiting_payment", 4500)).toBe("NT$4,500 待付款");
    expect(escrowLabel("in_review", 4500)).toBe("NT$4,500 已託管");
    expect(escrowLabel("completed", 4500)).toBe("NT$4,500 已撥款");
    expect(escrowLabel("cancelled", 4500)).toBe("NT$4,500 未成立");
  });
  it("案號是 id 前 8 碼", () => {
    expect(caseCode("1a2b3c4d-0000-0000-0000-000000000000")).toBe("1a2b3c4d");
  });
});

describe("列表", () => {
  it("分頁：垃圾值當成進行中", () => {
    expect(parseCollabTab(undefined)).toBe("active");
    expect(parseCollabTab("completed")).toBe("completed");
    expect(parseCollabTab(["cancelled", "x"])).toBe("cancelled");
    expect(parseCollabTab("drop table")).toBe("active");
  });
  it("輪到你／等對方／撥款處理中", () => {
    expect(listBadge("in_review", "brand")).toEqual({ label: "輪到你", tone: "turn" });
    expect(listBadge("in_review", "creator")).toEqual({ label: "等對方", tone: "wait" });
    expect(listBadge("awaiting_payout", "brand")).toEqual({ label: "撥款處理中", tone: "platform" });
    expect(listBadge("completed", "brand")).toBeNull();
  });
  it("Row 的 null 都有預設值", () => {
    expect(toCollabListItem({
      id: "c1", title: null, amount_twd: null, status: null, updated_at: null, my_side: "creator",
      counterpart_name: null, counterpart_image_path: null, counterpart_handle: null, my_turn: null,
    })).toEqual({
      id: "c1", title: "", amount: 0, status: "cancelled", updatedAt: "", side: "creator",
      counterpartName: "", counterpartImagePath: null, counterpartHandle: null, myTurn: false,
    });
  });
});

describe("詳情", () => {
  it("toCollab：my_side 不是 brand／creator 就是 admin", () => {
    const c = toCollab({
      id: "c1", title: "案", deliverables: null, amount_twd: 4500, status: "in_review", review_due_at: null,
      published_url: null, created_at: null, updated_at: null, brief_id: null, brief_title: null, my_side: "x",
      brand_id: null, brand_name: null, brand_logo_path: null, creator_id: null, creator_name: null,
      creator_handle: null, creator_avatar_path: null,
    });
    expect(c).toMatchObject({ title: "案", deliverables: "", amount: 4500, status: "in_review", side: "admin" });
  });
  it("卡片：輪到對方時一定寫你不用做任何事", () => {
    for (const s of ALL) {
      for (const side of ["brand", "creator"] as const) {
        const copy = actionCardCopy(s, side);
        if (turnOf(s) !== null && !copy.mine) expect(copy.body).toContain("你不用做任何事");
      }
    }
    expect(actionCardCopy("in_review", "brand")).toMatchObject({ mine: true, title: "輪到你：審核交稿" });
    expect(actionCardCopy("in_review", "creator")).toMatchObject({ mine: false, title: "等對方審核" });
    expect(actionCardCopy("awaiting_payment", "brand").body).toContain("等待付款確認");
  });
  it("審核倒數", () => {
    const now = Date.parse("2026-11-25T00:00:00Z");
    expect(reviewCountdown(null, now)).toBeNull();
    expect(reviewCountdown("2026-11-27T05:30:00Z", now)).toBe("剩 2 天 05 小時後自動通過");
    expect(reviewCountdown("2026-11-25T23:00:00Z", now)).toBe("剩 0 天 23 小時後自動通過");
    expect(reviewCountdown("2026-11-25T00:30:00Z", now)).toBe("不到 1 小時後自動通過");
    expect(reviewCountdown("2026-11-25T00:00:00Z", now)).toBe("即將自動通過");
    expect(reviewCountdown("not a date", now)).toBeNull();
  });
});

describe("交稿與事件", () => {
  const ev = (o: Partial<CollabEvent>): CollabEvent => ({
    id: 1, action: "submit", actorKind: "creator", actorName: "小美", toStatus: null, note: null, createdAt: "2026-11-25T03:00:00Z", ...o,
  });
  it("事件文字", () => {
    expect(eventText(ev({ action: "create", actorKind: "brand", actorName: "花粉", toStatus: "invited" }))).toBe("花粉 發出邀約");
    expect(eventText(ev({ action: "create", actorKind: "brand", actorName: "花粉", toStatus: "awaiting_payment" }))).toBe("花粉 錄取並建立合作案");
    expect(eventText(ev({ action: "submit" }))).toBe("小美 已交稿");
    expect(eventText(ev({ action: "request_changes", actorName: "花粉", note: "亮一點" }))).toBe("花粉 要求修改：亮一點");
    expect(eventText(ev({ action: "mark_paid", actorKind: "system", actorName: "系統" }))).toBe("款項已託管");
    expect(eventText(ev({ action: "auto_approve" }))).toBe("審核期限已到，自動通過");
    expect(eventText(ev({ action: "weird" }))).toBe("小美：weird");
  });
  it("事件時間是台灣時間 MM/DD HH:mm", () => {
    expect(eventTime("2026-11-25T03:05:00Z")).toBe("11/25 11:05");
    expect(eventTime("bad")).toBe("");
  });
  it("Row → 物件", () => {
    expect(toCollabEvent({
      id: "7", action: "approve", actor_kind: null, actor_name: null, from_status: null, to_status: null, note: null, created_at: null,
    })).toEqual({ id: 7, action: "approve", actorKind: "system", actorName: "系統", toStatus: null, note: null, createdAt: "" });
    expect(toSubmission({ id: "s1", round: 2, note: null, links: null, file_paths: null, created_at: "t" }))
      .toEqual({ id: "s1", round: 2, note: null, links: [], filePaths: [], createdAt: "t" });
  });
  it("修改說明掛在對應的那一輪", () => {
    const subs: Submission[] = [
      { id: "s1", round: 1, note: null, links: [], filePaths: [], createdAt: "2026-11-25T01:00:00Z" },
      { id: "s2", round: 2, note: null, links: [], filePaths: [], createdAt: "2026-11-25T05:00:00Z" },
    ];
    const events = [
      ev({ action: "request_changes", note: "第一輪的意見", createdAt: "2026-11-25T02:00:00Z" }),
      ev({ action: "request_changes", note: "第二輪的意見", createdAt: "2026-11-25T06:00:00Z" }),
      ev({ action: "request_changes", note: "沒有交稿前", createdAt: "2026-11-25T00:00:00Z" }),
      ev({ action: "submit", createdAt: "2026-11-25T07:00:00Z" }),
    ];
    expect(revisionNotesByRound(subs, events)).toEqual({ 1: ["第一輪的意見"], 2: ["第二輪的意見"] });
  });
});
```

`src/lib/validation/collab.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import {
  acceptDefaults, cleanLongText, isValidLink, isValidPostUrl, parseAmount, parseLinks, parseOfferForm,
  validateOffer, validateRevisionNote, validateSubmission,
} from "./collab";

const C = "00000000-0000-0000-0000-0000000007d1";
const U = "00000000-0000-0000-0000-000000000731";
const F = `${C}/${U}/11111111-1111-4111-8111-111111111111.jpg`;

describe("金額", () => {
  it("去千分位、範圍 1..10,000,000", () => {
    expect(parseAmount("4,500")).toBe(4500);
    expect(parseAmount(" 10000000 ")).toBe(10_000_000);
    expect(parseAmount("10000001")).toBeNull();
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("12.5")).toBeNull();
    expect(parseAmount("-3")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
});

describe("邀請與錄取表單", () => {
  function fd(o: Record<string, string>) {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.append(k, v);
    return f;
  }
  it("解析：清理案名、交付內容換行統一", () => {
    expect(parseOfferForm(fd({ title: " 春季開箱 ", deliverables: "IG 貼文\r\n限動 2 則 ", amount: "3,000" })))
      .toEqual({ title: "春季開箱", deliverables: "IG 貼文\n限動 2 則", amount: "3,000" });
  });
  it("直接邀請要案名；錄取不檢查案名", () => {
    expect(validateOffer({ title: "", deliverables: "x", amount: "1000" }, true)).toEqual({ title: "請填寫案名" });
    expect(validateOffer({ title: "", deliverables: "x", amount: "1000" }, false)).toBeNull();
    expect(validateOffer({ title: "案".repeat(61), deliverables: "", amount: "0" }, true)).toEqual({
      title: "最多 60 字", deliverables: "請填寫交付內容", amount: "請填 1 到 10,000,000 的整數",
    });
    expect(validateOffer({ title: "x", deliverables: "字".repeat(1001), amount: "1" }, true)).toEqual({ deliverables: "最多 1000 字" });
    expect(validateOffer({ title: "a‮b", deliverables: "x\u0000", amount: "1" }, true)).toEqual({
      title: "含有不允許的特殊字元", deliverables: "含有不允許的特殊字元",
    });
  });
  it("長文字清理不會在 1000 字以內截斷", () => {
    expect([...cleanLongText("字".repeat(1001))]).toHaveLength(1001);
  });
});

describe("修改說明", () => {
  it("必填、最多 1000 字", () => {
    expect(validateRevisionNote("")).toBe("請寫下要修改的地方");
    expect(validateRevisionNote("字".repeat(1001))).toBe("最多 1000 字");
    expect(validateRevisionNote("第二張亮一點")).toBeNull();
  });
});

describe("貼文連結", () => {
  it("https、網域合法、有路徑", () => {
    expect(isValidPostUrl("https://www.instagram.com/p/abc123/")).toBe(true);
    expect(isValidPostUrl("http://www.instagram.com/p/abc123/")).toBe(false);
    expect(isValidPostUrl("https://instagram.com")).toBe(false);
    expect(isValidPostUrl("https://instagram.com/")).toBe(false);
    expect(isValidPostUrl("https://a..b.com/p/1")).toBe(false);
    expect(isValidPostUrl("https://-a.com/p/1")).toBe(false);
    expect(isValidPostUrl("https://evil.com@x.com/p")).toBe(false);
    expect(isValidPostUrl("https://x.com:8443/p")).toBe(false);
    expect(isValidPostUrl("https://x.c/p")).toBe(false);
  });
});

describe("交稿", () => {
  it("連結：一行一個、清理、去空行", () => {
    expect(parseLinks(" https://a.com/1 \r\n\n https://b.com ")).toEqual(["https://a.com/1", "https://b.com"]);
    expect(isValidLink("https://drive.google.com")).toBe(true);
    expect(isValidLink(`https://a.com/${"x".repeat(490)}`)).toBe(false);
  });
  it("檔案或連結至少一個", () => {
    expect(validateSubmission({ note: "只有說明", links: [], filePaths: [] }, C, U)).toEqual({ files: "請上傳檔案或附上連結" });
    expect(validateSubmission({ note: "", links: [], filePaths: [F] }, C, U)).toBeNull();
    expect(validateSubmission({ note: "", links: ["https://a.com/x"], filePaths: [] }, C, U)).toBeNull();
  });
  it("格式錯誤", () => {
    expect(validateSubmission({ note: "字".repeat(1001), links: ["http://a.com"], filePaths: [F, F] }, C, U)).toEqual({
      note: "最多 1000 字", links: "連結必須是 https:// 開頭的完整網址", files: "檔案資料不正確，請重新上傳",
    });
    expect(validateSubmission({ note: "", links: Array(6).fill("https://a.com"), filePaths: [] }, C, U)).toEqual({ links: "最多 5 個連結" });
    expect(validateSubmission({ note: "", links: [], filePaths: [`${C}/other/x.jpg`] }, C, U)).toEqual({ files: "檔案資料不正確，請重新上傳" });
    expect(validateSubmission({ note: "", links: [], filePaths: Array(11).fill(F) }, C, U)).toEqual({ files: "一次最多 10 個檔案" });
  });
});

describe("錄取預設值", () => {
  const brief = { budgetMin: 3000, budgetMax: 8000, collabTypes: ["IG 貼文", "限時動態"], description: "  冬季保養開箱  " };
  it("金額：報價 → 預算上限 → 下限 → 空白", () => {
    expect(acceptDefaults(6000, brief).amount).toBe("6000");
    expect(acceptDefaults(null, brief).amount).toBe("8000");
    expect(acceptDefaults(0, { ...brief, budgetMax: null }).amount).toBe("3000");
    expect(acceptDefaults(null, { ...brief, budgetMin: null, budgetMax: null }).amount).toBe("");
  });
  it("交付內容：合作形式 + 說明摘要", () => {
    expect(acceptDefaults(null, brief).deliverables).toBe("IG 貼文、限時動態\n冬季保養開箱");
    const long = acceptDefaults(null, { ...brief, description: "字".repeat(300) }).deliverables;
    expect(long).toBe(`IG 貼文、限時動態\n${"字".repeat(200)}…`);
  });
});
```

`src/lib/deliverables.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { DELIVERABLE_ACCEPT, fileKindOf, fileLabel, isOwnDeliverablePath, planDeliverableUpload } from "./deliverables";

const C = "00000000-0000-0000-0000-0000000007d1";
const U = "00000000-0000-0000-0000-000000000731";
const ID = "11111111-1111-4111-8111-111111111111";

describe("planDeliverableUpload", () => {
  it("合規的檔案產生 <合作案>/<創作者>/<uuid>.<副檔名>", () => {
    expect(planDeliverableUpload(C, U, { type: "image/png", size: 10 }, ID)).toEqual({ path: `${C}/${U}/${ID}.png` });
    expect(planDeliverableUpload(C, U, { type: "video/quicktime", size: 10 }, ID)).toEqual({ path: `${C}/${U}/${ID}.mov` });
    expect(planDeliverableUpload(C, U, { type: "application/pdf", size: 10 }, ID.toUpperCase())).toEqual({ path: `${C}/${U}/${ID}.pdf` });
  });
  it("不接受的格式與超過 50MB", () => {
    expect(planDeliverableUpload(C, U, { type: "image/gif", size: 10 }, ID)).toEqual({ error: "只接受 JPG、PNG、WebP、MP4、MOV、PDF" });
    expect(planDeliverableUpload(C, U, { type: "video/mp4", size: 50 * 1024 * 1024 + 1 }, ID)).toEqual({ error: "每個檔案不能超過 50MB" });
  });
  it("accept 清單", () => {
    expect(DELIVERABLE_ACCEPT).toBe("image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf");
  });
});

describe("isOwnDeliverablePath", () => {
  it("只接受自己的資料夾與合規檔名", () => {
    expect(isOwnDeliverablePath(C, U, `${C}/${U}/${ID}.jpg`)).toBe(true);
    expect(isOwnDeliverablePath(C, U, `${C}/other/${ID}.jpg`)).toBe(false);
    expect(isOwnDeliverablePath(C, U, `${C}/${U}/x/${ID}.jpg`)).toBe(false);
    expect(isOwnDeliverablePath(C, U, `${C}/${U}/${ID}.exe`)).toBe(false);
    expect(isOwnDeliverablePath(C, U, `${C}/${U}/../${ID}.jpg`)).toBe(false);
  });
});

describe("檔案種類與標籤", () => {
  it("依副檔名", () => {
    expect(fileKindOf("a/b/c.webp")).toBe("image");
    expect(fileKindOf("a/b/c.MOV")).toBe("video");
    expect(fileKindOf("a/b/c.pdf")).toBe("pdf");
    expect(fileLabel("a/b/c.pdf", 2)).toBe("PDF 3");
    expect(fileLabel("a/b/c.jpg", 0)).toBe("圖片 1");
  });
});
```

`src/lib/collabs/errors.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { COLLAB_STALE_MESSAGE, collabErrorMessage, collabFieldError } from "./errors";

describe("collabErrorMessage", () => {
  it("已知錯誤", () => {
    expect(collabErrorMessage({ code: "23505", message: "already invited" })).toBe("你已經邀請過這位創作者，請等對方回覆");
    expect(collabErrorMessage({ code: "P0002", message: "creator not found" })).toBe("找不到這位創作者，或對方還沒通過審核");
  });
  it("狀態不允許的轉換視為狀態已更新", () => {
    expect(collabErrorMessage({ code: "22023", message: "invalid transition: approve from awaiting_publish by brand" })).toBe(COLLAB_STALE_MESSAGE);
    expect(collabErrorMessage({ code: "55000", message: "collaboration not awaiting submission" })).toBe(COLLAB_STALE_MESSAGE);
  });
  it("其他錯誤不洩漏內容", () => {
    expect(collabErrorMessage({ code: "XX000", message: "boom" })).toBe("發生錯誤，請稍後再試");
    expect(collabErrorMessage({})).toBe("發生錯誤，請稍後再試");
  });
});

describe("collabFieldError", () => {
  it("22023 invalid <欄位>", () => {
    expect(collabFieldError({ code: "22023", message: "invalid amount_twd" })).toEqual({ amount: "格式不正確" });
    expect(collabFieldError({ code: "22023", message: "invalid file_paths" })).toEqual({ files: "格式不正確" });
    expect(collabFieldError({ code: "22023", message: "invalid transition: x" })).toBeNull();
    expect(collabFieldError({ code: "42501", message: "invalid title" })).toBeNull();
  });
});
```

`src/lib/briefs/errors.test.ts`：import 改成 `import { briefErrorMessage, briefFieldError, isStaleStateMessage } from "./errors";`，檔案最後加：

```ts
describe("isStaleStateMessage", () => {
  it("招募與合作案的「狀態已變」都不當成錯誤", () => {
    expect(isStaleStateMessage("這筆報名已經處理過了")).toBe(true);
    expect(isStaleStateMessage("合作案的狀態已經更新")).toBe(true);
    expect(isStaleStateMessage("發生錯誤，請稍後再試")).toBe(false);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/collabs src/lib/validation/collab.test.ts src/lib/deliverables.test.ts src/lib/briefs/errors.test.ts`
Expected: FAIL（模組不存在；`isStaleStateMessage("合作案的狀態已經更新")` 是 false）。

- [ ] **Step 3: 實作**

`src/lib/collabs/view.ts`：

```ts
// 合作案的狀態、輪到誰、進度條、各種顯示文字，以及資料庫 Row → 顯示用物件。
// 「輪到誰」與 supabase/migrations/20261125000300_collab_reads.sql 的 collab_turn 是同一條規則，改一邊要改另一邊。
import { formatDateTimeTw } from "@/lib/briefs/dates";
import { formatTwd } from "@/lib/format";

export type CollabStatus =
  | "invited" | "awaiting_payment" | "awaiting_submission" | "in_review"
  | "awaiting_publish" | "awaiting_payout" | "completed" | "declined" | "cancelled";
export type CollabSide = "brand" | "creator";
export type Turn = CollabSide | "platform" | null;

const STATUSES: readonly string[] = [
  "invited", "awaiting_payment", "awaiting_submission", "in_review",
  "awaiting_publish", "awaiting_payout", "completed", "declined", "cancelled",
];

/** 不認得的值當成「已取消」：畫面不會出現任何動作按鈕。 */
export function toCollabStatus(v: unknown): CollabStatus {
  return typeof v === "string" && STATUSES.includes(v) ? (v as CollabStatus) : "cancelled";
}

export function toCollabSide(v: unknown): CollabSide | "admin" {
  return v === "brand" || v === "creator" ? v : "admin";
}

export const COLLAB_STATUS_LABEL: Record<CollabStatus, string> = {
  invited: "邀約中",
  awaiting_payment: "等待付款",
  awaiting_submission: "待交稿",
  in_review: "審核中",
  awaiting_publish: "待發佈",
  awaiting_payout: "撥款處理中",
  completed: "已完成",
  declined: "已婉拒",
  cancelled: "已取消",
};

/** 輪到誰（與 SQL collab_turn 相同）。 */
export function turnOf(s: CollabStatus): Turn {
  switch (s) {
    case "invited":
    case "awaiting_submission":
    case "awaiting_publish":
      return "creator";
    case "awaiting_payment":
    case "in_review":
      return "brand";
    case "awaiting_payout":
      return "platform";
    default:
      return null;
  }
}

export const COLLAB_STEPS = ["邀約", "確認", "付款託管", "交稿", "審核", "發佈", "撥款"] as const;

// 目前步驟（0 起算）；completed = 7 代表全部完成；declined／cancelled 沒有進度條
const STEP_INDEX: Partial<Record<CollabStatus, number>> = {
  invited: 0,
  awaiting_payment: 1,
  awaiting_submission: 3,
  in_review: 4,
  awaiting_publish: 5,
  awaiting_payout: 6,
  completed: 7,
};

export type StepState = "done" | "current" | "todo";

export function stepStates(s: CollabStatus): StepState[] | null {
  const i = STEP_INDEX[s];
  if (i === undefined) return null;
  return COLLAB_STEPS.map((_, k) => (k < i ? "done" : k === i ? "current" : "todo"));
}

/** 手機版的「第 N / 7 步」；已完成是 7；沒有進度條時是 null。 */
export function stepNumber(s: CollabStatus): number | null {
  const i = STEP_INDEX[s];
  if (i === undefined) return null;
  return Math.min(i + 1, COLLAB_STEPS.length);
}

/** 金額與託管狀態：「NT$4,500 待付款」「NT$4,500 已託管」「NT$4,500 已撥款」「NT$4,500 未成立」。 */
export function escrowLabel(s: CollabStatus, amount: number): string {
  const money = formatTwd(amount);
  switch (s) {
    case "invited":
    case "awaiting_payment":
      return `${money} 待付款`;
    case "completed":
      return `${money} 已撥款`;
    case "declined":
    case "cancelled":
      return `${money} 未成立`;
    default:
      return `${money} 已託管`;
  }
}

/** 案號 = 合作案 id 的前 8 碼（README 的管理員 SQL 用這個找合作案）。 */
export function caseCode(id: string): string {
  return id.slice(0, 8);
}

// ── 列表 ──

export type CollabTab = "active" | "completed" | "cancelled";
export const COLLAB_TABS: { value: CollabTab; label: string }[] = [
  { value: "active", label: "進行中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

/** ?tab=completed|cancelled；其他任何值都是「進行中」。 */
export function parseCollabTab(v: string | string[] | undefined): CollabTab {
  const x = Array.isArray(v) ? v[0] : v;
  return x === "completed" || x === "cancelled" ? x : "active";
}

export type ListBadge = { label: string; tone: "turn" | "wait" | "platform" };

/** 列表每列的標記：輪到你／等對方；撥款中兩邊都是「撥款處理中」；已結束的沒有標記。 */
export function listBadge(s: CollabStatus, side: CollabSide): ListBadge | null {
  const t = turnOf(s);
  if (t === null) return null;
  if (t === "platform") return { label: "撥款處理中", tone: "platform" };
  return t === side ? { label: "輪到你", tone: "turn" } : { label: "等對方", tone: "wait" };
}

export type CollabListItem = {
  id: string;
  title: string;
  amount: number;
  status: CollabStatus;
  updatedAt: string;
  side: CollabSide;
  counterpartName: string;
  counterpartImagePath: string | null;
  counterpartHandle: string | null;
  myTurn: boolean;
};

export type CollabListRow = {
  id: string;
  title: string | null;
  amount_twd: number | null;
  status: string | null;
  updated_at: string | null;
  my_side: string | null;
  counterpart_name: string | null;
  counterpart_image_path: string | null;
  counterpart_handle: string | null;
  my_turn: boolean | null;
};

export function toCollabListItem(r: CollabListRow): CollabListItem {
  return {
    id: r.id,
    title: r.title ?? "",
    amount: r.amount_twd ?? 0,
    status: toCollabStatus(r.status),
    updatedAt: r.updated_at ?? "",
    side: r.my_side === "creator" ? "creator" : "brand",
    counterpartName: r.counterpart_name ?? "",
    counterpartImagePath: r.counterpart_image_path ?? null,
    counterpartHandle: r.counterpart_handle ?? null,
    myTurn: r.my_turn === true,
  };
}

// ── 詳情 ──

export type Collab = {
  id: string;
  title: string;
  deliverables: string;
  amount: number;
  status: CollabStatus;
  reviewDueAt: string | null;
  publishedUrl: string | null;
  createdAt: string;
  updatedAt: string;
  briefId: string | null;
  briefTitle: string | null;
  side: CollabSide | "admin";
  brandId: string;
  brandName: string;
  brandLogoPath: string | null;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatarPath: string | null;
};

export type CollabRow = {
  id: string;
  title: string | null;
  deliverables: string | null;
  amount_twd: number | null;
  status: string | null;
  review_due_at: string | null;
  published_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  brief_id: string | null;
  brief_title: string | null;
  my_side: string | null;
  brand_id: string | null;
  brand_name: string | null;
  brand_logo_path: string | null;
  creator_id: string | null;
  creator_name: string | null;
  creator_handle: string | null;
  creator_avatar_path: string | null;
};

export function toCollab(r: CollabRow): Collab {
  return {
    id: r.id,
    title: r.title ?? "",
    deliverables: r.deliverables ?? "",
    amount: r.amount_twd ?? 0,
    status: toCollabStatus(r.status),
    reviewDueAt: r.review_due_at ?? null,
    publishedUrl: r.published_url ?? null,
    createdAt: r.created_at ?? "",
    updatedAt: r.updated_at ?? "",
    briefId: r.brief_id ?? null,
    briefTitle: r.brief_title ?? null,
    side: toCollabSide(r.my_side),
    brandId: r.brand_id ?? "",
    brandName: r.brand_name ?? "",
    brandLogoPath: r.brand_logo_path ?? null,
    creatorId: r.creator_id ?? "",
    creatorName: r.creator_name ?? "",
    creatorHandle: r.creator_handle ?? "",
    creatorAvatarPath: r.creator_avatar_path ?? null,
  };
}

/** 來源：招募名稱，或「直接邀請」。 */
export function sourceLabel(c: { briefId: string | null; briefTitle: string | null }): string {
  return c.briefId ? `招募：${c.briefTitle ?? ""}` : "直接邀請";
}

export type ActionCardCopy = { mine: boolean; title: string; body: string };

/** 「現在要做什麼」卡片的標題與說明。輪到對方時一定寫「你不用做任何事」。 */
export function actionCardCopy(s: CollabStatus, side: CollabSide): ActionCardCopy {
  const none = "你不用做任何事。";
  const mine = turnOf(s) === side;
  switch (s) {
    case "invited":
      return mine
        ? { mine, title: "輪到你：回覆邀約", body: "接受後由品牌確認並付款託管，款項託管後再開始製作。" }
        : { mine, title: "等對方回覆邀約", body: `創作者接受後就輪到你確認並付款。${none}` };
    case "awaiting_payment":
      return mine
        ? { mine, title: "輪到你：確認並付款", body: "等待付款確認。款項由平台託管，創作者交稿並發佈後才撥款。" }
        : { mine, title: "等對方付款託管", body: `款項託管後就可以開始製作。${none}` };
    case "awaiting_submission":
      return mine
        ? { mine, title: "輪到你：交稿", body: "上傳作品檔案，或附上雲端連結與說明。" }
        : { mine, title: "等對方交稿", body: `創作者交稿後，你有 3 天可以審核。${none}` };
    case "in_review":
      return mine
        ? { mine, title: "輪到你：審核交稿", body: "通過後創作者就會發佈；需要調整時請寫下修改說明。期限內沒有回覆會自動通過。" }
        : { mine, title: "等對方審核", body: `品牌通過後你再發佈貼文。${none}` };
    case "awaiting_publish":
      return mine
        ? { mine, title: "輪到你：發佈並填入貼文連結", body: "依審核通過的內容發佈，再把貼文連結貼在這裡。" }
        : { mine, title: "等對方發佈貼文", body: `創作者填入貼文連結後，平台會撥款。${none}` };
    case "awaiting_payout":
      return { mine: false, title: "撥款處理中", body: `平台確認後會把款項撥給創作者。${none}` };
    case "completed":
      return { mine: false, title: "合作已完成", body: "款項已撥給創作者，謝謝你們的合作。" };
    case "declined":
      return { mine: false, title: "已婉拒", body: "創作者婉拒了這次邀約。" };
    case "cancelled":
      return { mine: false, title: "已取消", body: "品牌已取消這個合作案。" };
  }
}

const HOUR_MS = 3_600_000;

/** 現在時間（毫秒）。會讀時鐘：伺服器元件裡只能在 requireRole 之後呼叫，算好再當 prop 往下傳。 */
export function nowMs(): number {
  return Date.now();
}

/** 審核倒數：「剩 2 天 05 小時後自動通過」「不到 1 小時後自動通過」；到期後、Cron 還沒跑之前「即將自動通過」。 */
export function reviewCountdown(dueIso: string | null, nowMs: number): string | null {
  if (!dueIso) return null;
  const due = Date.parse(dueIso);
  if (Number.isNaN(due)) return null;
  const left = due - nowMs;
  if (left <= 0) return "即將自動通過";
  if (left < HOUR_MS) return "不到 1 小時後自動通過";
  const hours = Math.floor(left / HOUR_MS);
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return `剩 ${d} 天 ${String(h).padStart(2, "0")} 小時後自動通過`;
}

// ── 交稿與系統事件 ──

export type Submission = {
  id: string;
  round: number;
  note: string | null;
  links: string[];
  filePaths: string[];
  createdAt: string;
};

export type SubmissionRow = {
  id: string;
  round: number | null;
  note: string | null;
  links: string[] | null;
  file_paths: string[] | null;
  created_at: string | null;
};

export function toSubmission(r: SubmissionRow): Submission {
  return {
    id: r.id,
    round: r.round ?? 0,
    note: r.note ?? null,
    links: r.links ?? [],
    filePaths: r.file_paths ?? [],
    createdAt: r.created_at ?? "",
  };
}

export type CollabEvent = {
  id: number;
  action: string;
  actorKind: string;
  actorName: string;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
};

export type EventRow = {
  id: number | string;
  action: string | null;
  actor_kind: string | null;
  actor_name: string | null;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string | null;
};

export function toCollabEvent(r: EventRow): CollabEvent {
  return {
    id: Number(r.id),
    action: r.action ?? "",
    actorKind: r.actor_kind ?? "system",
    actorName: r.actor_name ?? "系統",
    toStatus: r.to_status ?? null,
    note: r.note ?? null,
    createdAt: r.created_at ?? "",
  };
}

/** 事件的一句話（不含日期）。 */
export function eventText(e: CollabEvent): string {
  const who = e.actorName;
  switch (e.action) {
    case "create":
      if (e.actorKind !== "brand") return "建立合作案";
      return e.toStatus === "invited" ? `${who} 發出邀約` : `${who} 錄取並建立合作案`;
    case "accept":
      return `${who} 接受邀約`;
    case "decline":
      return `${who} 婉拒邀約`;
    case "cancel":
      return `${who} 取消合作`;
    case "mark_paid":
      return "款項已託管";
    case "submit":
      return `${who} 已交稿`;
    case "approve":
      return `${who} 審核通過`;
    case "auto_approve":
      return "審核期限已到，自動通過";
    case "request_changes":
      return `${who} 要求修改：${e.note ?? ""}`;
    case "publish":
      return `${who} 已發佈貼文`;
    case "payout":
      return "平台已撥款，合作完成";
    case "payment_requires_refund":
      return "收到付款，但合作案已不在待付款，需退款";
    default:
      return `${who}：${e.action}`;
  }
}

/** 台灣時間 MM/DD HH:mm（事件列表用）。 */
export function eventTime(iso: string): string {
  if (Number.isNaN(Date.parse(iso))) return "";
  return formatDateTimeTw(iso).slice(5);
}

/** 每一輪交稿下方要顯示的修改說明：掛到「建立時間 ≤ 事件時間」的最後一輪。 */
export function revisionNotesByRound(subs: Submission[], events: CollabEvent[]): Record<number, string[]> {
  const sorted = [...subs].sort((a, b) => a.round - b.round);
  const out: Record<number, string[]> = {};
  for (const e of events) {
    if (e.action !== "request_changes" || !e.note) continue;
    const t = Date.parse(e.createdAt);
    let round: number | null = null;
    for (const s of sorted) if (Date.parse(s.createdAt) <= t) round = s.round;
    if (round === null) continue;
    (out[round] ??= []).push(e.note);
  }
  return out;
}
```

`src/lib/deliverables.ts`：

```ts
// 交稿檔案（私密 bucket deliverables）。路徑規則與 20261125000200_deliverables.sql 的 deliverable_path_ok 相同：
// <collab_id>/<creator_id>/<uuid>.<jpg|png|webp|mp4|mov|pdf>
export const DELIVERABLES_BUCKET = "deliverables";
export const DELIVERABLE_MAX_BYTES = 50 * 1024 * 1024;
export const MAX_DELIVERABLE_FILES = 10;
export const SIGNED_URL_SECONDS = 3600;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
};

/** <input type="file" accept> 用。 */
export const DELIVERABLE_ACCEPT = Object.keys(EXT_BY_TYPE).join(",");

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const NAME_RE = new RegExp(`^${UUID}\\.(jpg|png|webp|mp4|mov|pdf)$`);

/** 上傳前檢查檔案並產生路徑（id 用 crypto.randomUUID()）。 */
export function planDeliverableUpload(
  collabId: string, uid: string, file: { type: string; size: number }, id: string,
): { path: string } | { error: string } {
  if (!Object.hasOwn(EXT_BY_TYPE, file.type)) return { error: "只接受 JPG、PNG、WebP、MP4、MOV、PDF" };
  if (file.size > DELIVERABLE_MAX_BYTES) return { error: "每個檔案不能超過 50MB" };
  return { path: `${collabId}/${uid}/${id.toLowerCase()}.${EXT_BY_TYPE[file.type]}` };
}

/** 路徑是否在這個合作案、這位創作者的資料夾，而且檔名合規。 */
export function isOwnDeliverablePath(collabId: string, uid: string, path: string): boolean {
  const prefix = `${collabId}/${uid}/`;
  return path.startsWith(prefix) && NAME_RE.test(path.slice(prefix.length));
}

export type FileKind = "image" | "video" | "pdf";

export function fileKindOf(path: string): FileKind {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "mp4" || ext === "mov") return "video";
  return "image";
}

const KIND_LABEL: Record<FileKind, string> = { image: "圖片", video: "影片", pdf: "PDF" };

/** 檔名是亂數，畫面上顯示「圖片 1」「影片 2」「PDF 3」（index 從 0 起算）。 */
export function fileLabel(path: string, index: number): string {
  return `${KIND_LABEL[fileKindOf(path)]} ${index + 1}`;
}
```

`src/lib/validation/collab.ts`：

```ts
// 合作案表單的解析與驗證。規則與資料庫一致，資料庫是最後防線：
// check_collab_offer（20261125000100_collab_create.sql）、submit_deliverables（20261125000200_deliverables.sql）、
// transition_collaboration 的貼文連結 regex（20261122000300_collaborations.sql）。
import { isOwnDeliverablePath, MAX_DELIVERABLE_FILES } from "@/lib/deliverables";
import { hasBadChar, textLength } from "./brief";
import { cleanText, cleanTextWithin } from "./onboarding";

export const TITLE_MAX = 60;
export const DELIVERABLES_MAX = 1000;
export const NOTE_MAX = 1000;
export const LINKS_MAX = 5;
export const LINK_MAX_LEN = 500;
export const AMOUNT_MAX = 10_000_000;
// 清理前的截斷長度：至少要是上限的兩倍以上（cleanTextWithin 的規則）
const LONG_RAW_LIMIT = 2400;
const BAD_CHAR_MESSAGE = "含有不允許的特殊字元";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

/** 多行文字：CRLF → LF 後清理。 */
export function cleanLongText(v: string): string {
  return cleanTextWithin(v.replace(/\r\n?/g, "\n"), LONG_RAW_LIMIT);
}

/** 金額：去掉千分位逗號與空白，必須是 1..10,000,000 的整數；否則 null。 */
export function parseAmount(v: string): number | null {
  const d = cleanText(v).replace(/[,，\s]/g, "");
  if (!/^\d{1,8}$/.test(d)) return null;
  const n = Number(d);
  return n >= 1 && n <= AMOUNT_MAX ? n : null;
}

export type OfferInput = { title: string; deliverables: string; amount: string };

export function parseOfferForm(fd: FormData): OfferInput {
  return {
    title: cleanText(str(fd, "title")),
    deliverables: cleanLongText(str(fd, "deliverables")),
    amount: str(fd, "amount"),
  };
}

/** withTitle：直接邀請要填案名；錄取時案名 = 招募名稱，不檢查。 */
export function validateOffer(i: OfferInput, withTitle: boolean): Record<string, string> | null {
  const e: Record<string, string> = {};
  if (withTitle) {
    if (hasBadChar(i.title)) e.title = BAD_CHAR_MESSAGE;
    else if (i.title === "") e.title = "請填寫案名";
    else if (textLength(i.title) > TITLE_MAX) e.title = `最多 ${TITLE_MAX} 字`;
  }
  if (hasBadChar(i.deliverables)) e.deliverables = BAD_CHAR_MESSAGE;
  else if (i.deliverables === "") e.deliverables = "請填寫交付內容";
  else if (textLength(i.deliverables) > DELIVERABLES_MAX) e.deliverables = `最多 ${DELIVERABLES_MAX} 字`;
  if (parseAmount(i.amount) === null) e.amount = "請填 1 到 10,000,000 的整數";
  return Object.keys(e).length ? e : null;
}

/** 要求修改的說明：必填、最多 1000 字。回傳錯誤文字或 null。 */
export function validateRevisionNote(note: string): string | null {
  if (hasBadChar(note)) return BAD_CHAR_MESSAGE;
  if (note === "") return "請寫下要修改的地方";
  if (textLength(note) > NOTE_MAX) return `最多 ${NOTE_MAX} 字`;
  return null;
}

// 與資料庫相同的 regex：資料庫只看格式，所以 a..b.com 這種會通過；網域另外用 new URL() 檢查
const DB_POST_URL_RE = /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}\/\S+$/;
const DB_LINK_RE = /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/\S*)?$/;
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

function hostOk(u: URL): boolean {
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const labels = u.hostname.split(".");
  return labels.length >= 2 && labels.every((l) => LABEL_RE.test(l)) && /^[a-z]{2,}$/i.test(labels[labels.length - 1]);
}

/** 貼文連結：https、網域合法、有路徑。 */
export function isValidPostUrl(v: string): boolean {
  if (!DB_POST_URL_RE.test(v)) return false;
  try {
    const u = new URL(v);
    return hostOk(u) && u.pathname.length > 1;
  } catch {
    return false;
  }
}

/** 交稿附的連結：https、網域合法，路徑可省略；最多 500 字。 */
export function isValidLink(v: string): boolean {
  if ([...v].length > LINK_MAX_LEN || !DB_LINK_RE.test(v)) return false;
  try {
    return hostOk(new URL(v));
  } catch {
    return false;
  }
}

/** 連結輸入框（一行一個）→ 清理後的非空白連結。 */
export function parseLinks(raw: string): string[] {
  return raw.replace(/\r\n?/g, "\n").split("\n").map(cleanText).filter((l) => l !== "");
}

export type SubmissionInput = { note: string; links: string[]; filePaths: string[] };

/** 交稿：說明 ≤ 1000 字、連結 ≤ 5 個且格式正確、檔案 ≤ 10 個且在自己的資料夾、不重複；檔案或連結至少一個。 */
export function validateSubmission(i: SubmissionInput, collabId: string, uid: string): Record<string, string> | null {
  const e: Record<string, string> = {};
  if (hasBadChar(i.note)) e.note = BAD_CHAR_MESSAGE;
  else if (textLength(i.note) > NOTE_MAX) e.note = `最多 ${NOTE_MAX} 字`;
  if (i.links.length > LINKS_MAX) e.links = `最多 ${LINKS_MAX} 個連結`;
  else if (i.links.some((l) => hasBadChar(l) || !isValidLink(l))) e.links = "連結必須是 https:// 開頭的完整網址";
  if (i.filePaths.length > MAX_DELIVERABLE_FILES) e.files = `一次最多 ${MAX_DELIVERABLE_FILES} 個檔案`;
  else if (new Set(i.filePaths).size !== i.filePaths.length || i.filePaths.some((p) => !isOwnDeliverablePath(collabId, uid, p))) {
    e.files = "檔案資料不正確，請重新上傳";
  }
  if (!e.links && !e.files && i.links.length + i.filePaths.length === 0) e.files = "請上傳檔案或附上連結";
  return Object.keys(e).length ? e : null;
}

const SUMMARY_CHARS = 200;

/**
 * 錄取表單的預設值。金額：報名報價 → 招募預算上限 → 下限 → 空白。
 * 交付內容：合作形式（、連接）+ 換行 + 說明前 200 字（超過加「…」），不超過 1000 字。
 */
export function acceptDefaults(
  proposedPrice: number | null,
  brief: { budgetMin: number | null; budgetMax: number | null; collabTypes: string[]; description: string },
): { amount: string; deliverables: string } {
  const price = proposedPrice !== null && proposedPrice > 0 ? proposedPrice : (brief.budgetMax ?? brief.budgetMin);
  const chars = [...brief.description.trim()];
  const summary = chars.length > SUMMARY_CHARS ? `${chars.slice(0, SUMMARY_CHARS).join("")}…` : chars.join("");
  const text = [brief.collabTypes.join("、"), summary].filter((s) => s !== "").join("\n");
  return { amount: price ? String(price) : "", deliverables: [...text].slice(0, DELIVERABLES_MAX).join("") };
}
```

`src/lib/collabs/errors.ts`：

```ts
// 合作案相關 definer 函式的錯誤（20261125000100～000300、transition_collaboration）→ 畫面文字。
type DbError = { code?: string; message?: string };

/** 狀態已經變了（連點、另一個分頁、對方剛操作）：畫面重新整理即可，不當成錯誤。 */
export const COLLAB_STALE_MESSAGE = "合作案的狀態已經更新";

const MESSAGES: Record<string, string> = {
  "not authenticated": "登入已逾時，請重新登入",
  "not a brand": "這個帳號不是品牌，無法執行此操作",
  "not collaboration creator": "只有這個合作案的創作者可以交稿",
  "creator not found": "找不到這位創作者，或對方還沒通過審核",
  "already invited": "你已經邀請過這位創作者，請等對方回覆",
  "application not found": "找不到這筆報名",
  "application not pending": "這筆報名已經處理過了",
  "collaboration exists": "這筆報名已經建立過合作案",
  "collaboration not found": "找不到這個合作案",
  "collaboration not awaiting submission": COLLAB_STALE_MESSAGE,
  "empty submission": "請上傳檔案或附上連結",
};

const FIELD_BY_DB: Record<string, string> = {
  title: "title",
  deliverables: "deliverables",
  amount_twd: "amount",
  note: "note",
  links: "links",
  file_paths: "files",
};

export function collabErrorMessage(error: DbError): string {
  const m = error.message ?? "";
  // transition_collaboration：invalid transition: <動作> from <狀態> by <身分>
  if (m.startsWith("invalid transition")) return COLLAB_STALE_MESSAGE;
  return Object.hasOwn(MESSAGES, m) ? MESSAGES[m] : "發生錯誤，請稍後再試";
}

/** 22023 invalid <欄位> → 表單欄位錯誤；其他錯誤回傳 null。 */
export function collabFieldError(error: DbError): Record<string, string> | null {
  if (error.code !== "22023") return null;
  const key = (error.message ?? "").replace(/^invalid /, "");
  if (!Object.hasOwn(FIELD_BY_DB, key)) return null;
  return { [FIELD_BY_DB[key]]: "格式不正確" };
}
```

`src/lib/briefs/errors.ts`：檔案最上面加 `import { COLLAB_STALE_MESSAGE } from "@/lib/collabs/errors";`（空一行後才是原本的註解），`isStaleStateMessage` 換成：

```ts
/** 連點或另一個分頁已處理過：狀態已經變了，畫面重新整理即可，不必當成錯誤。 */
export function isStaleStateMessage(message: string): boolean {
  return message === MESSAGES["brief not open"] || message === MESSAGES["application not pending"]
    || message === COLLAB_STALE_MESSAGE;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/collabs src/lib/validation/collab.test.ts src/lib/deliverables.test.ts src/lib/briefs/errors.test.ts`
Expected: PASS（撰寫時已在本機實際跑過這四個新測試檔：39 個測試通過、`tsc` 沒有錯誤）。

- [ ] **Step 5: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/lib/collabs src/lib/validation/collab.ts src/lib/validation/collab.test.ts src/lib/deliverables.ts src/lib/deliverables.test.ts src/lib/briefs/errors.ts src/lib/briefs/errors.test.ts
git commit -m "計畫 6 Task 4：合作案純函式（狀態、進度條、文字、倒數、表單與網址驗證、交稿檔案、錯誤對應）"
```

---

### Task 5: 伺服器端讀取與 Server Actions（錄取改成建立合作案）

**Files:**
- Create: `src/lib/collabs/load.ts`、`src/lib/collabs/load.test.ts`、`src/app/brand/collabs/actions.ts`、`src/app/brand/collabs/actions.test.ts`、`src/app/creator/collabs/actions.ts`、`src/app/creator/collabs/actions.test.ts`
- Modify: `src/app/brand/briefs/actions.ts`、`src/app/brand/briefs/actions.test.ts`、`src/lib/briefs/view.ts`、`src/components/briefs/ApplicantList.tsx`（只改 import 與呼叫，讓 typecheck 通過；畫面在 Task 10）

**Interfaces:**
- Consumes: Task 1–3 的 RPC 與 `collaboration_submissions`、Task 4 的全部純函式、`requireRole`、`createClient`（server）、`isUuid`。
- Produces：
  - `loadMyCollabs(tab: CollabTab): Promise<CollabListItem[]>`
  - `loadCollabDetail(id: string): Promise<CollabDetailData | null>`；`SubmissionFile = { path; kind: FileKind; label; url: string | null }`、`SubmissionView = Submission & { files: SubmissionFile[]; revisionNotes: string[] }`、`CollabDetailData = { collab: Collab; submissions: SubmissionView[]; events: CollabEvent[] }`
  - 品牌：`inviteCreatorAction(prev: OfferFormState, fd: FormData)`（成功 redirect `/brand/collabs/<id>`）、`brandCollabAction(collabId, action: "cancel"|"approve"|"request_changes", note?) → ActionResult`
  - 創作者：`creatorCollabAction(collabId, action: "accept"|"decline") → ActionResult`、`submitDeliverablesAction(collabId, { note, links, filePaths }) → SubmitResult`、`publishCollabAction(collabId, url) → ActionResult`
  - 招募：`acceptApplicationAction(prev: AcceptFormState, fd)`（欄位 `applicationId`、`briefId`、`amount`、`deliverables`；成功 redirect `/brand/collabs/<id>`；已處理過回 `{ formError, stale: true }`）、`rejectApplicationAction(applicationId, briefId) → ActionResult`。`decideApplicationAction` 刪除。
  - `Applicant.collaborationId: string | null`（`ApplicantRow.collaboration_id?: string | null`）。

- [ ] **Step 1: 寫失敗的測試**

`src/lib/collabs/load.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from, createSignedUrls } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), createSignedUrls: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc, from, storage: { from: () => ({ createSignedUrls }) } }),
}));

import { loadCollabDetail, loadMyCollabs } from "./load";

const ID = "00000000-0000-0000-0000-0000000007d1";
const FILE = `${ID}/u1/11111111-1111-4111-8111-111111111111.pdf`;

function subsQuery(data: unknown[]) {
  const q = { select: () => q, eq: () => q, order: async () => ({ data, error: null }) };
  return q;
}

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  createSignedUrls.mockReset();
});

describe("loadMyCollabs", () => {
  it("呼叫 list_my_collaborations 並轉成顯示物件", async () => {
    rpc.mockResolvedValue({ data: [{ id: "c1", title: "案", amount_twd: 100, status: "invited", my_side: "brand", my_turn: false }], error: null });
    const items = await loadMyCollabs("active");
    expect(rpc).toHaveBeenCalledWith("list_my_collaborations", { p_tab: "active" });
    expect(items[0]).toMatchObject({ id: "c1", status: "invited", side: "brand", myTurn: false });
  });
  it("錯誤往上丟", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(loadMyCollabs("active")).rejects.toThrow("boom");
  });
});

describe("loadCollabDetail", () => {
  it("看不到時回傳 null，不再查其他資料", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await loadCollabDetail(ID)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
  it("交稿檔案附 signed URL、修改說明掛到對應的那一輪", async () => {
    rpc.mockImplementation(async (fn: string) => fn === "get_collaboration"
      ? { data: [{ id: ID, title: "案", status: "in_review", my_side: "brand", amount_twd: 4500 }], error: null }
      : { data: [{ id: 1, action: "request_changes", actor_kind: "brand", actor_name: "花粉", note: "亮一點", created_at: "2026-11-25T02:00:00Z" }], error: null });
    from.mockReturnValue(subsQuery([
      { id: "s1", round: 1, note: null, links: [], file_paths: [FILE], created_at: "2026-11-25T01:00:00Z" },
    ]));
    createSignedUrls.mockResolvedValue({ data: [{ path: FILE, signedUrl: "https://signed/x", error: null }], error: null });
    const d = await loadCollabDetail(ID);
    expect(createSignedUrls).toHaveBeenCalledWith([FILE], 3600);
    expect(d?.collab).toMatchObject({ id: ID, side: "brand", amount: 4500 });
    expect(d?.submissions[0]).toMatchObject({
      round: 1, revisionNotes: ["亮一點"], files: [{ path: FILE, kind: "pdf", label: "PDF 1", url: "https://signed/x" }],
    });
  });
  it("沒有檔案時不簽 URL", async () => {
    rpc.mockImplementation(async (fn: string) => fn === "get_collaboration"
      ? { data: [{ id: ID, status: "awaiting_submission", my_side: "creator" }], error: null }
      : { data: [], error: null });
    from.mockReturnValue(subsQuery([]));
    const d = await loadCollabDetail(ID);
    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(d?.submissions).toEqual([]);
  });
});
```

`src/app/brand/collabs/actions.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, rpc, revalidatePath, redirect } = vi.hoisted(() => ({
  requireRole: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/current-user", () => ({ requireRole }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { brandCollabAction, inviteCreatorAction } from "./actions";

const CREATOR = "00000000-0000-0000-0000-000000000712";
const COLLAB = "00000000-0000-0000-0000-0000000007e1";

function form(o: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
  return f;
}

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: "brand-1" });
  rpc.mockReset();
  revalidatePath.mockReset();
  redirect.mockClear();
});

describe("inviteCreatorAction", () => {
  it("先檢查是品牌；id 格式不對不碰資料庫", async () => {
    expect(await inviteCreatorAction({}, form({ creatorId: "x" }))).toEqual({ formError: "資料格式不正確，請重新整理頁面" });
    expect(requireRole).toHaveBeenCalledWith("brand");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("欄位錯誤在伺服器再擋一次", async () => {
    expect(await inviteCreatorAction({}, form({ creatorId: CREATOR, title: "", deliverables: "x", amount: "0" })))
      .toEqual({ fieldErrors: { title: "請填寫案名", amount: "請填 1 到 10,000,000 的整數" } });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("成功後導到合作案", async () => {
    rpc.mockResolvedValue({ data: COLLAB, error: null });
    await expect(inviteCreatorAction({}, form({ creatorId: CREATOR, title: " 夏季邀約 ", deliverables: "Reels 1 支", amount: "3,000" })))
      .rejects.toThrow(`REDIRECT /brand/collabs/${COLLAB}`);
    expect(rpc).toHaveBeenCalledWith("invite_creator", {
      p_creator_id: CREATOR, p_title: "夏季邀約", p_deliverables: "Reels 1 支", p_amount_twd: 3000,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/brand/collabs");
  });
  it("資料庫錯誤", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "already invited" } });
    expect(await inviteCreatorAction({}, form({ creatorId: CREATOR, title: "x", deliverables: "x", amount: "1" })))
      .toEqual({ formError: "你已經邀請過這位創作者，請等對方回覆" });
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "invalid deliverables" } });
    expect(await inviteCreatorAction({}, form({ creatorId: CREATOR, title: "x", deliverables: "x", amount: "1" })))
      .toEqual({ fieldErrors: { deliverables: "格式不正確" } });
  });
});

describe("brandCollabAction", () => {
  it("只接受品牌的三個動作", async () => {
    expect(await brandCollabAction(COLLAB, "payout")).toEqual({ ok: false, error: "資料格式不正確，請重新整理頁面" });
    expect(await brandCollabAction("x", "cancel")).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("要求修改：說明必填", async () => {
    expect(await brandCollabAction(COLLAB, "request_changes", "  ")).toEqual({ ok: false, error: "請寫下要修改的地方" });
    expect(await brandCollabAction(COLLAB, "request_changes", 3)).toMatchObject({ ok: false });
    rpc.mockResolvedValue({ data: "awaiting_submission", error: null });
    expect(await brandCollabAction(COLLAB, "request_changes", " 第二張亮一點\r\n謝謝 ")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("transition_collaboration", {
      p_collab_id: COLLAB, p_action: "request_changes", p_note: "第二張亮一點\n謝謝",
    });
  });
  it("通過與取消用使用者自己的 client 呼叫 transition_collaboration", async () => {
    rpc.mockResolvedValue({ data: "awaiting_publish", error: null });
    expect(await brandCollabAction(COLLAB, "approve")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("transition_collaboration", { p_collab_id: COLLAB, p_action: "approve" });
    expect(revalidatePath).toHaveBeenCalledWith(`/creator/collabs/${COLLAB}`);
  });
  it("狀態已變", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "invalid transition: approve from awaiting_publish by brand" } });
    expect(await brandCollabAction(COLLAB, "approve")).toEqual({ ok: false, error: "合作案的狀態已經更新" });
  });
});
```

`src/app/creator/collabs/actions.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, rpc, revalidatePath } = vi.hoisted(() => ({ requireRole: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/current-user", () => ({ requireRole }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { creatorCollabAction, publishCollabAction, submitDeliverablesAction } from "./actions";

const UID = "00000000-0000-0000-0000-000000000731";
const COLLAB = "00000000-0000-0000-0000-0000000007d1";
const FILE = `${COLLAB}/${UID}/11111111-1111-4111-8111-111111111111.jpg`;

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: UID });
  rpc.mockReset();
  revalidatePath.mockReset();
});

describe("creatorCollabAction", () => {
  it("只接受接受與婉拒", async () => {
    expect(await creatorCollabAction(COLLAB, "submit")).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: "awaiting_payment", error: null });
    expect(await creatorCollabAction(COLLAB, "accept")).toEqual({ ok: true });
    expect(requireRole).toHaveBeenCalledWith("creator");
    expect(rpc).toHaveBeenCalledWith("transition_collaboration", { p_collab_id: COLLAB, p_action: "accept" });
  });
});

describe("submitDeliverablesAction", () => {
  it("參數形狀不對不碰資料庫", async () => {
    expect(await submitDeliverablesAction(COLLAB, null)).toMatchObject({ ok: false });
    expect(await submitDeliverablesAction(COLLAB, { note: "", links: "x", filePaths: [] })).toMatchObject({ ok: false });
    expect(await submitDeliverablesAction("x", { note: "", links: [], filePaths: [] })).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("檔案必須在自己的資料夾；至少一項", async () => {
    expect(await submitDeliverablesAction(COLLAB, { note: "", links: [], filePaths: [] }))
      .toEqual({ ok: false, fieldErrors: { files: "請上傳檔案或附上連結" } });
    expect(await submitDeliverablesAction(COLLAB, { note: "", links: [], filePaths: [`${COLLAB}/someone/x.jpg`] }))
      .toEqual({ ok: false, fieldErrors: { files: "檔案資料不正確，請重新上傳" } });
  });
  it("清理後送出", async () => {
    rpc.mockResolvedValue({ data: 1, error: null });
    expect(await submitDeliverablesAction(COLLAB, { note: " 初稿\r\n ", links: [" https://drive.google.com/x ", " "], filePaths: [FILE] }))
      .toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("submit_deliverables", {
      p_collab_id: COLLAB, p_note: "初稿", p_links: ["https://drive.google.com/x"], p_file_paths: [FILE],
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/brand/collabs/${COLLAB}`);
  });
  it("狀態已變", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "collaboration not awaiting submission" } });
    expect(await submitDeliverablesAction(COLLAB, { note: "", links: [], filePaths: [FILE] }))
      .toEqual({ ok: false, error: "合作案的狀態已經更新" });
  });
});

describe("publishCollabAction", () => {
  it("網址先在伺服器檢查", async () => {
    expect(await publishCollabAction(COLLAB, "https://a..b.com/p/1"))
      .toEqual({ ok: false, error: "請貼上完整的貼文網址（https:// 開頭、含路徑）" });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: "awaiting_payout", error: null });
    expect(await publishCollabAction(COLLAB, " https://www.instagram.com/p/abc/ ")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("transition_collaboration", {
      p_collab_id: COLLAB, p_action: "publish", p_published_url: "https://www.instagram.com/p/abc/",
    });
  });
});
```

`src/app/brand/briefs/actions.test.ts`：import 那行換成

```ts
import { acceptApplicationAction, closeBriefAction, deleteBriefAction, rejectApplicationAction, saveBriefAction } from "./actions";
```

檔案最後的 `describe("decideApplicationAction", …)` 整段刪除，換成：

```ts
describe("acceptApplicationAction", () => {
  function acceptForm(o: Record<string, string>) {
    return form({ applicationId: APP, briefId: ID, ...o });
  }
  it("id 格式不對不碰資料庫", async () => {
    expect(await acceptApplicationAction({}, form({ applicationId: "x", briefId: ID }))).toEqual({ formError: "資料格式不正確，請重新整理頁面" });
    expect(requireRole).toHaveBeenCalledWith("brand");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("金額與交付內容必填", async () => {
    expect(await acceptApplicationAction({}, acceptForm({ amount: "", deliverables: " " })))
      .toEqual({ fieldErrors: { deliverables: "請填寫交付內容", amount: "請填 1 到 10,000,000 的整數" } });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("錄取並導到合作案", async () => {
    rpc.mockResolvedValue({ data: "00000000-0000-0000-0000-0000000007e1", error: null });
    await expect(acceptApplicationAction({}, acceptForm({ amount: "6,000", deliverables: "IG 貼文 1 篇\r\n" })))
      .rejects.toThrow("REDIRECT /brand/collabs/00000000-0000-0000-0000-0000000007e1");
    expect(rpc).toHaveBeenCalledWith("accept_application_with_collab", {
      p_application_id: APP, p_amount_twd: 6000, p_deliverables: "IG 貼文 1 篇",
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/brand/briefs/${ID}`);
  });
  it("已處理過：標記 stale 讓畫面重新整理", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "application not pending" } });
    expect(await acceptApplicationAction({}, acceptForm({ amount: "1", deliverables: "x" })))
      .toEqual({ formError: "這筆報名已經處理過了", stale: true });
  });
});

describe("rejectApplicationAction", () => {
  it("參數格式不對時不碰資料庫", async () => {
    expect(await rejectApplicationAction("x", ID)).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("婉拒並重新整理詳情", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await rejectApplicationAction(APP, ID)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("decide_application", { p_id: APP, p_accept: false });
    expect(revalidatePath).toHaveBeenCalledWith(`/brand/briefs/${ID}`);
  });
  it("已處理過", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "application not pending" } });
    expect(await rejectApplicationAction(APP, ID)).toEqual({ ok: false, error: "這筆報名已經處理過了" });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/collabs/load.test.ts src/app/brand/collabs src/app/creator/collabs src/app/brand/briefs`
Expected: FAIL（模組不存在、`acceptApplicationAction` 不存在）。

- [ ] **Step 3: 實作讀取 `src/lib/collabs/load.ts`**

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DELIVERABLES_BUCKET, fileKindOf, fileLabel, SIGNED_URL_SECONDS, type FileKind } from "@/lib/deliverables";
import {
  revisionNotesByRound, toCollab, toCollabEvent, toCollabListItem, toSubmission,
  type Collab, type CollabEvent, type CollabListItem, type CollabListRow, type CollabRow, type CollabTab,
  type EventRow, type Submission, type SubmissionRow,
} from "./view";

// 合作案的伺服器端讀取。全部用使用者自己的 client（definer 函式與 RLS 自己檢查身分）。
// 會讀 cookie：只能在 requireRole 之後呼叫。不快取。

/** 我的合作案（輪到我的在前；最多 200 筆）。 */
export async function loadMyCollabs(tab: CollabTab): Promise<CollabListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_collaborations", { p_tab: tab });
  if (error) throw error;
  return ((data ?? []) as unknown as CollabListRow[]).map(toCollabListItem);
}

export type SubmissionFile = { path: string; kind: FileKind; label: string; url: string | null };
export type SubmissionView = Submission & { files: SubmissionFile[]; revisionNotes: string[] };
export type CollabDetailData = { collab: Collab; submissions: SubmissionView[]; events: CollabEvent[] };

/** 一個合作案的詳情；不是參與者（也不是管理員）或不存在回傳 null。檔案附 1 小時的 signed URL。 */
export async function loadCollabDetail(id: string): Promise<CollabDetailData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_collaboration", { p_id: id });
  if (error) throw error;
  const row = ((data ?? []) as unknown as CollabRow[])[0];
  if (!row) return null;
  const collab = toCollab(row);

  const [subsRes, eventsRes] = await Promise.all([
    supabase.from("collaboration_submissions")
      .select("id, round, note, links, file_paths, created_at")
      .eq("collaboration_id", id).order("round", { ascending: true }),
    supabase.rpc("list_collaboration_events", { p_id: id }),
  ]);
  if (subsRes.error) throw subsRes.error;
  if (eventsRes.error) throw eventsRes.error;
  const subs = ((subsRes.data ?? []) as unknown as SubmissionRow[]).map(toSubmission);
  const events = ((eventsRes.data ?? []) as unknown as EventRow[]).map(toCollabEvent);

  const paths = subs.flatMap((s) => s.filePaths);
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed, error: e3 } = await supabase.storage.from(DELIVERABLES_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (e3) throw e3;
    for (const s of signed ?? []) if (s.path && s.signedUrl && !s.error) urls.set(s.path, s.signedUrl);
  }
  const notes = revisionNotesByRound(subs, events);
  const submissions = subs.map((s) => ({
    ...s,
    files: s.filePaths.map((p, i) => ({ path: p, kind: fileKindOf(p), label: fileLabel(p, i), url: urls.get(p) ?? null })),
    revisionNotes: notes[s.round] ?? [],
  }));
  return { collab, submissions, events };
}
```

- [ ] **Step 4: 實作品牌的 actions `src/app/brand/collabs/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/briefs/query";
import { collabErrorMessage, collabFieldError } from "@/lib/collabs/errors";
import { cleanLongText, parseAmount, parseOfferForm, validateOffer, validateRevisionNote } from "@/lib/validation/collab";

const BAD_INPUT = "資料格式不正確，請重新整理頁面";

export type OfferFormState = { fieldErrors?: Record<string, string>; formError?: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateCollab(id: string) {
  revalidatePath("/brand/collabs");
  revalidatePath("/creator/collabs");
  revalidatePath(`/brand/collabs/${id}`);
  revalidatePath(`/creator/collabs/${id}`);
}

/** 在創作者公開頁直接邀請（invited）。成功後導到合作案詳情。 */
export async function inviteCreatorAction(_prev: OfferFormState, fd: FormData): Promise<OfferFormState> {
  await requireRole("brand");
  const creatorId = fd.get("creatorId");
  if (!isUuid(creatorId)) return { formError: BAD_INPUT };
  const input = parseOfferForm(fd);
  const fieldErrors = validateOffer(input, true);
  if (fieldErrors) return { fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_creator", {
    p_creator_id: creatorId,
    p_title: input.title,
    p_deliverables: input.deliverables,
    p_amount_twd: parseAmount(input.amount)!,
  });
  if (error) {
    const fe = collabFieldError(error);
    return fe ? { fieldErrors: fe } : { formError: collabErrorMessage(error) };
  }
  const id = data as unknown as string;
  revalidateCollab(id);
  redirect(`/brand/collabs/${id}`);
}

const BRAND_ACTIONS: readonly string[] = ["cancel", "approve", "request_changes"];

/** 品牌的狀態動作：取消（邀約中／待付款）、審核通過、要求修改（說明必填）。 */
export async function brandCollabAction(collabId: unknown, action: unknown, note?: unknown): Promise<ActionResult> {
  await requireRole("brand");
  if (!isUuid(collabId) || typeof action !== "string" || !BRAND_ACTIONS.includes(action)) return { ok: false, error: BAD_INPUT };
  let cleanNote: string | null = null;
  if (action === "request_changes") {
    if (typeof note !== "string") return { ok: false, error: BAD_INPUT };
    cleanNote = cleanLongText(note);
    const err = validateRevisionNote(cleanNote);
    if (err) return { ok: false, error: err };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_collaboration", {
    p_collab_id: collabId,
    p_action: action,
    ...(cleanNote !== null ? { p_note: cleanNote } : {}),
  });
  if (error) return { ok: false, error: collabErrorMessage(error) };
  revalidateCollab(collabId);
  return { ok: true };
}
```

- [ ] **Step 5: 實作創作者的 actions `src/app/creator/collabs/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/briefs/query";
import { collabErrorMessage, collabFieldError } from "@/lib/collabs/errors";
import { cleanLongText, isValidPostUrl, validateSubmission } from "@/lib/validation/collab";
import { cleanText } from "@/lib/validation/onboarding";

const BAD_INPUT = "資料格式不正確，請重新整理頁面";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SubmitResult = { ok: true } | { ok: false; error?: string; fieldErrors?: Record<string, string> };

function revalidateCollab(id: string) {
  revalidatePath("/brand/collabs");
  revalidatePath("/creator/collabs");
  revalidatePath(`/brand/collabs/${id}`);
  revalidatePath(`/creator/collabs/${id}`);
}

/** 創作者回覆邀約：接受或婉拒。 */
export async function creatorCollabAction(collabId: unknown, action: unknown): Promise<ActionResult> {
  await requireRole("creator");
  if (!isUuid(collabId) || (action !== "accept" && action !== "decline")) return { ok: false, error: BAD_INPUT };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_collaboration", { p_collab_id: collabId, p_action: action });
  if (error) return { ok: false, error: collabErrorMessage(error) };
  revalidateCollab(collabId);
  return { ok: true };
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.length <= 20 && v.every((x) => typeof x === "string");
}

/** 交稿：檔案已在瀏覽器上傳到 deliverables；這裡驗證後呼叫 submit_deliverables（同時推進到審核）。 */
export async function submitDeliverablesAction(collabId: unknown, input: unknown): Promise<SubmitResult> {
  const me = await requireRole("creator");
  if (!isUuid(collabId) || typeof input !== "object" || input === null) return { ok: false, error: BAD_INPUT };
  const { note, links, filePaths } = input as Record<string, unknown>;
  if (typeof note !== "string" || !isStringArray(links) || !isStringArray(filePaths)) return { ok: false, error: BAD_INPUT };
  const clean = { note: cleanLongText(note), links: links.map(cleanText).filter((l) => l !== ""), filePaths };
  const fieldErrors = validateSubmission(clean, collabId, me.id);
  if (fieldErrors) return { ok: false, fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_deliverables", {
    p_collab_id: collabId,
    p_note: clean.note === "" ? undefined : clean.note,
    p_links: clean.links,
    p_file_paths: clean.filePaths,
  });
  if (error) {
    const fe = collabFieldError(error);
    return fe ? { ok: false, fieldErrors: fe } : { ok: false, error: collabErrorMessage(error) };
  }
  revalidateCollab(collabId);
  return { ok: true };
}

/** 填入貼文連結（awaiting_publish → awaiting_payout）。前端與這裡都先用 new URL() 檢查，資料庫 regex 再擋一次。 */
export async function publishCollabAction(collabId: unknown, url: unknown): Promise<ActionResult> {
  await requireRole("creator");
  if (!isUuid(collabId) || typeof url !== "string") return { ok: false, error: BAD_INPUT };
  const clean = cleanText(url);
  if (!isValidPostUrl(clean)) return { ok: false, error: "請貼上完整的貼文網址（https:// 開頭、含路徑）" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_collaboration", {
    p_collab_id: collabId, p_action: "publish", p_published_url: clean,
  });
  if (error) return { ok: false, error: collabErrorMessage(error) };
  revalidateCollab(collabId);
  return { ok: true };
}
```

- [ ] **Step 6: 招募的錄取改成建立合作案**

`src/app/brand/briefs/actions.ts`：在 `import { isUuid, parseBriefStep } from "@/lib/briefs/query";` 下面加兩行

```ts
import { collabErrorMessage, collabFieldError } from "@/lib/collabs/errors";
import { parseAmount, parseOfferForm, validateOffer } from "@/lib/validation/collab";
```

檔案最後的 `decideApplicationAction`（含上面的註解）整段刪除，換成：

```ts
export type AcceptFormState = { fieldErrors?: Record<string, string>; formError?: string; stale?: boolean };

/**
 * 錄取並建立合作案（同一個 transaction：報名 → 已錄取、建立對話、建立合作案 awaiting_payment）。
 * 成功後導到合作案詳情。招募關閉或截止後也可以。
 */
export async function acceptApplicationAction(_prev: AcceptFormState, fd: FormData): Promise<AcceptFormState> {
  await requireRole("brand");
  const applicationId = fd.get("applicationId");
  const briefId = fd.get("briefId");
  if (!isUuid(applicationId) || !isUuid(briefId)) return { formError: BAD_INPUT };
  const input = parseOfferForm(fd);
  const fieldErrors = validateOffer(input, false);
  if (fieldErrors) return { fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_application_with_collab", {
    p_application_id: applicationId,
    p_amount_twd: parseAmount(input.amount)!,
    p_deliverables: input.deliverables,
  });
  if (error) {
    const fe = collabFieldError(error);
    if (fe) return { fieldErrors: fe };
    // 連點或另一個分頁已處理：讓畫面重新整理
    if (error.message === "application not pending" || error.message === "collaboration exists") {
      return { formError: collabErrorMessage(error), stale: true };
    }
    return { formError: collabErrorMessage(error) };
  }
  const collabId = data as unknown as string;
  revalidatePath(`/brand/briefs/${briefId}`);
  revalidatePath("/brand/briefs");
  revalidatePath("/brand/collabs");
  revalidatePath("/creator/collabs");
  redirect(`/brand/collabs/${collabId}`);
}

/** 婉拒報名。招募關閉或截止後也可以。 */
export async function rejectApplicationAction(applicationId: unknown, briefId: unknown): Promise<ActionResult> {
  await requireRole("brand");
  if (!isUuid(applicationId) || !isUuid(briefId)) return { ok: false, error: BAD_INPUT };
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_application", { p_id: applicationId, p_accept: false });
  if (error) return { ok: false, error: briefErrorMessage(error) };
  revalidatePath(`/brand/briefs/${briefId}`);
  revalidatePath("/brand/briefs");
  return { ok: true };
}
```

`src/lib/briefs/view.ts`：`Applicant` 型別最後加 `collaborationId: string | null;`（註解 `/** 已錄取時的合作案 id（計畫 6） */`）；`ApplicantRow` 最後加 `collaboration_id?: string | null;`（選填：舊測試的 row 不必改）；`toApplicant` 回傳物件最後加 `collaborationId: r.collaboration_id ?? null,`。

`src/components/briefs/ApplicantList.tsx`：這個 task 只為了讓 typecheck 通過，先把 import 的 `decideApplicationAction` 換成 `rejectApplicationAction`，`decide(accept)` 裡的呼叫換成 `accept ? { ok: false as const, error: "請重新整理頁面" } : await rejectApplicationAction(a.id, briefId)`。Task 10 會把整個檔案換成錄取表單版本。

- [ ] **Step 7: 跑測試確認通過**

Run: `npx vitest run src/lib/collabs src/app/brand/collabs src/app/creator/collabs src/app/brand/briefs`
Expected: PASS（撰寫時已在本機實際跑過：load 5 個、品牌 actions 8 個、創作者 actions 6 個、招募 actions 20 個）。

- [ ] **Step 8: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/lib/collabs/load.ts src/lib/collabs/load.test.ts src/app/brand/collabs/actions.ts src/app/brand/collabs/actions.test.ts \
  src/app/creator/collabs/actions.ts src/app/creator/collabs/actions.test.ts src/app/brand/briefs/actions.ts src/app/brand/briefs/actions.test.ts \
  src/lib/briefs/view.ts src/components/briefs/ApplicantList.tsx
git commit -m "計畫 6 Task 5：合作案讀取與 Server Actions（邀請、狀態動作、交稿、發佈；錄取改成建立合作案）"
```

---

### Task 6: 審核逾期自動通過的 Cron route 與本機「標記已付款」route

**Files:**
- Create: `src/lib/cron/auth.ts`、`src/lib/cron/auth.test.ts`、`src/app/api/cron/auto-approve/route.ts`、`src/app/api/cron/auto-approve/route.test.ts`、`vercel.json`、`src/lib/collabs/dev-payment.ts`、`src/lib/collabs/dev-payment.test.ts`、`src/app/api/dev/mark-paid/route.ts`、`src/app/api/dev/mark-paid/route.test.ts`
- Modify: `src/proxy.ts`、`.env.example`

**Interfaces:**
- Consumes: `auto_approve_due()`、`get_collaboration`、`record_payment_success`、`payments` 的 service_role insert 欄位；`createAdminClient`、`createClient`（server）、`isDevLoginEnabled`、`relativeRedirect`、`isUuid`。
- Produces：
  - `isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean`
  - `GET /api/cron/auto-approve`：沒設 `CRON_SECRET` → 500；Bearer 不對 → 401；成功 → `200 {"approved": n, "failed": [...]}`。
  - `devMerchantTradeNo(uuid?: string): string`（`DEV` + 17 位大寫十六進位）
  - `POST /api/dev/mark-paid`（form 欄位 `collabId`）：非本機開發 404；不是參與者 404；成功 303 導回 `/<brand|creator>/collabs/<id>`。Task 8 的「標記已付款（本機）」按鈕送到這裡。

- [ ] **Step 1: 寫失敗的測試**

`src/lib/cron/auth.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { isAuthorizedCron } from "./auth";

describe("isAuthorizedCron", () => {
  it("Bearer + 正確的 secret", () => {
    expect(isAuthorizedCron("Bearer s3cret-value", "s3cret-value")).toBe(true);
  });
  it("錯的、沒帶、少了 Bearer、大小寫不同都不通過", () => {
    expect(isAuthorizedCron("Bearer wrong", "s3cret-value")).toBe(false);
    expect(isAuthorizedCron(null, "s3cret-value")).toBe(false);
    expect(isAuthorizedCron("s3cret-value", "s3cret-value")).toBe(false);
    expect(isAuthorizedCron("bearer s3cret-value", "s3cret-value")).toBe(false);
    expect(isAuthorizedCron("Bearer s3cret-value ", "s3cret-value")).toBe(false);
  });
  it("secret 沒設定時一律不通過", () => {
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
    expect(isAuthorizedCron("Bearer undefined", undefined)).toBe(false);
  });
});
```

`src/app/api/cron/auto-approve/route.test.ts`：

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

import { GET } from "./route";

function req(auth?: string): Request {
  return new Request("http://localhost/api/cron/auto-approve", { headers: auth ? { authorization: auth } : {} });
}

beforeEach(() => {
  rpc.mockReset();
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/cron/auto-approve", () => {
  it("沒帶或帶錯 secret 回 401，不碰資料庫", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("CRON_SECRET 沒設定回 500", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "))).status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("帶對 secret：以 service_role 呼叫 auto_approve_due 並回傳件數", async () => {
    rpc.mockResolvedValue({ data: [{ approved: 2, failed: ["c9"] }], error: null });
    const res = await GET(req("Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ approved: 2, failed: ["c9"] });
    expect(rpc).toHaveBeenCalledWith("auto_approve_due");
    expect(console.error).toHaveBeenCalledWith("cron auto-approve: some collaborations failed", { failed: ["c9"] });
  });
  it("資料庫錯誤回 500", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    expect((await GET(req("Bearer test-secret"))).status).toBe(500);
  });
});
```

`src/lib/collabs/dev-payment.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { devMerchantTradeNo } from "./dev-payment";

describe("devMerchantTradeNo", () => {
  it("DEV + 17 位大寫十六進位，共 20 字", () => {
    expect(devMerchantTradeNo("1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d")).toBe("DEV1A2B3C4D5E6F4A1B8");
    expect(devMerchantTradeNo()).toMatch(/^DEV[0-9A-F]{17}$/);
  });
});
```

`src/app/api/dev/mark-paid/route.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { enabled, userRpc, adminRpc, insert } = vi.hoisted(() => ({
  enabled: vi.fn(), userRpc: vi.fn(), adminRpc: vi.fn(), insert: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/dev-login", () => ({ isDevLoginEnabled: enabled }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: userRpc }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: adminRpc, from: () => ({ insert }) }) }));

import { POST } from "./route";

const ID = "00000000-0000-0000-0000-0000000007e2";

function req(collabId: string) {
  const body = new FormData();
  body.set("collabId", collabId);
  return new Request("http://localhost/api/dev/mark-paid", { method: "POST", body }) as never;
}

beforeEach(() => {
  enabled.mockReset().mockReturnValue(true);
  userRpc.mockReset();
  adminRpc.mockReset();
  insert.mockReset().mockResolvedValue({ error: null });
});

describe("POST /api/dev/mark-paid", () => {
  it("非本機開發一律 404", async () => {
    enabled.mockReturnValue(false);
    expect((await POST(req(ID))).status).toBe(404);
    expect(userRpc).not.toHaveBeenCalled();
  });
  it("不是參與者 404", async () => {
    userRpc.mockResolvedValue({ data: [], error: null });
    expect((await POST(req(ID))).status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });
  it("建付款單再呼叫 record_payment_success，303 導回詳情", async () => {
    userRpc.mockResolvedValue({ data: [{ status: "awaiting_payment", amount_twd: 4500, my_side: "brand" }], error: null });
    adminRpc.mockResolvedValue({ data: "paid", error: null });
    const res = await POST(req(ID));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/brand/collabs/${ID}`);
    const payment = insert.mock.calls[0][0];
    expect(payment).toMatchObject({ collaboration_id: ID, provider: "ecpay", amount_twd: 4500 });
    expect(payment.merchant_trade_no).toMatch(/^DEV[0-9A-F]{17}$/);
    expect(adminRpc).toHaveBeenCalledWith("record_payment_success", expect.objectContaining({
      p_merchant_trade_no: payment.merchant_trade_no, p_amount_twd: 4500,
    }));
  });
  it("已經不是待付款：不建單，直接導回", async () => {
    userRpc.mockResolvedValue({ data: [{ status: "awaiting_submission", amount_twd: 4500, my_side: "creator" }], error: null });
    const res = await POST(req(ID));
    expect(res.headers.get("location")).toBe(`/creator/collabs/${ID}`);
    expect(insert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/cron src/app/api src/lib/collabs/dev-payment.test.ts`
Expected: FAIL（模組不存在）。

- [ ] **Step 3: 實作**

`src/lib/cron/auth.ts`：

```ts
import { createHash, timingSafeEqual } from "node:crypto";

function digest(v: string): Buffer {
  return createHash("sha256").update(v, "utf8").digest();
}

/**
 * Vercel Cron 會帶 `Authorization: Bearer <CRON_SECRET>`。比較兩邊的 SHA-256（長度固定）再用 timingSafeEqual，
 * 不因內容或長度不同而提早結束。secret 沒設定一律不通過（不能讓「沒設定」等於「不檢查」）。
 */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const given = authorization ?? "";
  return timingSafeEqual(digest(given), digest(`Bearer ${secret}`));
}
```

`src/app/api/cron/auto-approve/route.ts`（GET：Vercel Cron 送 GET；讀 `request.headers` 所以在請求時執行，見「設計決定」10）：

```ts
import { isAuthorizedCron } from "@/lib/cron/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type AutoApproveRow = { approved: number | null; failed: string[] | null };

/**
 * 審核逾期自動通過（Vercel Cron，vercel.json：每天 UTC 01:00 = 台灣 09:00）。
 * 只接受 `Authorization: Bearer ${CRON_SECRET}`；以 service_role 呼叫 auto_approve_due()（transition_collaboration 判定為 system）。
 * 讀 request.headers，所以這個 GET 一定在請求時執行（cacheComponents 下不會被預渲染）。
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("cron auto-approve: CRON_SECRET is not set");
    return Response.json({ error: "not configured" }, { status: 500 });
  }
  if (!isAuthorizedCron(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { data, error } = await createAdminClient().rpc("auto_approve_due");
    if (error) {
      console.error("cron auto-approve: rpc failed", { code: error.code, message: error.message });
      return Response.json({ error: "rpc failed" }, { status: 500 });
    }
    const row = ((data ?? []) as unknown as AutoApproveRow[])[0];
    const approved = row?.approved ?? 0;
    const failed = row?.failed ?? [];
    if (failed.length > 0) console.error("cron auto-approve: some collaborations failed", { failed });
    console.info("cron auto-approve: done", { approved, failed: failed.length });
    return Response.json({ approved, failed });
  } catch (e) {
    console.error("cron auto-approve: unhandled error", e);
    return Response.json({ error: "error" }, { status: 500 });
  }
}
```

`src/lib/collabs/dev-payment.ts`：

```ts
/** 本機「標記已付款」用的付款單編號：DEV + 17 位大寫十六進位（符合 payments.merchant_trade_no 的 ^[A-Za-z0-9]{1,20}$）。 */
export function devMerchantTradeNo(uuid: string = crypto.randomUUID()): string {
  return `DEV${uuid.replaceAll("-", "").slice(0, 17).toUpperCase()}`;
}
```

`src/app/api/dev/mark-paid/route.ts`：

```ts
import { type NextRequest, NextResponse } from "next/server";
import { isDevLoginEnabled } from "@/lib/auth/dev-login";
import { relativeRedirect } from "@/lib/auth/relative-redirect";
import { isUuid } from "@/lib/briefs/query";
import { devMerchantTradeNo } from "@/lib/collabs/dev-payment";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * 本機測試用「標記已付款」。開關與測試快速登入相同（isDevLoginEnabled），正式環境一律 404。
 * 走與正式付款相同的路徑：service_role 建付款單 → record_payment_success（不呼叫 mark_paid、不開捷徑）。
 */
export async function POST(request: NextRequest) {
  if (!isDevLoginEnabled()) return new NextResponse(null, { status: 404 });

  const form = await request.formData();
  const collabId = form.get("collabId");
  if (!isUuid(collabId)) return new NextResponse(null, { status: 400 });

  // 先用登入者自己的 client 確認是參與者、狀態是待付款
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_collaboration", { p_id: collabId });
  if (error) return fail(`get_collaboration: ${error.message}`);
  const row = ((data ?? []) as unknown as { status: string | null; amount_twd: number | null; my_side: string | null }[])[0];
  if (!row || (row.my_side !== "brand" && row.my_side !== "creator")) return new NextResponse(null, { status: 404 });
  const back = `/${row.my_side}/collabs/${collabId}`;
  if (row.status !== "awaiting_payment" || !row.amount_twd) return relativeRedirect(back, 303);

  const admin = createAdminClient();
  const tradeNo = devMerchantTradeNo();
  const { error: e1 } = await admin.from("payments").insert({
    collaboration_id: collabId, provider: "ecpay", merchant_trade_no: tradeNo, amount_twd: row.amount_twd,
  });
  if (e1) return fail(`insert payment: ${e1.message}`);
  const { data: result, error: e2 } = await admin.rpc("record_payment_success", {
    p_merchant_trade_no: tradeNo,
    p_amount_twd: row.amount_twd,
    p_provider_trade_no: `DEV-${tradeNo}`,
    p_raw: { source: "dev-mark-paid" },
  });
  if (e2) return fail(`record_payment_success: ${e2.message}`);
  if (result !== "paid") return fail(`record_payment_success returned ${String(result)}`);
  return relativeRedirect(back, 303);
}

function fail(message: string) {
  return new NextResponse(`mark-paid 失敗：${message}`, { status: 500 });
}
```

`vercel.json`（專案根目錄，新檔；理由見「設計決定」10）：

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/cron/auto-approve", "schedule": "0 1 * * *" }
  ]
}
```

`src/proxy.ts`：matcher 也排除 cron（不帶 cookie，不需要更新 session）。把 matcher 那兩行換成：

```ts
    // 排除靜態檔、圖片、綠界付款通知與 Vercel Cron（伺服器對伺服器，不會帶 cookie，也不需要 session）
    "/((?!_next/static|_next/image|favicon.ico|api/payments/ecpay/notify|api/cron/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
```

`.env.example` 最後加：

```
# Vercel Cron（審核逾期自動通過）：/api/cron/auto-approve 只接受 Authorization: Bearer <CRON_SECRET>
# 本機隨便填一個值即可；正式環境要加到 Vercel 的 Production 環境變數
CRON_SECRET=
```

並在自己的 `.env.local` 加一行 `CRON_SECRET=local-cron-secret`（不 commit；Task 11 的 E2E 會用到）。

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/cron src/app/api src/lib/collabs/dev-payment.test.ts`
Expected: PASS（撰寫時已在本機實際跑過：12 個測試通過）。

- [ ] **Step 5: Commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/lib/cron src/app/api/cron src/app/api/dev src/lib/collabs/dev-payment.ts src/lib/collabs/dev-payment.test.ts vercel.json src/proxy.ts .env.example
git commit -m "計畫 6 Task 6：審核逾期自動通過 Cron route（CRON_SECRET、vercel.json）與本機標記已付款 route"
```

---

### Task 7: 導覽列與合作案列表頁

**Files:**
- Create: `src/components/collabs/CollabStatusBadge.tsx`、`src/components/collabs/Counterpart.tsx`、`src/components/collabs/CollabList.tsx`、`src/components/collabs/CollabPages.tsx`（這個 task 只放列表的部分）、`src/app/brand/collabs/page.tsx`、`src/app/creator/collabs/page.tsx`
- Modify: `src/components/shell/nav.ts`、`src/components/shell/nav.test.ts`

**Interfaces:**
- Consumes: Task 4 的 `listBadge`、`COLLAB_TABS`、`parseCollabTab`、`COLLAB_STATUS_LABEL`；Task 5 的 `loadMyCollabs`；既有的 `Avatar`（`src/components/square/Avatar.tsx`）、`BrandMark`（`src/components/briefs/BrandMark.tsx`）、`formatDateTw`、`formatTwd`。
- Produces：`CollabStatusBadge({ status })`、`TurnBadge({ badge })`、`Counterpart({ side, name, imagePath })`、`CollabTabs({ side, tab })`、`CollabList({ side, tab, items })`、`CollabListSection({ side, searchParams })`、`CollabListSkeleton()`。Task 8 在 `CollabPages.tsx` 加上 `CollabDetailSection`。

- [ ] **Step 1: 寫失敗的測試（導覽列）**

`src/components/shell/nav.test.ts`：import 改成 `import { BRAND_NAV, CREATOR_NAV, isActive } from "./nav";`，檔案最後加：

```ts
describe("合作案（計畫 6）", () => {
  it("品牌「合作案」與創作者「合作」已開放，詳情頁也會亮起", () => {
    expect(BRAND_NAV.find((i) => i.label === "合作案")?.href).toBe("/brand/collabs");
    expect(CREATOR_NAV.find((i) => i.label === "合作")?.href).toBe("/creator/collabs");
    expect(isActive("/creator/collabs", "/creator/collabs/00000000-0000-0000-0000-000000000001")).toBe(true);
  });
});
```

Run: `npx vitest run src/components/shell/nav.test.ts` → FAIL（href 是 null）。

- [ ] **Step 2: 導覽列**

`src/components/shell/nav.ts`：

```ts
  { label: "合作案", href: "/brand/collabs", icon: "Handshake" },
```
```ts
  { label: "合作", href: "/creator/collabs", icon: "Handshake" },
```
（分別取代 `BRAND_NAV`、`CREATOR_NAV` 裡 `href: null` 的那一行。）

Run: `npx vitest run src/components/shell/nav.test.ts` → PASS。

- [ ] **Step 3: 列表元件**

`src/components/collabs/CollabStatusBadge.tsx`：

```tsx
import { COLLAB_STATUS_LABEL, type CollabStatus, type ListBadge } from "@/lib/collabs/view";

const base = "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";

const STATUS_TONE: Record<CollabStatus, string> = {
  invited: "border border-line bg-surface text-ink",
  awaiting_payment: "border border-line bg-surface text-ink",
  awaiting_submission: "border border-line bg-surface text-ink",
  in_review: "border border-line bg-surface text-ink",
  awaiting_publish: "border border-line bg-surface text-ink",
  awaiting_payout: "bg-primary-soft text-ink",
  completed: "bg-success-soft text-success",
  declined: "bg-primary-soft text-muted",
  cancelled: "bg-primary-soft text-muted",
};

const TURN_TONE: Record<ListBadge["tone"], string> = {
  turn: "bg-ink text-on-ink",
  wait: "bg-primary-soft text-muted",
  platform: "bg-primary-soft text-ink",
};

export function CollabStatusBadge({ status }: { status: CollabStatus }) {
  return <span className={`${base} ${STATUS_TONE[status]}`}>{COLLAB_STATUS_LABEL[status]}</span>;
}

export function TurnBadge({ badge }: { badge: ListBadge }) {
  return <span className={`${base} ${TURN_TONE[badge.tone]}`}>{badge.label}</span>;
}
```

`src/components/collabs/Counterpart.tsx`：

```tsx
import { BrandMark } from "@/components/briefs/BrandMark";
import { Avatar } from "@/components/square/Avatar";
import type { CollabSide } from "@/lib/collabs/view";

/** 對方的頭像：品牌視角看到創作者頭像（creator-media），創作者視角看到品牌 Logo（brand-logos）。 */
export function Counterpart({ side, name, imagePath }: { side: CollabSide; name: string; imagePath: string | null }) {
  return side === "brand"
    ? <Avatar path={imagePath} name={name} size="md" />
    : <BrandMark name={name} logoPath={imagePath} size="md" />;
}
```

`src/components/collabs/CollabList.tsx`：

```tsx
import Link from "next/link";
import { COLLAB_TABS, listBadge, type CollabListItem, type CollabSide, type CollabTab } from "@/lib/collabs/view";
import { formatDateTw } from "@/lib/briefs/dates";
import { formatTwd } from "@/lib/format";
import { CollabStatusBadge, TurnBadge } from "./CollabStatusBadge";
import { Counterpart } from "./Counterpart";

const EMPTY: Record<CollabSide, string> = {
  brand: "還沒有合作案。到創作者廣場邀請，或從招募錄取創作者。",
  creator: "還沒有合作案。到機會頁報名招募吧。",
};

/** 分頁標籤（連結，寫進 ?tab=）。 */
export function CollabTabs({ side, tab }: { side: CollabSide; tab: CollabTab }) {
  return (
    <nav aria-label="合作案狀態" className="flex gap-2">
      {COLLAB_TABS.map((t) => {
        const active = t.value === tab;
        const href = t.value === "active" ? `/${side}/collabs` : `/${side}/collabs?tab=${t.value}`;
        return (
          <Link
            key={t.value} href={href} aria-current={active ? "page" : undefined}
            className={`h-9 rounded-full border px-4 text-sm font-semibold leading-9 ${active ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** 合作案列表（已由資料庫排序：輪到你的在前，其次依更新時間）。 */
export function CollabList({ side, tab, items }: { side: CollabSide; tab: CollabTab; items: CollabListItem[] }) {
  if (items.length === 0) {
    return (
      <p className="mt-6 rounded-card border border-line bg-surface p-8 text-center text-sm text-muted">
        {tab === "active" ? EMPTY[side] : "這裡還沒有合作案"}
      </p>
    );
  }
  return (
    <ul className="mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {items.map((c) => {
        const badge = tab === "active" ? listBadge(c.status, side) : null;
        return (
          <li key={c.id}>
            <Link
              href={`/${side}/collabs/${c.id}`}
              className="flex items-start gap-3 p-4 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink md:p-5"
            >
              <Counterpart side={side} name={c.counterpartName} imagePath={c.counterpartImagePath} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words font-semibold text-ink">{c.title}</p>
                  {badge && <TurnBadge badge={badge} />}
                </div>
                <p className="mt-0.5 min-w-0 break-words text-sm text-muted">{c.counterpartName}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-semibold text-primary">{formatTwd(c.amount)}</span>
                  <CollabStatusBadge status={c.status} />
                  {c.updatedAt && <span className="text-xs text-muted">更新於 {formatDateTw(c.updatedAt)}</span>}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
```

`src/components/collabs/CollabPages.tsx`（列表部分）：

```tsx
import { requireRole } from "@/lib/auth/current-user";
import { loadMyCollabs } from "@/lib/collabs/load";
import { parseCollabTab, type CollabSide } from "@/lib/collabs/view";
import { CollabList, CollabTabs } from "./CollabList";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** 列表頁的內容（在 <Suspense> 內）：layout 的 Gate 在用戶端換頁時不會重跑，這裡自己 requireRole。 */
export async function CollabListSection({ side, searchParams }: { side: CollabSide; searchParams: SearchParams }) {
  await requireRole(side);
  const tab = parseCollabTab((await searchParams).tab);
  const items = await loadMyCollabs(tab);
  return (
    <div>
      <CollabTabs side={side} tab={tab} />
      <CollabList side={side} tab={tab} items={items} />
    </div>
  );
}

export function CollabListSkeleton() {
  return (
    <div aria-busy="true">
      <p className="sr-only">載入中…</p>
      <div className="h-9 w-64 rounded-full bg-surface" />
      <div className="mt-4 h-48 rounded-card border border-line bg-surface" />
    </div>
  );
}
```

- [ ] **Step 4: 頁面**

`src/app/brand/collabs/page.tsx`：

```tsx
import { Suspense } from "react";
import { CollabListSection, CollabListSkeleton } from "@/components/collabs/CollabPages";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// 頁面殼是靜態的；searchParams 與 session 都在 <Suspense> 內讀（cacheComponents）
export default function BrandCollabsPage({ searchParams }: Props) {
  return (
    <div>
      <h1 className="text-[32px] font-bold text-ink">合作案</h1>
      <div className="mt-6">
        <Suspense fallback={<CollabListSkeleton />}>
          <CollabListSection side="brand" searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
```

`src/app/creator/collabs/page.tsx`：

```tsx
import { Suspense } from "react";
import { CollabListSection, CollabListSkeleton } from "@/components/collabs/CollabPages";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// 頁面殼是靜態的；searchParams 與 session 都在 <Suspense> 內讀（cacheComponents）
export default function CreatorCollabsPage({ searchParams }: Props) {
  return (
    <div>
      <h1 className="text-[32px] font-bold text-ink">合作</h1>
      <div className="mt-6">
        <Suspense fallback={<CollabListSkeleton />}>
          <CollabListSection side="creator" searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 檢查與 commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/components/shell/nav.ts src/components/shell/nav.test.ts src/components/collabs src/app/brand/collabs/page.tsx src/app/creator/collabs/page.tsx
git commit -m "計畫 6 Task 7：導覽列與合作案列表（分頁、輪到你／等對方、空狀態）"
```
（畫面由 Task 11 的 build 與 E2E 驗證。）

---

### Task 8: 合作案詳情頁（標題區、進度條、「現在要做什麼」卡片、交稿紀錄、系統事件）

**Files:**
- Create: `src/components/collabs/useCollabAction.ts`、`CollabHeader.tsx`、`Stepper.tsx`、`FileTile.tsx`、`SubmissionList.tsx`、`EventList.tsx`、`RevisionForm.tsx`、`CollabActions.tsx`、`ActionCard.tsx`、`CollabDetail.tsx`（都在 `src/components/collabs/`）、`src/app/brand/collabs/[id]/page.tsx`、`src/app/creator/collabs/[id]/page.tsx`
- Modify: `src/components/collabs/CollabPages.tsx`

**Interfaces:**
- Consumes: Task 4 的 view／validation 函式、Task 5 的 `loadCollabDetail`、`SubmissionView`、`SubmissionFile`、`brandCollabAction`、`creatorCollabAction`；既有的 `ConfirmAction`、`isDevLoginEnabled`、`isUuid`、`requireRole`。
- Produces：`useCollabAction()`（`{ pending, error, notice, run(fn, onOk?), setError }`）、`CollabActions({ collabId, status, side, uid, devPaymentEnabled })`、`CollabDetail({ data, side, uid, nowMs, devPaymentEnabled })`、`CollabDetailSection({ side, params })`。Task 9 在 `CollabActions` 接上 `SubmitPanel`（待交稿）與 `PublishForm`（待發佈）。

畫面規則（spec「詳情」）：
- 品牌在 `awaiting_payment`：「確認並付款」只展開說明（不呼叫任何 action）；「取消合作」用頁面內確認區塊；本機另外有「標記已付款（本機）」（一般 POST 表單到 Task 6 的 route，只有伺服器端 `isDevLoginEnabled()` 為真時才渲染）。品牌在 `invited` 可以「撤回邀約」。
- 創作者在 `invited`：「接受邀約」（主要）、「婉拒」（確認區塊）。
- 品牌在 `in_review`：卡片裡顯示最新一次交稿的縮圖、倒數、「審核通過」與「要求修改」（展開的說明區塊，必填、≤ 1000 字）。
- 輪到對方時卡片一定寫「你不用做任何事」；卡片在輪到自己時用主色外框。
- 品牌開 `/creator/collabs/...`、創作者開 `/brand/collabs/...` 由 layout 的 `requireRole` 導回自己那一區；非參與者、id 不是 UUID、或視角不符 → `notFound()`（soft 404）。

- [ ] **Step 1: 共用的 action hook 與要求修改表單**

`src/components/collabs/useCollabAction.ts`：

```ts
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isStaleStateMessage } from "@/lib/briefs/errors";

type Result = { ok: true } | { ok: false; error?: string };

/**
 * 呼叫合作案的 Server Action：進行中 pending；狀態已變（連點、另一個分頁）時不當成錯誤，
 * 顯示提示並 router.refresh()；其他錯誤顯示在 error。
 */
export function useCollabAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function run(fn: () => Promise<Result>, onOk?: () => void) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          onOk?.();
          return;
        }
        if (res.error && isStaleStateMessage(res.error)) {
          setNotice("狀態已更新，已為你重新整理");
          router.refresh();
        } else if (res.error) {
          setError(res.error);
        }
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }

  return { pending, error, notice, run, setError };
}
```

`src/components/collabs/RevisionForm.tsx`：

```tsx
"use client";

import { useId, useState } from "react";
import { brandCollabAction } from "@/app/brand/collabs/actions";
import { textLength } from "@/lib/validation/brief";
import { NOTE_MAX, validateRevisionNote } from "@/lib/validation/collab";
import { useCollabAction } from "./useCollabAction";

/** 要求修改：頁面內展開的確認區塊，說明必填、最多 1000 字。 */
export function RevisionForm({ collabId }: { collabId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const { pending, error, notice, run, setError } = useCollabAction();
  const id = useId();
  const count = textLength(note);

  if (!open) {
    return (
      <div className="w-full sm:w-auto">
        <button type="button" onClick={() => setOpen(true)} aria-expanded={false}
          className="h-11 w-full rounded-btn border border-line bg-surface px-4 font-semibold text-ink sm:w-auto">
          要求修改
        </button>
        {notice && <p role="status" className="mt-2 text-sm text-muted">{notice}</p>}
      </div>
    );
  }
  return (
    <div role="group" aria-label="要求修改" className="w-full rounded-card border border-line bg-surface p-4">
      <label htmlFor={id} className="text-sm font-semibold text-ink">要修改的地方（必填）</label>
      <textarea
        id={id} rows={4} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending}
        className="mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ink"
      />
      <p aria-live="polite" className={`text-right text-xs ${count > NOTE_MAX ? "font-semibold text-danger" : "text-muted"}`}>
        {count}/{NOTE_MAX}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button" disabled={pending}
          onClick={() => {
            const err = validateRevisionNote(note.trim());
            if (err) return setError(err);
            run(() => brandCollabAction(collabId, "request_changes", note), () => { setOpen(false); setNote(""); });
          }}
          className="h-10 rounded-btn bg-ink px-4 text-sm font-semibold text-on-ink disabled:opacity-60"
        >
          {pending ? "送出中…" : "送出修改要求"}
        </button>
        <button type="button" disabled={pending} onClick={() => { setOpen(false); setError(null); }}
          className="h-10 rounded-btn border border-line px-4 text-sm font-semibold text-ink disabled:opacity-60">
          取消
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="mt-2 text-sm text-muted">{notice}</p>}
    </div>
  );
}
```

- [ ] **Step 2: 標題區、進度條、檔案、交稿紀錄、事件**

`src/components/collabs/CollabHeader.tsx`：

```tsx
import Link from "next/link";
import { caseCode, escrowLabel, sourceLabel, type Collab } from "@/lib/collabs/view";
import { CollabStatusBadge } from "./CollabStatusBadge";

/** 標題區：創作者 × 案名、交付內容、金額與託管狀態、案號、來源。 */
export function CollabHeader({ c }: { c: Collab }) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 break-words text-[24px] font-bold text-ink md:text-[28px]">
          <Link href={`/c/${c.creatorHandle}`} className="underline-offset-2 hover:underline">{c.creatorName}</Link>
          <span className="text-muted"> × </span>
          {c.title}
        </h1>
        <CollabStatusBadge status={c.status} />
      </div>
      <dl className="grid gap-3 rounded-card border border-line bg-surface p-4 text-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:p-5">
        <div className="min-w-0">
          <dt className="text-xs text-muted">交付內容</dt>
          <dd className="mt-0.5 whitespace-pre-line break-words text-ink">{c.deliverables}</dd>
        </div>
        <div className="space-y-2">
          <div>
            <dt className="text-xs text-muted">金額</dt>
            <dd className="mt-0.5 font-semibold text-primary">{escrowLabel(c.status, c.amount)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <div>
              <dt className="text-xs text-muted">案號</dt>
              <dd className="font-mono text-ink">{caseCode(c.id)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted">來源</dt>
              <dd className="break-words text-ink">{sourceLabel(c)}</dd>
            </div>
          </div>
          <div>
            <dt className="text-xs text-muted">品牌</dt>
            <dd className="break-words text-ink">{c.brandName}</dd>
          </div>
        </div>
      </dl>
    </header>
  );
}
```

`src/components/collabs/Stepper.tsx`：

```tsx
import { Check } from "lucide-react";
import { COLLAB_STATUS_LABEL, COLLAB_STEPS, stepNumber, stepStates, type CollabStatus } from "@/lib/collabs/view";

/**
 * 7 步進度條。桌面：每一步一個圓點（已完成淡主色、目前主色加光暈、之後灰色）；
 * 手機：「目前狀態名稱 + 第 N / 7 步」加一條進度線。婉拒與取消不顯示。
 */
export function Stepper({ status }: { status: CollabStatus }) {
  const states = stepStates(status);
  const n = stepNumber(status);
  if (!states || n === null) return null;
  const done = status === "completed";
  return (
    <section aria-label="合作進度" className="rounded-card border border-line bg-surface p-4 md:p-5">
      <div className="md:hidden">
        <p className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold text-ink">{COLLAB_STATUS_LABEL[status]}</span>
          <span className="text-muted">{done ? "全部完成" : `第 ${n} / ${COLLAB_STEPS.length} 步`}</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary-soft" aria-hidden="true">
          <div className="h-full rounded-full bg-primary" style={{ width: `${((done ? COLLAB_STEPS.length : n) / COLLAB_STEPS.length) * 100}%` }} />
        </div>
      </div>
      <ol className="hidden md:flex md:items-start">
        {COLLAB_STEPS.map((label, i) => {
          const s = states[i];
          const dot = s === "done"
            ? "border-line bg-primary-soft text-ink"
            : s === "current"
              ? "border-primary bg-primary text-on-ink ring-4 ring-primary-soft"
              : "border-line bg-surface text-muted";
          return (
            <li key={label} aria-current={s === "current" ? "step" : undefined} className="flex flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span aria-hidden="true" className={`h-px flex-1 ${i === 0 ? "bg-transparent" : "bg-line"}`} />
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${dot}`}>
                  {s === "done" ? <Check size={14} strokeWidth={1.5} aria-hidden="true" /> : i + 1}
                </span>
                <span aria-hidden="true" className={`h-px flex-1 ${i === COLLAB_STEPS.length - 1 ? "bg-transparent" : "bg-line"}`} />
              </div>
              <span className={`mt-2 text-xs ${s === "todo" ? "text-muted" : "font-semibold text-ink"}`}>
                {label}
                <span className="sr-only">{s === "done" ? "（已完成）" : s === "current" ? "（目前）" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
```

`src/components/collabs/FileTile.tsx`：

```tsx
import { FileText, Film } from "lucide-react";
import type { SubmissionFile } from "@/lib/collabs/load";

/** 一個交稿檔案：圖片顯示縮圖；影片與 PDF 顯示圖示與名稱。點了用 signed URL 開新分頁（有效 1 小時）。 */
export function FileTile({ f }: { f: SubmissionFile }) {
  const inner = f.kind === "image" && f.url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={f.url} alt={f.label} className="h-24 w-24 rounded-btn border border-line object-cover" />
  ) : (
    <span className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-btn border border-line bg-primary-soft text-xs text-ink">
      {f.kind === "video"
        ? <Film size={24} strokeWidth={1.5} aria-hidden="true" />
        : <FileText size={24} strokeWidth={1.5} aria-hidden="true" />}
      {f.label}
    </span>
  );
  if (!f.url) return <span title="連結產生失敗，請重新整理">{inner}</span>;
  return (
    <a href={f.url} target="_blank" rel="noopener noreferrer" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
      {inner}
      <span className="sr-only">（在新分頁開啟）</span>
    </a>
  );
}
```

`src/components/collabs/SubmissionList.tsx`：

```tsx
import type { SubmissionView } from "@/lib/collabs/load";
import { eventTime } from "@/lib/collabs/view";
import { FileTile } from "./FileTile";

/** 交稿紀錄：依輪次排列；品牌要求修改的說明顯示在對應那一輪下方。 */
export function SubmissionList({ submissions }: { submissions: SubmissionView[] }) {
  return (
    <section aria-labelledby="submissions-title">
      <h2 id="submissions-title" className="text-lg font-bold text-ink">交稿紀錄</h2>
      {submissions.length === 0 ? (
        <p className="mt-3 rounded-card border border-line bg-surface p-6 text-center text-sm text-muted">還沒有交稿</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {submissions.map((s) => (
            <li key={s.id} className="rounded-card border border-line bg-surface p-4 md:p-5">
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-ink">第 {s.round} 次交稿</span>
                <span className="text-xs text-muted">{eventTime(s.createdAt)}</span>
              </p>
              {s.files.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {s.files.map((f) => <li key={f.path}><FileTile f={f} /></li>)}
                </ul>
              )}
              {s.links.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {s.links.map((l) => (
                    <li key={l} className="min-w-0 break-all">
                      <a href={l} target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2">{l}</a>
                    </li>
                  ))}
                </ul>
              )}
              {s.note && <p className="mt-3 whitespace-pre-line break-words text-sm text-ink">{s.note}</p>}
              {s.revisionNotes.map((n, i) => (
                <div key={i} className="mt-3 rounded-btn border border-line bg-primary-soft p-3 text-sm">
                  <p className="text-xs font-semibold text-muted">品牌要求修改</p>
                  <p className="mt-1 whitespace-pre-line break-words text-ink">{n}</p>
                </div>
              ))}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

`src/components/collabs/EventList.tsx`：

```tsx
import { eventText, eventTime, type CollabEvent } from "@/lib/collabs/view";

/** 對話區：目前只列系統事件（audit log）。計畫 7 會在這裡加上訊息與輸入框。 */
export function EventList({ events }: { events: CollabEvent[] }) {
  return (
    <section aria-labelledby="events-title">
      <h2 id="events-title" className="text-lg font-bold text-ink">對話與紀錄</h2>
      <ol className="mt-3 space-y-2 rounded-card border border-line bg-surface p-4 md:p-5">
        {events.map((e) => (
          <li key={e.id} className="flex gap-3 text-sm">
            <span className="w-24 shrink-0 text-xs leading-5 text-muted">{eventTime(e.createdAt)}</span>
            <span className="min-w-0 whitespace-pre-line break-words text-ink">{eventText(e)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted">站內訊息即將推出。</p>
    </section>
  );
}
```

- [ ] **Step 3: 卡片與按鈕**

`src/components/collabs/CollabActions.tsx`（這個 task 的版本：待交稿、待發佈先不顯示按鈕，Task 9 接上）：

```tsx
"use client";

import { useState } from "react";
import { brandCollabAction } from "@/app/brand/collabs/actions";
import { creatorCollabAction } from "@/app/creator/collabs/actions";
import { ConfirmAction } from "@/components/briefs/ConfirmAction";
import type { CollabSide, CollabStatus } from "@/lib/collabs/view";
import { RevisionForm } from "./RevisionForm";
import { useCollabAction } from "./useCollabAction";

type Props = { collabId: string; status: CollabStatus; side: CollabSide; uid: string; devPaymentEnabled: boolean };

const primary = "h-11 w-full rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 sm:w-auto";

/** 「現在要做什麼」卡片裡的按鈕（依狀態與視角）。 */
export function CollabActions({ collabId, status, side, devPaymentEnabled }: Props) {
  if (side === "creator" && status === "invited") return <InviteReply collabId={collabId} />;
  if (side === "brand" && (status === "invited" || status === "awaiting_payment")) {
    return <BrandPayment collabId={collabId} status={status} devPaymentEnabled={devPaymentEnabled} />;
  }
  if (side === "creator" && status === "awaiting_payment" && devPaymentEnabled) return <DevMarkPaid collabId={collabId} />;
  if (side === "brand" && status === "in_review") return <Review collabId={collabId} />;
  return null;
}

function Feedback({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted">{notice}</p>}
    </>
  );
}

function InviteReply({ collabId }: { collabId: string }) {
  const { pending, error, notice, run } = useCollabAction();
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={pending} onClick={() => run(() => creatorCollabAction(collabId, "accept"))} className={primary}>
          {pending ? "處理中…" : "接受邀約"}
        </button>
        <ConfirmAction
          label="婉拒" danger confirmLabel="確定婉拒" message="婉拒後品牌需要重新發出邀約，確定要婉拒嗎？"
          onConfirm={() => creatorCollabAction(collabId, "decline")}
        />
      </div>
      <Feedback error={error} notice={notice} />
    </div>
  );
}

function BrandPayment({ collabId, status, devPaymentEnabled }: { collabId: string; status: "invited" | "awaiting_payment"; devPaymentEnabled: boolean }) {
  const [explain, setExplain] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        {status === "awaiting_payment" && (
          <button type="button" onClick={() => setExplain((v) => !v)} aria-expanded={explain} className={primary}>
            確認並付款
          </button>
        )}
        <ConfirmAction
          label={status === "invited" ? "撤回邀約" : "取消合作"} danger confirmLabel="確定取消"
          message="取消後這個合作案就結束了，不能復原。確定要取消嗎？"
          onConfirm={() => brandCollabAction(collabId, "cancel")}
        />
      </div>
      {explain && (
        <p role="status" className="rounded-btn border border-line bg-primary-soft p-3 text-sm text-ink">
          付款功能即將開放。目前由平台人工確認款項，確認後會自動進入交稿階段。
        </p>
      )}
      {status === "awaiting_payment" && devPaymentEnabled && <DevMarkPaid collabId={collabId} />}
    </div>
  );
}

/** 本機測試用：一般的 POST 表單，不需要 JS。只有伺服器判斷 isDevLoginEnabled() 為真時才會渲染。 */
function DevMarkPaid({ collabId }: { collabId: string }) {
  return (
    <form method="post" action="/api/dev/mark-paid">
      <input type="hidden" name="collabId" value={collabId} />
      <button className="h-10 rounded-btn border border-dashed border-line px-4 text-sm font-semibold text-muted">
        標記已付款（本機）
      </button>
    </form>
  );
}

function Review({ collabId }: { collabId: string }) {
  const { pending, error, notice, run } = useCollabAction();
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <button type="button" disabled={pending} onClick={() => run(() => brandCollabAction(collabId, "approve"))} className={primary}>
          {pending ? "處理中…" : "審核通過"}
        </button>
        <RevisionForm collabId={collabId} />
      </div>
      <Feedback error={error} notice={notice} />
    </div>
  );
}
```

`src/components/collabs/ActionCard.tsx`：

```tsx
import { actionCardCopy, reviewCountdown, type Collab, type CollabSide } from "@/lib/collabs/view";
import type { SubmissionView } from "@/lib/collabs/load";
import { CollabActions } from "./CollabActions";
import { FileTile } from "./FileTile";

type Props = {
  c: Collab;
  side: CollabSide;
  uid: string;
  latest: SubmissionView | null;
  /** 伺服器在 requireRole 之後算的 Date.now() */
  nowMs: number;
  devPaymentEnabled: boolean;
};

/** 「現在要做什麼」卡片（主色外框）：輪到自己時顯示動作；輪到對方時明確寫「你不用做任何事」。 */
export function ActionCard({ c, side, uid, latest, nowMs, devPaymentEnabled }: Props) {
  const copy = actionCardCopy(c.status, side);
  const countdown = c.status === "in_review" ? reviewCountdown(c.reviewDueAt, nowMs) : null;
  return (
    <section aria-labelledby="action-title" className={`rounded-card border-2 bg-surface p-4 md:p-5 ${copy.mine ? "border-primary" : "border-line"}`}>
      <h2 id="action-title" className="text-lg font-bold text-ink">{copy.title}</h2>
      <p className="mt-1 text-sm text-muted">{copy.body}</p>
      {c.status === "awaiting_payment" && <p className="mt-2 text-sm font-semibold text-ink">等待付款確認</p>}
      {countdown && <p className="mt-2 text-sm font-semibold text-ink">{countdown}</p>}
      {c.status === "awaiting_payout" && c.publishedUrl && (
        <p className="mt-2 min-w-0 break-all text-sm">
          貼文：<a href={c.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2">{c.publishedUrl}</a>
        </p>
      )}
      {side === "brand" && c.status === "in_review" && latest && latest.files.length > 0 && (
        <ul aria-label="最新一次交稿的檔案" className="mt-3 flex flex-wrap gap-2">
          {latest.files.map((f) => <li key={f.path}><FileTile f={f} /></li>)}
        </ul>
      )}
      <div className="mt-4">
        <CollabActions collabId={c.id} status={c.status} side={side} uid={uid} devPaymentEnabled={devPaymentEnabled} />
      </div>
    </section>
  );
}
```

`src/components/collabs/CollabDetail.tsx`：

```tsx
import type { CollabDetailData } from "@/lib/collabs/load";
import type { CollabSide } from "@/lib/collabs/view";
import { ActionCard } from "./ActionCard";
import { CollabHeader } from "./CollabHeader";
import { EventList } from "./EventList";
import { Stepper } from "./Stepper";
import { SubmissionList } from "./SubmissionList";

type Props = { data: CollabDetailData; side: CollabSide; uid: string; nowMs: number; devPaymentEnabled: boolean };

/** 合作案詳情：品牌與創作者共用，只差在視角。 */
export function CollabDetail({ data, side, uid, nowMs, devPaymentEnabled }: Props) {
  const { collab: c, submissions, events } = data;
  const latest = submissions.length > 0 ? submissions[submissions.length - 1] : null;
  return (
    <div className="space-y-6">
      <CollabHeader c={c} />
      <Stepper status={c.status} />
      <ActionCard c={c} side={side} uid={uid} latest={latest} nowMs={nowMs} devPaymentEnabled={devPaymentEnabled} />
      <SubmissionList submissions={submissions} />
      <EventList events={events} />
    </div>
  );
}
```

- [ ] **Step 4: 詳情頁**

`src/components/collabs/CollabPages.tsx` 換成完整版（列表部分不變，加上詳情）：

```tsx
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { isDevLoginEnabled } from "@/lib/auth/dev-login";
import { isUuid } from "@/lib/briefs/query";
import { loadCollabDetail, loadMyCollabs } from "@/lib/collabs/load";
import { nowMs, parseCollabTab, type CollabSide } from "@/lib/collabs/view";
import { CollabDetail } from "./CollabDetail";
import { CollabList, CollabTabs } from "./CollabList";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** 列表頁的內容（在 <Suspense> 內）：layout 的 Gate 在用戶端換頁時不會重跑，這裡自己 requireRole。 */
export async function CollabListSection({ side, searchParams }: { side: CollabSide; searchParams: SearchParams }) {
  await requireRole(side);
  const tab = parseCollabTab((await searchParams).tab);
  const items = await loadMyCollabs(tab);
  return (
    <div>
      <CollabTabs side={side} tab={tab} />
      <CollabList side={side} tab={tab} items={items} />
    </div>
  );
}

/** 詳情頁的內容（在 <Suspense> 內）。不是參與者、不是這一區的視角、id 不是 UUID：一律 notFound()（soft 404）。 */
export async function CollabDetailSection({ side, params }: { side: CollabSide; params: Promise<{ id: string }> }) {
  const me = await requireRole(side);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await loadCollabDetail(id);
  if (!data || data.collab.side !== side) notFound();
  // requireRole 之後才能讀現在時間（getCurrentUser 已 await connection()）
  return <CollabDetail data={data} side={side} uid={me.id} nowMs={nowMs()} devPaymentEnabled={isDevLoginEnabled()} />;
}

export function CollabListSkeleton() {
  return (
    <div aria-busy="true">
      <p className="sr-only">載入中…</p>
      <div className="h-9 w-64 rounded-full bg-surface" />
      <div className="mt-4 h-48 rounded-card border border-line bg-surface" />
    </div>
  );
}
```

`src/app/brand/collabs/[id]/page.tsx`：

```tsx
import { Suspense } from "react";
import Link from "next/link";
import { CollabDetailSection } from "@/components/collabs/CollabPages";

type Props = { params: Promise<{ id: string }> };

export default function BrandCollabPage({ params }: Props) {
  return (
    <div>
      <Link href="/brand/collabs" className="text-sm text-muted">← 合作案</Link>
      <div className="mt-2">
        <Suspense fallback={<p className="text-muted">載入中…</p>}>
          <CollabDetailSection side="brand" params={params} />
        </Suspense>
      </div>
    </div>
  );
}
```

`src/app/creator/collabs/[id]/page.tsx`：

```tsx
import { Suspense } from "react";
import Link from "next/link";
import { CollabDetailSection } from "@/components/collabs/CollabPages";

type Props = { params: Promise<{ id: string }> };

export default function CreatorCollabPage({ params }: Props) {
  return (
    <div>
      <Link href="/creator/collabs" className="text-sm text-muted">← 合作</Link>
      <div className="mt-2">
        <Suspense fallback={<p className="text-muted">載入中…</p>}>
          <CollabDetailSection side="creator" params={params} />
        </Suspense>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 檢查與 commit**

`Date.now()` 不能直接寫在元件裡（eslint `react-hooks/purity` 會報錯），所以用 Task 4 的 `nowMs()`，而且只在 `requireRole` 之後呼叫。

```bash
npm run lint && npm run typecheck && npm test
git add src/components/collabs "src/app/brand/collabs/[id]/page.tsx" "src/app/creator/collabs/[id]/page.tsx"
git commit -m "計畫 6 Task 8：合作案詳情頁（標題區、進度條、現在要做什麼、交稿紀錄、系統事件、取消／接受／婉拒／審核）"
```

---

### Task 9: 交稿（上傳檔案、連結、說明）與填入貼文連結

**Files:**
- Create: `src/components/collabs/SubmitPanel.tsx`、`src/components/collabs/PublishForm.tsx`
- Modify: `src/components/collabs/CollabActions.tsx`

**Interfaces:**
- Consumes: Task 4 的 `planDeliverableUpload`、`DELIVERABLE_ACCEPT`、`DELIVERABLES_BUCKET`、`MAX_DELIVERABLE_FILES`、`fileKindOf`、`parseLinks`、`validateSubmission`、`isValidPostUrl`、`NOTE_MAX`；Task 5 的 `submitDeliverablesAction`、`publishCollabAction`；Task 8 的 `useCollabAction`；`createClient`（`src/lib/supabase/client.ts`）。
- Produces：`SubmitPanel({ collabId, uid })`、`PublishForm({ collabId })`。

- [ ] **Step 1: 交稿面板 `src/components/collabs/SubmitPanel.tsx`**

選檔就直接上傳（瀏覽器、創作者自己的 client、`upsert: false`）；送出前移除的檔案立即刪除；說明與連結受控；送出時前端先 `validateSubmission`，伺服器回的欄位錯誤也顯示在對應欄位；上傳中與送出中按鈕停用。

```tsx
"use client";

import { useId, useState } from "react";
import { FileText, Film, ImageIcon, X } from "lucide-react";
import { submitDeliverablesAction } from "@/app/creator/collabs/actions";
import { createClient } from "@/lib/supabase/client";
import {
  DELIVERABLE_ACCEPT, DELIVERABLES_BUCKET, fileKindOf, MAX_DELIVERABLE_FILES, planDeliverableUpload,
} from "@/lib/deliverables";
import { textLength } from "@/lib/validation/brief";
import { NOTE_MAX, parseLinks, validateSubmission } from "@/lib/validation/collab";
import { useCollabAction } from "./useCollabAction";

type Uploaded = { path: string; name: string };

/**
 * 交稿：選檔就直接上傳到 deliverables/<合作案>/<自己>/<uuid>.<副檔名>（瀏覽器、創作者自己的 client）；
 * 送出前移除的檔案立即刪除（還沒交出的檔案 policy 允許刪）。送出時呼叫 submitDeliverablesAction。
 */
export function SubmitPanel({ collabId, uid }: { collabId: string; uid: string }) {
  const [files, setFiles] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [links, setLinks] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { pending, error, notice, run } = useCollabAction();
  const noteId = useId();
  const linksId = useId();
  const busy = uploading || pending;

  async function onPick(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploadMsg(null);
    const picked = Array.from(list);
    if (files.length + picked.length > MAX_DELIVERABLE_FILES) {
      return setUploadMsg(`一次最多 ${MAX_DELIVERABLE_FILES} 個檔案`);
    }
    setUploading(true);
    const storage = createClient().storage.from(DELIVERABLES_BUCKET);
    try {
      for (const file of picked) {
        const plan = planDeliverableUpload(collabId, uid, file, crypto.randomUUID());
        if ("error" in plan) {
          setUploadMsg(`${file.name}：${plan.error}`);
          continue;
        }
        const { error: e } = await storage.upload(plan.path, file, { contentType: file.type, upsert: false });
        if (e) {
          setUploadMsg(`${file.name}：上傳失敗，請再試一次`);
          continue;
        }
        setFiles((cur) => [...cur, { path: plan.path, name: file.name }]);
      }
    } finally {
      setUploading(false);
    }
  }

  function removeFile(path: string) {
    setFiles((cur) => cur.filter((f) => f.path !== path));
    void Promise.resolve(createClient().storage.from(DELIVERABLES_BUCKET).remove([path])).catch(() => {});
  }

  function submit() {
    const input = { note: note.trim(), links: parseLinks(links), filePaths: files.map((f) => f.path) };
    const fe = validateSubmission(input, collabId, uid);
    setFieldErrors(fe ?? {});
    if (fe) return;
    run(async () => {
      const res = await submitDeliverablesAction(collabId, input);
      if (!res.ok && res.fieldErrors) setFieldErrors(res.fieldErrors);
      return res.ok ? res : { ok: false, error: res.error };
    });
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <p className="text-sm font-semibold text-ink">作品檔案</p>
        <p className="text-xs text-muted">JPG、PNG、WebP、MP4、MOV、PDF，每個 50MB 以內，最多 {MAX_DELIVERABLE_FILES} 個</p>
        <input
          type="file" multiple accept={DELIVERABLE_ACCEPT} disabled={busy || files.length >= MAX_DELIVERABLE_FILES}
          aria-label="上傳作品檔案" className="mt-2 w-full min-w-0 text-sm"
          onChange={(e) => { void onPick(e.target.files); e.target.value = ""; }}
        />
        {uploading && <p role="status" className="mt-1 text-sm text-muted">上傳中…</p>}
        {uploadMsg && <p role="alert" className="mt-1 text-sm text-danger">{uploadMsg}</p>}
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f) => {
              const kind = fileKindOf(f.path);
              const Icon = kind === "video" ? Film : kind === "pdf" ? FileText : ImageIcon;
              return (
                <li key={f.path} className="flex items-center gap-2 rounded-btn border border-line px-3 py-2 text-sm">
                  <Icon size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
                  <button type="button" onClick={() => removeFile(f.path)} disabled={busy} aria-label={`移除 ${f.name}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn text-muted disabled:opacity-60">
                    <X size={16} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {fieldErrors.files && <p className="mt-1 text-sm text-danger">{fieldErrors.files}</p>}
      </div>
      <div>
        <label htmlFor={linksId} className="text-sm font-semibold text-ink">連結（選填，一行一個，最多 5 個）</label>
        <textarea id={linksId} rows={2} value={links} onChange={(e) => setLinks(e.target.value)} disabled={pending}
          placeholder="https://drive.google.com/..."
          className="mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ink" />
        {fieldErrors.links && <p className="mt-1 text-sm text-danger">{fieldErrors.links}</p>}
      </div>
      <div>
        <label htmlFor={noteId} className="text-sm font-semibold text-ink">說明（選填）</label>
        <textarea id={noteId} rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending}
          className="mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ink" />
        <p className={`text-right text-xs ${textLength(note) > NOTE_MAX ? "font-semibold text-danger" : "text-muted"}`}>
          {textLength(note)}/{NOTE_MAX}
        </p>
        {fieldErrors.note && <p className="text-sm text-danger">{fieldErrors.note}</p>}
      </div>
      <button type="button" onClick={submit} disabled={busy}
        className="h-11 w-full rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 sm:w-auto">
        {pending ? "送出中…" : uploading ? "等待上傳完成…" : "交稿"}
      </button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted">{notice}</p>}
    </div>
  );
}
```

- [ ] **Step 2: 貼文連結 `src/components/collabs/PublishForm.tsx`**

```tsx
"use client";

import { useId, useState } from "react";
import { publishCollabAction } from "@/app/creator/collabs/actions";
import { isValidPostUrl } from "@/lib/validation/collab";
import { inputClass } from "@/components/forms/Field";
import { useCollabAction } from "./useCollabAction";

/** 填入貼文連結：前端先用 new URL() 檢查（擋 a..b.com 這類），伺服器與資料庫再各擋一次。 */
export function PublishForm({ collabId }: { collabId: string }) {
  const [url, setUrl] = useState("");
  const { pending, error, notice, run, setError } = useCollabAction();
  const id = useId();
  return (
    <form
      noValidate className="w-full space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const v = url.trim();
        if (!isValidPostUrl(v)) return setError("請貼上完整的貼文網址（https:// 開頭、含路徑）");
        run(() => publishCollabAction(collabId, v));
      }}
    >
      <label htmlFor={id} className="text-sm font-semibold text-ink">貼文連結</label>
      <input
        id={id} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={pending}
        placeholder="https://www.instagram.com/p/..." aria-invalid={error ? true : undefined} className={inputClass}
      />
      <button disabled={pending} className="h-11 w-full rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 sm:w-auto">
        {pending ? "送出中…" : "送出貼文連結"}
      </button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted">{notice}</p>}
    </form>
  );
}
```

- [ ] **Step 3: 接上 `CollabActions.tsx`**

import 區加：

```tsx
import { PublishForm } from "./PublishForm";
import { SubmitPanel } from "./SubmitPanel";
```

函式簽名改回使用 `uid`：

```tsx
export function CollabActions({ collabId, status, side, uid, devPaymentEnabled }: Props) {
```

在 `if (side === "brand" && status === "in_review") return <Review collabId={collabId} />;` 的前一行加：

```tsx
  if (side === "creator" && status === "awaiting_submission") return <SubmitPanel collabId={collabId} uid={uid} />;
```

後一行加：

```tsx
  if (side === "creator" && status === "awaiting_publish") return <PublishForm collabId={collabId} />;
```

- [ ] **Step 4: 檢查與 commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/components/collabs/SubmitPanel.tsx src/components/collabs/PublishForm.tsx src/components/collabs/CollabActions.tsx
git commit -m "計畫 6 Task 9：交稿（上傳到私密 bucket、連結、說明）與填入貼文連結"
```

---

### Task 10: 錄取表單（招募詳情）與邀請表單（創作者公開頁）

**Files:**
- Create: `src/components/collabs/OfferForm.tsx`、`src/components/collabs/InvitePanel.tsx`
- Modify: `src/components/briefs/ApplicantList.tsx`、`src/app/brand/briefs/[id]/page.tsx`、`src/app/c/[handle]/ProfileView.tsx`

**Interfaces:**
- Consumes: Task 4 的 `validateOffer`、`parseAmount`、`acceptDefaults`、`TITLE_MAX`、`DELIVERABLES_MAX`；Task 5 的 `acceptApplicationAction`、`rejectApplicationAction`、`inviteCreatorAction`、`Applicant.collaborationId`；既有 `Field`、`inputClass`、`textLength`。
- Produces：`OfferForm({ action, hidden, withTitle, defaults, submitLabel, onCancel })`、`OfferState`、`InvitePanel({ creatorId, creatorName })`、`ApplicantList({ briefId, brief: OfferBrief, applicants })`、`OfferBrief`。

- [ ] **Step 1: 合作條件表單 `src/components/collabs/OfferForm.tsx`**

（直接邀請與錄取共用；欄位受控；前端先驗證；`stale` 時 `router.refresh()`。）

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, inputClass } from "@/components/forms/Field";
import { textLength } from "@/lib/validation/brief";
import { DELIVERABLES_MAX, parseAmount, TITLE_MAX, validateOffer } from "@/lib/validation/collab";

export type OfferState = { fieldErrors?: Record<string, string>; formError?: string; stale?: boolean };

type Props = {
  action: (prev: OfferState, fd: FormData) => Promise<OfferState>;
  /** 隱藏欄位（creatorId，或 applicationId + briefId） */
  hidden: Record<string, string>;
  /** 直接邀請要填案名；錄取時案名 = 招募名稱 */
  withTitle: boolean;
  defaults: { title?: string; amount: string; deliverables: string };
  submitLabel: string;
  onCancel: () => void;
};

/** 合作條件表單（直接邀請與錄取共用）。欄位全部受控：伺服器回錯誤時不會被 React 重設。 */
export function OfferForm({ action, hidden, withTitle, defaults, submitLabel, onCancel }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<OfferState, FormData>(action, {});
  const [title, setTitle] = useState(defaults.title ?? "");
  const [amount, setAmount] = useState(defaults.amount);
  const [deliverables, setDeliverables] = useState(defaults.deliverables);
  const [clientErrors, setClientErrors] = useState<Record<string, string> | null>(null);
  const fe = clientErrors ?? state.fieldErrors ?? {};

  useEffect(() => {
    // 已被處理過（連點或另一個分頁）：重新整理，畫面會顯示最新狀態
    if (state.stale) router.refresh();
  }, [state, router]);

  const count = textLength(deliverables);
  const amountPreview = parseAmount(amount);
  return (
    <form
      action={formAction} noValidate className="space-y-3"
      onSubmit={(e) => {
        const errs = validateOffer({ title: title.trim(), deliverables: deliverables.trim(), amount }, withTitle);
        setClientErrors(errs);
        if (errs) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {withTitle && (
        <Field label="案名" error={fe.title} hint={`${TITLE_MAX} 字以內`}>
          {(c) => <input {...c} name="title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />}
        </Field>
      )}
      <Field label="交付內容" error={fe.deliverables} hint="例如：IG 貼文 1 篇 + 限時動態 2 則">
        {(c) => (
          <textarea {...c} name="deliverables" rows={4} value={deliverables} onChange={(e) => setDeliverables(e.target.value)}
            className="w-full rounded-input border border-line bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ink" />
        )}
      </Field>
      <p aria-live="polite" className={`-mt-2 text-right text-xs ${count > DELIVERABLES_MAX ? "font-semibold text-danger" : "text-muted"}`}>
        {count}/{DELIVERABLES_MAX}
      </p>
      <Field label="金額（NT$）" error={fe.amount} hint={amountPreview ? `NT$${amountPreview.toLocaleString("en-US")}` : "1 到 10,000,000 的整數"}>
        {(c) => <input {...c} name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />}
      </Field>
      {state.formError && <p role="alert" className="text-sm text-danger">{state.formError}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="h-11 flex-1 rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 sm:flex-none">
          {pending ? "送出中…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={pending}
          className="h-11 shrink-0 rounded-btn border border-line px-4 font-semibold text-ink disabled:opacity-60">
          取消
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: 邀請面板 `src/components/collabs/InvitePanel.tsx`**

（「邀請合作」與表單用不同的 `key`，避免 React 重用同一個按鈕。）

```tsx
"use client";

import { useState } from "react";
import { inviteCreatorAction } from "@/app/brand/collabs/actions";
import { OfferForm } from "./OfferForm";

/**
 * 公開頁的「邀請合作」（品牌）：按下後在頁面內展開表單（案名、交付內容、金額）。
 * 手機固定在底部、可捲動；桌面在右欄上方 sticky。
 */
export function InvitePanel({ creatorId, creatorName }: { creatorId: string; creatorName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 max-h-[80vh] overflow-y-auto border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:sticky md:inset-x-auto md:bottom-auto md:top-4 md:max-h-none md:overflow-visible md:rounded-card md:border md:p-5">
      {!open ? (
        <button key="open" type="button" onClick={() => setOpen(true)}
          className="flex h-11 w-full items-center justify-center rounded-btn bg-ink font-semibold text-on-ink">
          邀請合作
        </button>
      ) : (
        <div key="form">
          <p className="mb-3 font-semibold text-ink">邀請 {creatorName} 合作</p>
          <OfferForm
            action={inviteCreatorAction} hidden={{ creatorId }} withTitle
            defaults={{ title: "", amount: "", deliverables: "" }} submitLabel="送出邀約" onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 報名者列表：錄取打開表單、已錄取連到合作案**

`src/components/briefs/ApplicantList.tsx` 整個換成：

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { acceptApplicationAction, rejectApplicationAction } from "@/app/brand/briefs/actions";
import { OfferForm } from "@/components/collabs/OfferForm";
import { Avatar } from "@/components/square/Avatar";
import { acceptDefaults } from "@/lib/validation/collab";
import { isStaleStateMessage } from "@/lib/briefs/errors";
import { APPLICANT_FILTERS, filterApplicants, proposedPriceLabel, type Applicant, type ApplicantFilter } from "@/lib/briefs/view";
import { formatDateTimeTw } from "@/lib/briefs/dates";
import { formatNumber, formatPercent } from "@/lib/format";
import { ApplicationStatusBadge } from "./StatusBadges";

/** 錄取表單預設值需要的招募資料。 */
export type OfferBrief = { budgetMin: number | null; budgetMax: number | null; collabTypes: string[]; description: string };

/** 報名者列表與篩選（全部、待處理、已錄取、已婉拒）。篩選只在畫面上，不寫進網址。 */
export function ApplicantList({ briefId, brief, applicants }: { briefId: string; brief: OfferBrief; applicants: Applicant[] }) {
  const [filter, setFilter] = useState<ApplicantFilter>("all");
  const shown = filterApplicants(applicants, filter);
  return (
    <div>
      <div role="group" aria-label="篩選報名者" className="flex flex-wrap gap-2">
        {APPLICANT_FILTERS.map((f) => (
          <button
            key={f.value} type="button" onClick={() => setFilter(f.value)} aria-pressed={filter === f.value}
            className={`h-9 rounded-full border px-4 text-sm font-semibold ${filter === f.value ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-ink"}`}
          >
            {f.label} {filterApplicants(applicants, f.value).length}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-4 rounded-card border border-line bg-surface p-6 text-center text-sm text-muted">沒有符合的報名者</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((a) => <li key={a.id}><ApplicantItem a={a} briefId={briefId} brief={brief} /></li>)}
        </ul>
      )}
    </div>
  );
}

function ApplicantItem({ a, briefId, brief }: { a: Applicant; briefId: string; brief: OfferBrief }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [pending, startTransition] = useTransition();

  function reject() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await rejectApplicationAction(a.id, briefId);
        if (!res.ok) {
          if (isStaleStateMessage(res.error)) {
            // 連點或另一個分頁已處理：重新整理即可
            setNotice("這筆報名的狀態已更新，已為你重新整理");
            router.refresh();
          } else {
            setError(res.error);
          }
        }
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }

  return (
    <article className="rounded-card border border-line bg-surface p-4 md:p-5">
      <div className="flex items-start gap-3">
        <Avatar path={a.avatarPath} name={a.displayName} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/c/${a.handle}`} className="min-w-0 break-words font-bold text-ink underline-offset-2 hover:underline">
              {a.displayName}
            </Link>
            <ApplicationStatusBadge status={a.status} viewer="brand" />
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
            <span>粉絲 {formatNumber(a.followerCount)}</span>
            <span>互動率 {formatPercent(a.engagementRate)}</span>
            {a.region && <span className="inline-flex items-center gap-0.5"><MapPin size={12} strokeWidth={1.5} aria-hidden="true" />{a.region}</span>}
            <span>報名於 {formatDateTimeTw(a.createdAt)}</span>
          </p>
        </div>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted">提出的報價</dt>
          <dd className="font-semibold text-ink">{proposedPriceLabel(a.proposedPrice)}</dd>
        </div>
        {a.message && (
          <div>
            <dt className="text-xs text-muted">給品牌的話</dt>
            <dd className="whitespace-pre-line break-words text-ink">{a.message}</dd>
          </div>
        )}
      </dl>
      {a.status === "applied" && !accepting && (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setAccepting(true)} disabled={pending}
            className="h-10 flex-1 rounded-btn bg-ink px-4 text-sm font-semibold text-on-ink disabled:opacity-60 sm:flex-none">
            錄取
          </button>
          <button type="button" onClick={reject} disabled={pending}
            className="h-10 flex-1 rounded-btn border border-line bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-60 sm:flex-none">
            {pending ? "處理中…" : "婉拒"}
          </button>
        </div>
      )}
      {a.status === "applied" && accepting && (
        <div className="mt-4 rounded-card border border-line bg-bg p-4">
          <p className="mb-3 text-sm font-semibold text-ink">錄取 {a.displayName}：設定合作條件</p>
          <OfferForm
            action={acceptApplicationAction} hidden={{ applicationId: a.id, briefId }} withTitle={false}
            defaults={acceptDefaults(a.proposedPrice, brief)} submitLabel="錄取並建立合作案"
            onCancel={() => setAccepting(false)}
          />
        </div>
      )}
      {a.collaborationId && (
        <Link href={`/brand/collabs/${a.collaborationId}`} className="mt-3 inline-block text-sm font-semibold text-ink underline underline-offset-2">
          查看合作案 →
        </Link>
      )}
      {notice && <p role="status" className="mt-2 text-sm text-muted">{notice}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </article>
  );
}
```

`src/app/brand/briefs/[id]/page.tsx`：`<ApplicantList briefId={brief.id} applicants={applicants} />` 換成：

```tsx
            <ApplicantList
              briefId={brief.id}
              brief={{ budgetMin: brief.budgetMin, budgetMax: brief.budgetMax, collabTypes: brief.collabTypes, description: brief.description }}
              applicants={applicants}
            />
```

- [ ] **Step 4: 公開頁的「邀請合作」**

`src/app/c/[handle]/ProfileView.tsx`：
1. import 區加 `import { InvitePanel } from "@/components/collabs/InvitePanel";`（放在 `FavoriteButton` 那行之前）。
2. `<Invite viewer={viewer} />` 換成 `<Invite viewer={viewer} creatorId={c.userId} creatorName={c.displayName} />`。
3. `Invite` 函式開頭（註解到 `const button = …;` 為止）換成下面這段，後面的 `return (<> … </>)` 不變：

```tsx
/** 邀請合作：訪客 → 註冊品牌；品牌 → 頁面內的邀請表單（計畫 6）；創作者（含本人）→ 不顯示。 */
function Invite({ viewer, creatorId, creatorName }: { viewer: ViewerKind; creatorId: string; creatorName: string }) {
  if (viewer === "creator") return null;
  if (viewer === "brand") return <InvitePanel creatorId={creatorId} creatorName={creatorName} />;
  const button = <Link href="/signup?role=brand" className="flex h-11 w-full items-center justify-center rounded-btn bg-ink font-semibold text-on-ink">邀請合作</Link>;
```

（公開頁只列已審核的創作者；資料庫的 `invite_creator` 再擋一次未審核。）

- [ ] **Step 5: 檢查與 commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/components/collabs/OfferForm.tsx src/components/collabs/InvitePanel.tsx src/components/briefs/ApplicantList.tsx \
  "src/app/brand/briefs/[id]/page.tsx" "src/app/c/[handle]/ProfileView.tsx"
git commit -m "計畫 6 Task 10：招募錄取時設定金額與交付內容、創作者公開頁直接邀請"
```

---

### Task 11: 文件同步（README、followups）與本機端對端驗收

**Files:**
- Modify: `README.md`、`docs/superpowers/plans/2026-11-22-foundation-followups.md`

**Interfaces:**
- Consumes: Task 1–10 的全部成果。
- Produces: README 的管理員 SQL（標記已付款、撥款）、`deliverables` bucket 與 `CRON_SECRET` 說明、部署順序；followups 的決定、完成標記與新的後續事項；E2E 截圖（存在本機暫存資料夾，不 commit）。

- [ ] **Step 1: README**

1. 在「## 審核創作者（管理後台完成前）」整節（含「### 修改已鎖定的網址代稱（handle）」）**之後**、「## 正式環境（Hosted Supabase）設定」之前，加上新的一節：

````markdown
## 合作案的付款與撥款（金流與管理後台完成前）

計畫 8（綠界金流）與計畫 9（管理後台）完成前，**整個流程不會真的收錢**：品牌按「確認並付款」只會看到說明，由管理員在 Supabase Studio 的 SQL Editor 標記。案號 = 合作案 id 的前 8 碼，顯示在合作案詳情的標題區。

兩段 SQL 都要**整段一起執行**（`begin` 到 `commit`），只改 `填入案號` 這一個地方（例如 `1a2b3c4d`），直接複製、不要手打。案號格式不對或找不到剛好一個合作案時會報錯，整段不會生效。

**標記已付款**（`awaiting_payment` → `awaiting_submission`）。和綠界上線後走同一條路：先建付款單，再呼叫 `record_payment_success`（不要直接改狀態，資料庫也不允許）：
```sql
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('kollink.case_code', lower('填入案號'), true);
do $$
declare
  v_code text := current_setting('kollink.case_code');
  v_n integer;
begin
  if v_code !~ '^[0-9a-f]{8}$' then
    raise exception '案號格式不對：%', v_code;
  end if;
  select count(*) into v_n from public.collaborations c where c.id::text like v_code || '%';
  if v_n <> 1 then
    raise exception '案號 % 找到 % 個合作案，請確認', v_code, v_n;
  end if;
end;
$$;
insert into public.payments (collaboration_id, provider, merchant_trade_no, amount_twd)
select c.id, 'ecpay', 'MAN' || upper(left(md5(random()::text), 17)), c.amount_twd
  from public.collaborations c
 where c.id::text like current_setting('kollink.case_code') || '%' and c.status = 'awaiting_payment';
select p.merchant_trade_no,
       public.record_payment_success(p.merchant_trade_no, p.amount_twd, 'MANUAL-' || p.merchant_trade_no,
                                     '{"source":"manual"}'::jsonb) as result
  from public.payments p
  join public.collaborations c on c.id = p.collaboration_id
 where c.id::text like current_setting('kollink.case_code') || '%' and p.status = 'pending';
select c.status from public.collaborations c where c.id::text like current_setting('kollink.case_code') || '%';
commit;
```
`result` 是 `paid`、最後的 `status` 是 `awaiting_submission` 就完成了。沒有任何列：合作案已經不是「等待付款」。

**撥款**（`awaiting_payout` → `completed`）：
```sql
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('kollink.case_code', lower('填入案號'), true);
do $$
declare
  v_code text := current_setting('kollink.case_code');
  v_n integer;
begin
  if v_code !~ '^[0-9a-f]{8}$' then
    raise exception '案號格式不對：%', v_code;
  end if;
  select count(*) into v_n from public.collaborations c where c.id::text like v_code || '%';
  if v_n <> 1 then
    raise exception '案號 % 找到 % 個合作案，請確認', v_code, v_n;
  end if;
end;
$$;
select c.id, public.transition_collaboration(c.id, 'payout', '人工撥款') as result
  from public.collaborations c
 where c.id::text like current_setting('kollink.case_code') || '%' and c.status = 'awaiting_payout';
commit;
```
`result` 是 `completed` 就結案了（實際轉帳在平台外處理）。

本機開發另有「標記已付款（本機）」按鈕（開關與測試快速登入相同，正式環境不會出現、`/api/dev/mark-paid` 回 404），走的也是同一條路。
````

2. 在「招募封面的 Storage bucket `brief-covers` …」那段**之後**加：

```markdown
交稿檔案的 Storage bucket `deliverables` 由 migration `20261125000200_deliverables.sql` 建立（**私密**、每個檔案 50 MB、只接受 JPG／PNG／WebP／MP4／MOV／PDF；只有該合作案的品牌、創作者與管理員讀得到，畫面用 1 小時的 signed URL），同樣隨 `db push --remote` 一起建好。Supabase 專案的全域檔案上限（Storage → Settings）必須至少 50 MB，否則大檔案會被擋。
```

3. 「**部署順序：先推資料庫，再合併 PR。**」那段，在括號列出的 migration 後面加上計畫 6 的 `20261125000100_collab_create.sql`、`20261125000200_deliverables.sql`、`20261125000300_collab_reads.sql`，並在該段最後加一句：`計畫 6 起還要在合併前把 CRON_SECRET 加到 Vercel（見「部署（Vercel）」）。`

4. 第 9 項（排程清理）的 bucket 清單加上：`deliverables`（沒被任何 `collaboration_submissions.file_paths` 引用的，例如上傳後沒有交稿）。

5. 「## 部署（Vercel）」的環境變數清單加一行 `CRON_SECRET`，清單下面加：

```markdown
`CRON_SECRET`：審核逾期自動通過的 Vercel Cron（`vercel.json`：每天 UTC 01:00 = 台灣 09:00 呼叫 `/api/cron/auto-approve`）。值用一串夠長的亂數（例如 `openssl rand -hex 32` 的結果），加到 **Production** 環境。Vercel 會自動在 cron 請求帶 `Authorization: Bearer <CRON_SECRET>`；沒設定時 route 一律回 500，不會自動通過任何合作案。Hobby 方案的 Cron 一天只跑一次、而且可能在該小時內任何時間觸發，所以實際是「審核期限到了之後最晚隔天自動通過」。本機在 `.env.local` 隨便設一個值即可，手動測試：
```

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/auto-approve
```

- [ ] **Step 2: followups**

`docs/superpowers/plans/2026-11-22-foundation-followups.md`：

「## 執行中做出的決定」表格把「錄取」那一列換成下面第一列，並在表格最後加其餘各列：

```markdown
| 錄取 | 計畫 6 起錄取 = 建立合作案：`accept_application_with_collab` 在同一個 transaction 把報名改成 accepted、取得或建立對話、建立合作案（`awaiting_payment`，案名 = 招募名稱）。`decide_application` 只剩婉拒。錄取或婉拒後不能改；撤回後不能再報名同一則。 |
| 建立合作案只走函式 | `collaborations`、`conversations` 收回所有 API 角色的寫入（只剩 SELECT）；建立只能經由 `accept_application_with_collab`、`invite_creator`。同一對品牌／創作者只有一個對話（取得或建立並鎖住），同一個品牌對同一位創作者同時只能有一個 invited。 |
| 合作案讀取 | 列表 `list_my_collaborations`（只列自己參與的）、詳情 `get_collaboration` 與事件 `list_collaboration_events`（參與者與管理員）是 definer 函式；交稿紀錄用 RLS 直接讀。頁面另外要求視角等於該區。 |
| 交稿 | 私密 bucket `deliverables`（50 MB、圖片／影片／PDF），路徑 `<合作案>/<創作者>/<uuid>.<副檔名>`；只有創作者在 awaiting_submission 能上傳到自己的資料夾；交出去的檔案不能刪、不能換。交稿紀錄只能經由 `submit_deliverables`（同時推進到 in_review）。原始檔名不保存。 |
| 付款與撥款（計畫 8、9 前） | 不收錢。管理員用 README 的 SQL 標記：已付款一律「service_role 建付款單 → `record_payment_success`」；撥款以 service_role 呼叫 `transition_collaboration(..., 'payout')`。本機另有 `/api/dev/mark-paid`（開關同測試快速登入）。 |
| 審核逾期自動通過 | Vercel Cron（`vercel.json`，每天 UTC 01:00）→ `/api/cron/auto-approve`（`CRON_SECRET`、常數時間比對）→ service_role 呼叫只授權給 service_role 的 `auto_approve_due()`；一件失敗不影響其他件。用 `vercel.json` 而不是 `vercel.ts`（後者要新增 `@vercel/config` 套件）。 |
```

「### 4. 創作者廣場、5. 招募與機會頁」：索引那一行的「還沒做：`conversations(creator_id)`、`collaborations(conversation_id)`、`collaborations(brief_id)`（計畫 6、7）。」改成「`conversations(creator_id)`、`collaborations(conversation_id)`、`collaborations(brief_id, creator_id)`（唯一）→ 已完成（計畫 6）。」；「錄取時在同一個 transaction 建立對話和合作案 → 計畫 6、7 接上 `decide_application`。」改成「→ 已完成（計畫 6：`accept_application_with_collab`）。」；「計畫 5 新增的後續事項」裡「錄取後建立對話、合作案在計畫 6、7」改成「錄取後建立對話、合作案 → 已完成（計畫 6）」。

「### 6. 合作案詳情頁」兩項後面各加「→ 已完成（計畫 6）」，並在該節最後加：

```markdown
- 計畫 6 新增的後續事項：
  - `deliverables` 孤兒物件（上傳後沒有交稿、離開頁面）與其他 bucket 共用同一個清理排程（尚未實作）。
  - 交稿檔案不保存原始檔名，畫面顯示「圖片 1」「PDF 2」；需要原始檔名時另外存一欄。
  - 上傳只檢查 MIME type 與大小（bucket 也擋一次），沒有檢查 magic bytes；檔案只給雙方看、用 signed URL 開新分頁。
  - signed URL 在頁面渲染時產生、有效 1 小時；頁面開超過 1 小時後點檔案要重新整理。
  - 列表最多 200 筆、沒有分頁；管理員的全部合作案列表在計畫 9。
  - 沒有任何通知（spec 不在範圍內）；對方動作後要重新整理才看得到（即時更新在計畫 7）。
  - Hobby 方案的 Cron 一天一次，實際是「到期後最晚隔天自動通過」；升級 Pro 後可改成每小時。
  - 錄取時案名固定是招募名稱（表單沒有案名欄）；修改金額、爭議處理、評價都不在範圍內。
  - `auto_approve_due` 的失敗只寫 Postgres warning 與 Vercel log，沒有告警。
```

「### 8. 付款建單與撥款」最後加：`- 「確認並付款」按鈕目前只顯示說明；接綠界時改成建單（create_payment_order）並導向付款頁。README 的人工標記 SQL 在金流上線後移除。`

「### 10. 審核逾期自動通過」最後加：`→ 已完成（計畫 6：Vercel Cron + auto_approve_due）。`

- [ ] **Step 3: Commit 文件**

```bash
git add README.md docs/superpowers/plans/2026-11-22-foundation-followups.md
git commit -m "計畫 6 Task 11：README（付款與撥款 SQL、deliverables、CRON_SECRET、部署順序）與待辦同步"
```

- [ ] **Step 4: 全部檢查與 build（server 都還沒啟動）**

先確認沒有其他 `next build`／`next dev`／`next start` 在跑（`lsof -iTCP:3000 -sTCP:LISTEN` 沒有輸出，也沒有其他 agent 正在 build）。

```bash
npm run lint && npm run typecheck && npm test && npm run build && npx supabase test db
```
Expected: 全部通過；build 沒有 `Uncached data was accessed outside of <Suspense>`、`new Date()`／`Date.now()` 相關錯誤；route 清單有 `ƒ /api/cron/auto-approve`、`ƒ /api/dev/mark-paid`。

- [ ] **Step 5: 本機種子資料（只用本機 Supabase）**

測試快速登入的帳號：品牌 `dev-brand@kollink.test`、創作者 `dev-creator@kollink.test`（handle `devcreator`）。先在 `http://localhost:3000/login` 各按一次「測試品牌」「測試創作者」，讓帳號存在。種子 id 前綴 `00000000-0000-0000-0000-0000e2e6`，最後一起清掉。

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 <<'SQL'
-- 另一位已審核創作者（直接邀請、接受後被取消）與第三方品牌（看不到別人的合作案）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000e2e60011', 'p6-other-creator@test.local'),
  ('00000000-0000-0000-0000-0000e2e60021', 'p6-third-brand@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000e2e60011', 'creator', 'E2E 小涵'),
  ('00000000-0000-0000-0000-0000e2e60021', 'brand', 'E2E 第三方品牌');
insert into public.creator_profiles (user_id, handle, ig_username, follower_count, status) values
  ('00000000-0000-0000-0000-0000e2e60011', 'p6han', 'p6han', 5000, 'approved');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000e2e60021', 'E2E 第三方品牌');
-- 測試品牌的招募，測試創作者已報名（報價 6000）
with b as (
  insert into public.briefs (brand_id, title, description, collab_types, budget_min_twd, budget_max_twd, deadline, status, published_at)
  select u.id, 'E2E 冬季保養開箱', '開箱冬季保養新品，強調保濕。', array['IG 貼文', '限時動態'], 3000, 8000,
         public.today_tw() + 14, 'open', now()
    from auth.users u where u.email = 'dev-brand@kollink.test'
  returning id
)
insert into public.brief_applications (brief_id, creator_id, message, proposed_price_twd)
select b.id, u.id, '很喜歡這個系列', 6000 from b, auth.users u where u.email = 'dev-creator@kollink.test';
-- 第三方品牌與小涵之間的合作案（測試創作者與測試品牌都不是參與者），審核已逾期
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-0000e2e60c01', '00000000-0000-0000-0000-0000e2e60021', '00000000-0000-0000-0000-0000e2e60011');
insert into public.collaborations (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status, review_due_at) values
  ('00000000-0000-0000-0000-0000e2e60cc1', '00000000-0000-0000-0000-0000e2e60021', '00000000-0000-0000-0000-0000e2e60011',
   '00000000-0000-0000-0000-0000e2e60c01', 'E2E 別人的合作案', 'IG 貼文', 2000, 'in_review', now() - interval '1 hour');
-- 給 README「標記已付款」SQL 用的待付款合作案
insert into public.collaborations (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status) values
  ('e2e6a0c2-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000e2e60021', '00000000-0000-0000-0000-0000e2e60011',
   '00000000-0000-0000-0000-0000e2e60c01', 'E2E 人工標記付款', 'IG 貼文', 2500, 'awaiting_payment');
SQL
```
Expected：`INSERT 0 2`、`INSERT 0 2`、`INSERT 0 1`、`INSERT 0 1`、`INSERT 0 1`、`INSERT 0 1`、`INSERT 0 1`、`INSERT 0 1`。這一筆的案號是 `e2e6a0c2`（id 刻意以它開頭，方便測試 README 的 SQL）。

另外在 storage 放一個「別人的」檔案（第 9 步要確認拿不到它的 signed URL）：

```bash
set -a; source .env.local; set +a
E2E=$(mktemp -d)/kollink-p6-e2e && mkdir -p "$E2E" && echo "$E2E"
sips -s format jpeg -Z 800 /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns --out "$E2E/work.jpg" >/dev/null
printf '%%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%%%EOF\n' > "$E2E/brief.pdf"
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/deliverables/00000000-0000-0000-0000-0000e2e60cc1/00000000-0000-0000-0000-0000e2e60011/99999999-9999-4999-8999-999999999999.jpg" \
  -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY" -H "Content-Type: image/jpeg" --data-binary @"$E2E/work.jpg"
```
截圖也存在 `$E2E`。

- [ ] **Step 6: 啟動 dev server（唯一的一個）**

```bash
npm run dev -- -p 3000
```
背景執行、記下 PID。瀏覽器一律用 **`http://localhost:3000`**（不要用 `127.0.0.1`：`allowedDevOrigins`）。這期間不要執行 `npm run build`。若 `next dev` 改了 `AGENTS.md`，照 `AGENTS.md` 的說明一起 commit。

瀏覽器自動化用 playwright-core（安裝在 scratchpad，不加進專案）：`cd <scratchpad> && npm init -y && npm i playwright-core`，用系統的 Chrome（`chromium.launch({ channel: "chrome", headless: true })`）。品牌與創作者用兩個獨立的 browser context。登入：`page.goto("http://localhost:3000/login")` 後按「測試品牌」／「測試創作者」（等同 `POST /auth/dev-login`，`account=brand|creator`）。每個標「截圖」的步驟在 viewport `390x844` 與 `1280x900` 各截一張；截圖前檢查 `document.documentElement.scrollWidth <= window.innerWidth` 是 `true`。

- [ ] **Step 7: 端對端操作**

1. **招募錄取並設定金額**：品牌開 `/brand/briefs` →「E2E 冬季保養開箱」→ 測試創作者旁按「錄取」→ 表單預填金額 `6000`、交付內容「IG 貼文、限時動態」+ 換行 + 說明（截圖）。把金額清空按「錄取並建立合作案」→ 顯示「請填 1 到 10,000,000 的整數」、交付內容沒被清掉；填 `6,000` → 送出 → 跳到 `/brand/collabs/<id>`：標題「測試創作者 × E2E 冬季保養開箱」、「NT$6,000 待付款」、案號、來源「招募：E2E 冬季保養開箱」；進度條「邀約」已完成、「確認」是目前；卡片「輪到你：確認並付款」「等待付款確認」（截圖）。按「確認並付款」→ 只展開說明，狀態不變。回招募詳情：該報名「已錄取」並有「查看合作案 →」。
   - 創作者開 `/creator/collabs`：這一列有「等對方」；點進去卡片「等對方付款託管」「你不用做任何事」（截圖）。
   - 品牌導覽列「合作案」、創作者「合作」都亮起並連到列表；品牌開 `/creator/collabs/<id>` → 被導回 `/brand`。
2. **本機標記已付款**：品牌詳情按「標記已付款（本機）」→ 回到詳情：「NT$6,000 已託管」、進度條第 4 步「交稿」、事件多一行「款項已託管」。
3. **創作者交稿**：創作者詳情卡片「輪到你：交稿」→ 上傳 `$E2E/work.jpg` 與 `$E2E/brief.pdf`（各自出現在清單）；再上傳一次 `work.jpg` 後按它的 ✕ 移除；連結填 `https://drive.google.com/e2e`、說明「初稿」→「交稿」→ 狀態「審核中」、交稿紀錄「第 1 次交稿」有圖片縮圖與「PDF 2」、連結、說明（截圖）。
   - 用 SQL 確認被移除的那個檔案已經不在 storage：`psql … -Atc "select count(*) from storage.objects where bucket_id = 'deliverables' and name like (select id::text from public.collaborations where title = 'E2E 冬季保養開箱') || '/%'"` → `2`。
4. **要求修改、再交稿、通過**：品牌詳情卡片顯示最新交稿的縮圖與「剩 2 天 23 小時後自動通過」之類的倒數 → 按「要求修改」→ 空白送出顯示「請寫下要修改的地方」→ 填「第二張亮一點」→ 送出 → 狀態「待交稿」、第 1 次交稿下方出現「品牌要求修改：第二張亮一點」、事件「測試品牌 要求修改：第二張亮一點」（截圖）。創作者只附連結 `https://drive.google.com/e2e-v2` 再交一次 →「第 2 次交稿」。品牌「審核通過」→ 狀態「待發佈」。連點測試：在另一個分頁（還停在審核中的舊畫面）再按「審核通過」→ 顯示「狀態已更新，已為你重新整理」，不是錯誤。
5. **填貼文連結**：創作者卡片「輪到你：發佈並填入貼文連結」→ 填 `https://a..b.com/p/1` → 前端顯示「請貼上完整的貼文網址…」；填 `https://www.instagram.com/p/e2e123/` → 狀態「撥款處理中」，兩邊列表都顯示「撥款處理中」，卡片顯示貼文連結（截圖）。
6. **用 SQL 撥款**：從詳情的案號，照 README「撥款」那段 SQL（只改案號）用 psql 執行 → `completed`；兩邊重新整理：「NT$6,000 已撥款」、進度條全部完成、卡片「合作已完成」，列表在「已完成」分頁（截圖）。另外照 README「標記已付款」那段 SQL（案號填 `e2e6a0c2`，即種子的「E2E 人工標記付款」）用 psql 執行 → `result` 是 `paid`、`status` 是 `awaiting_submission`。
7. **直接邀請、婉拒；另一位接受後品牌取消**：品牌開 `/c/devcreator` →「邀請合作」→ 展開表單（390 時在底部、可捲動；截圖）→ 案名空白送出顯示「請填寫案名」→ 填「E2E 直接邀請」、交付內容「Reels 1 支」、金額 `3000` → 送出 → 跳到詳情，狀態「邀約中」、進度條第 1 步。再邀一次同一位 → 「你已經邀請過這位創作者，請等對方回覆」。創作者「婉拒」→ 確認區塊（不是瀏覽器對話框）→「已婉拒」。品牌開 `/c/p6han` 邀請「E2E 邀請小涵」（`2000`）；用 SQL 代替小涵接受：
   ```bash
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 <<'SQL'
   begin;
   set local role authenticated;
   select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000e2e60011","role":"authenticated"}', true);
   select public.transition_collaboration(c.id, 'accept') from public.collaborations c where c.title = 'E2E 邀請小涵';
   commit;
   SQL
   ```
   品牌重新整理 →「取消合作」→ 確認 →「已取消」；列表「已取消」分頁有婉拒與取消兩筆（截圖）。
8. **Cron**：
   ```bash
   set -a; source .env.local; set +a
   curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/cron/auto-approve
   curl -s -H "Authorization: Bearer wrong" -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/cron/auto-approve
   curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/auto-approve
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -Atc "select status from public.collaborations where id = '00000000-0000-0000-0000-0000e2e60cc1'"
   ```
   Expected：`401`、`401`、`{"approved":1,"failed":[]}`（本機若有其他逾期資料，數字可能更大）、`awaiting_publish`。
9. **第三人**：品牌與創作者分別開 `/brand/collabs/00000000-0000-0000-0000-0000e2e60cc1`、`/creator/collabs/00000000-0000-0000-0000-0000e2e60cc1` → 404 畫面；`/brand/collabs/not-a-uuid` → 404。signed URL：在 scratchpad 寫一個 node 腳本，用 `@supabase/supabase-js`（專案的 `node_modules`）以 secret key `auth.admin.generateLink({ type: "magiclink", email: "dev-brand@kollink.test" })` 取得 `hashed_token`，再用 publishable key 的 client `auth.verifyOtp({ type: "magiclink", token_hash })` 登入，呼叫 `storage.from("deliverables").createSignedUrl("00000000-0000-0000-0000-0000e2e60cc1/00000000-0000-0000-0000-0000e2e60011/99999999-9999-4999-8999-999999999999.jpg", 60)` → 回傳 error（找不到物件），`data` 是 null。
10. **本機按鈕在正式模式不存在**：`curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/dev/mark-paid` 在 dev 是 `400`（沒有 collabId）；Step 4 的 build 之後不另外驗正式模式（`isDevLoginEnabled` 已有單元測試）。

- [ ] **Step 8: 關閉 server、清理種子資料**

```bash
kill <Step 6 的 PID>
lsof -iTCP:3000 -sTCP:LISTEN || echo "已關閉"
set -a; source .env.local; set +a
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -Atc "select coalesce(json_agg(o.name), '[]') from storage.objects o where o.bucket_id = 'deliverables'" > "$E2E/objects.json"
curl -s -X DELETE "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/deliverables" -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  -H "Content-Type: application/json" -d "{\"prefixes\":$(cat "$E2E/objects.json")}"
```

合作案、付款、audit log 有外鍵與 append-only 保護，不能用一般 delete 清掉；本機一律用 `npx supabase db reset`（會重新套用所有 migration、清空本機資料，包括測試快速登入的帳號，下次按一下就會重建）：

```bash
npx supabase db reset
npx supabase test db
git status --short
```
Expected：「已關閉」；DELETE 回傳刪掉的物件；`db reset` 成功；`supabase test db` 全過；`git status` 乾淨（截圖不在 repo 裡；若 `AGENTS.md` 被 `next dev` 改了就照 Step 6 commit）。把截圖資料夾路徑與每張截圖的檔名回報給 controller。

---

## 完成後（controller 執行，不是 task）

1. **端對端驗收複查**：派一個沒參與實作的 subagent，看 Task 11 Step 7 的截圖，對照 spec「頁面」「驗收」逐項檢查（手機 390、桌面 1280）。
2. **全分支最終審查**：review package 用 `git merge-base main HEAD` 為起點。
3. 開 PR（base 為 `main`），PR 說明寫明部署順序：
   - **合併前先執行 `npx supabase db push --remote`**（新 migration `20261125000100_collab_create.sql`、`20261125000200_deliverables.sql`、`20261125000300_collab_reads.sql`）。
   - **合併前把 `CRON_SECRET` 加到 Vercel 的 Production 環境變數**（沒有它 cron 會回 500，不會自動通過；見 README「部署（Vercel）」）。
   - 確認 Supabase 的全域檔案上限至少 50 MB。
