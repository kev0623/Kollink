# Kollink 站內訊息 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 品牌在創作者公開頁按「傳訊息」開啟對話；品牌與創作者在 `/brand/messages`、`/creator/messages` 看對話列表（桌面左右兩欄、手機兩頁），在對話裡收發文字訊息（即時更新、載入較早的訊息、聯絡方式送出前提醒、送出後由資料庫標記）；導覽列「訊息」顯示即時的未讀徽章；對話標題區列出相關合作案，合作案詳情可以「前往對話」；創作者停權時對話暫停。

**Architecture:** 兩個 migration：`20261126000100_messaging_write.sql`（收回 `messages` 的直接寫入與 anon 讀取、`is_conversation_participant` 收回 PUBLIC／anon、內文上限 2000、`has_contact_info` + BEFORE INSERT trigger、`conversation_reads`、`start_conversation`、`send_message`（含頻率限制）、`mark_conversation_read`、加入 `supabase_realtime` publication）與 `20261126000200_messaging_reads.sql`（`list_my_conversations`、`get_conversation`、`list_messages`、`unread_conversation_count`、`get_collaboration` 多回傳 `conversation_id`）。TS 端：純函式放 `src/lib/messages/`（聯絡方式、顯示、錯誤）與 `src/lib/validation/message.ts`；伺服器讀取 `src/lib/messages/load.ts`；共用的 Server Actions `src/lib/messages/actions.ts`（送出、標記已讀、載入較早的訊息），品牌專用的 `src/app/brand/messages/actions.ts`（開啟對話）。即時更新用 Supabase Realtime Postgres Changes（RLS 以訂閱者身分過濾），封裝在 `useMessageInserts`；導覽列 `UnreadBadge`、列表 `LiveRefresh`（`router.refresh()`）、對話 `ThreadView` 各自訂閱。頁面不使用 layout 保存狀態：列表頁與對話頁各自在 `<Suspense>` 內 `requireRole` 後讀取，共用 `MessagesPages.tsx` 的 section。

**Tech Stack:** Next.js 16.4.6（App Router、`cacheComponents`、Server Actions、`useActionState`）、React 19.3、TypeScript、Tailwind v4、Supabase CLI 3.2（Postgres 17、Realtime）、`@supabase/supabase-js` 2.119（realtime-js 2.119）、pgTAP、Vitest、lucide-react。

**Spec:** `docs/superpowers/specs/2026-11-26-messaging-design.md`（含使用者決定；視覺沿用 `docs/superpowers/specs/2026-11-24-ui-refresh-design.md`；延後事項與既有決定見 `docs/superpowers/plans/2026-11-22-foundation-followups.md`）

## Global Constraints

- Next.js 16 與訓練資料不同：寫程式前先讀 `node_modules/next/dist/docs/` 對應文件（本計畫用到的已列在下方「設計決定」）。`middleware.ts` 已改名為 `proxy.ts`。
- `cacheComponents` 已開啟：讀 `cookies()`、`headers()`、`searchParams`、`params` 的元件必須在 `<Suspense>` 內；不要在 layout 最外層 await session（`node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`）。不可使用 `export const runtime`、`export const dynamic`。讀現在時間（`Date.now()`、`new Date()`、`todayTw()`）只能在 `requireRole()`（內部已 `await connection()`）之後；client 元件不自己算現在時間，由伺服器把算好的值當 prop 傳下去（對話裡的時間只顯示絕對時間 `HH:mm` 與日期，不需要「現在」）。
- 金鑰：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（瀏覽器可見）、`SUPABASE_SECRET_KEY`（只能出現在 import `server-only` 的檔案）。絕不加 `NEXT_PUBLIC_` 前綴。本計畫不使用 `createAdminClient()`。
- 品牌與創作者的讀取與動作一律用**使用者自己的** client（伺服器 `src/lib/supabase/server.ts`；瀏覽器的 Realtime 訂閱與未讀數查詢用 `src/lib/supabase/client.ts`）。訊息不可改走 service_role（followups「7. 站內訊息」：`sender_id` 會變成 null、`flagged_contact` 也不該由伺服器端程式決定）。
- SQL 函式一律 `set search_path = ''`，物件名稱寫完整 schema；`RETURNS TABLE` 的 plpgsql 函式加 `#variable_conflict use_column`，欄位一律加表別名。
- 權限寫在 migration（followups「資料表權限寫在 migration」）：資料表先 `revoke all ... from anon, authenticated, service_role` 再明確 `grant`；新函式先 `revoke execute ... from public, anon, authenticated, service_role` 再 `grant` 給需要的角色。只給 trigger 或 definer 函式內部用的 helper 不 grant 給任何 API 角色。
- 寫入一律經由 definer 函式：`messages`、`conversations`、`conversation_reads` 不給任何 API 角色 INSERT／UPDATE／DELETE。
- 錯誤碼（TS 端只透過 `src/lib/messages/errors.ts` 轉成中文）：身分 `42501`（`not authenticated`、`not a brand`）；找不到 `P0002`（`creator not found`、`conversation not found`）；狀態 `55000`（`conversation closed`）；格式 `22023`（`invalid body`）；頻率 `54000`（`too many messages`、`too many conversations`）。
- 文字：JS 端 `cleanMessageBody`（CRLF／CR → LF 再 `cleanTextWithin`）與 SQL 端 `clean_text(regexp_replace(p_body, E'\r\n?', E'\n', 'g'))` 清理；JS 用 `hasBadChar`（bidi 或 NUL）擋、SQL 用 `has_bidi` 擋；字數以 code point 計（`textLength`），1–2000。聯絡方式的正規表示式 JS（`src/lib/messages/contact.ts`）與 SQL（`has_contact_info`）必須完全相同，兩邊的註解互相指向，測試案例兩邊相同。
- 每個讀取使用者資料的頁面都要呼叫 `requireRole("brand")` 或 `requireRole("creator")`（layout 的 Gate 不算數）。Server Action：品牌專用的呼叫 `requireRole("brand")`；品牌與創作者共用的訊息 actions（`src/lib/messages/actions.ts`）用 `getCurrentUser()` 確認角色是 brand 或 creator（`requireRole` 只能指定一種角色；資料庫函式另外檢查參與者身分）。
- Server Action 是公開的 POST 端點：參數一律當成 `unknown` 檢查型別與範圍；id 一律用 `isUuid` 檢查（`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`「Security」）。
- `supabase gen types` 產生的 RPC 回傳型別把 `RETURNS TABLE` 的欄位都標成非 null，實際上可能是 null：mapper 一律用自己定義、欄位可為 null 的 Row 型別（`src/lib/messages/view.ts`），`data` 先轉成 `unknown` 再轉型。Realtime 的 `payload.new` 也一樣當成 `MessageRow`。
- React 19 在 form action 結束後會重設非受控欄位：訊息輸入框一律受控（`value` + `onChange`），送出用 `onSubmit` + `preventDefault`，不用 form action。
- 送出按鈕：進行中一律 `disabled`。
- 介面文字為繁體中文；產品名稱只從 `src/lib/site.ts` 的 `SITE_NAME` 取得。
- 顏色只用 `src/app/globals.css` 的 token class：`bg-bg`、`bg-panel`、`bg-surface`、`border-line`、`divide-line`、`text-ink`、`bg-ink`、`text-muted`、`text-on-ink`、`text-primary`、`bg-primary`、`border-primary`、`bg-primary-soft`、`ring-primary-soft`、`text-success`、`bg-success-soft`、`text-danger`、`bg-danger`、`border-danger`、`ring-ink`、`accent-ink`；圓角 `rounded-card`、`rounded-btn`、`rounded-nav`、`rounded-input`。不可用 `text-white` 或其他色碼。
- 手機 390 寬不可出現整頁水平捲軸：可左右捲動的容器加 `relative`（裡面有 `sr-only` 文字時）；長文字加 `break-words`／`min-w-0`。
- 確認一律用頁面內的區塊，不可用瀏覽器的 `confirm()`。
- 不新增 npm 套件。圖示用已安裝的 `lucide-react`，`strokeWidth={1.5}`、`aria-hidden="true"`。
- 只動**本機** Supabase：不可執行 `supabase link`、`db push --remote`、`supabase config push`，也不可連到正式專案。
- 不可同時跑兩個 `next build`／`next dev`／`next start`（共用 `.next`）；同一時間只能有一個 agent 在跑這些指令。只有 Task 8 會啟動伺服器（一個 dev server、一個 port），用完要關掉。
- 每個 task 結束時：`npm run lint && npm run typecheck && npm test` 全過；有動到 SQL 的 task 另跑 `npx supabase test db` 全過。畫面元件沒有單元測試環境（vitest 是 node 環境，只有 `renderToStaticMarkup` 的靜態測試），由 typecheck、lint、Task 8 的 build 與 E2E 驗證。
- pgTAP fixture 一律寫在該測試檔自己的 transaction 裡（結尾 `rollback`），id 用本計畫專屬的前綴（`…0008xx`、`…00008…`），不能影響 `01`、`05` 這些會數列數的舊測試。
- Commit 訊息用中文寫「計畫 7 Task N：重點」，結尾加你所在環境指定的 Co-Authored-By 歸屬行（寫實際執行的模型）。
- 前置：Docker Desktop 已啟動，`npx supabase start` 已執行，`.env.local` 已設定（見 README「本機開發」）。每個 DB task 開始前先 `npx supabase migration up` 套用新 migration。

## 設計決定

讀過的文件：
- `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`（「Security」：action 是公開的 POST；`redirect` 之後的程式不會執行）
- `node_modules/next/dist/docs/01-app/02-guides/forms.md`（`useActionState(action, initial)` 回傳 `[state, formAction, pending]`）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md`（`router.refresh()`：重新向伺服器要 RSC、合併時**保留** client 的 `useState` 與捲動位置）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-selected-layout-segment.md`（在有動態參數的路由下會 suspend、需要 `<Suspense>`；本計畫因此不用 layout + segment，改成每頁自己排版）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md`（在 `<Suspense>` 內呼叫時回應碼仍是 200 + `noindex` = soft 404）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md`（`requireRole` 已 `await connection()`，之後才能讀現在時間）
- `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`
- `node_modules/@supabase/supabase-js/dist/index.mjs`（`_handleTokenChanged`：`SIGNED_IN`／`TOKEN_REFRESHED`／`INITIAL_SESSION` 時自動 `realtime.setAuth(token)`）、`node_modules/@supabase/realtime-js/dist/main/RealtimeClient.js`（`setAuth(token = null)`：沒有參數時呼叫 `accessToken` callback 取目前 session 的 JWT；`channel(topic)` 對同名 topic 回傳既有 channel）、`RealtimeChannel.d.ts`（`postgres_changes` 的 `filter`、`RealtimePostgresInsertPayload.new`）

決定：
1. **兩個 migration 分寫入與讀取**，各配一個 pgTAP 檔（`18_messaging_write.test.sql` 51 個、`19_messaging_reads.test.sql` 24 個）。本計畫撰寫時已把兩個 migration、兩個新測試、改過的 `02`，以及其他 15 個既有測試檔，在本機 rollback 的 transaction 裡實際跑過，全部通過（`02` 12、`03` 44、`11` 138、`13` 37、`15` 22……）。
2. **誰能開啟對話**：只有品牌，經由 `start_conversation`；它內部沿用計畫 6 的 `ensure_conversation`（取得或建立並鎖住）。已有對話一律回傳（停權的創作者也回傳，頁面顯示「暫停」）；沒有對話時創作者必須 approved。頻率限制「24 小時內最多 30 個新對話」以 `conversations.created_at` 計（包括錄取、邀請建立的對話）。創作者不能開啟對話（使用者決定；「報名過的創作者」也不行，見 spec）。
3. **空對話的可見性**：品牌按「傳訊息」會先建立對話再導過去（不是「第一則訊息才建立」），避免另寫一個「還沒有 id 的對話頁」。代價是可能留下空對話：`list_my_conversations` 讓創作者看不到「沒有訊息、也沒有合作案」的對話；品牌看得到自己開的空對話。
4. **flagged_contact 由 BEFORE INSERT trigger 決定**（followups「7. 站內訊息」）。`has_contact_info` 不授權給任何 API 角色（只有 trigger 用）；`messages_flag_contact` 每次 insert 都覆寫，連擁有者直接 insert 也一樣。JS 的 `contactKinds` 只用來在送出前提醒，資料庫不相信 client。
5. **內文上限 2000 字**（計畫 1 是 4000）：聊天訊息 2000 字已足夠，畫面計數器也比較合理。`messages_body_check` 一起改成 2000，讓資料庫與函式同一個數字。
6. **頻率限制**：`send_message` 檢查同一個人最近 1 分鐘內的訊息數 ≥ 20 就丟 `54000 too many messages`，靠新索引 `messages (sender_id, created_at)`。並行送出可能多過幾則（沒有鎖），可以接受。
7. **對話暫停**：`send_message` 讀對話時一併讀創作者狀態，不是 `approved` 就 `55000 conversation closed`。列表與標題帶 `closed`，輸入區改成說明。品牌沒有停權欄位，不處理。
8. **已讀**：`conversation_reads` 一人一對話一列，`last_read_at` = 最後一則訊息的 `created_at`（只會往後）。由 client 在開啟對話、收到對方訊息（分頁在前景）時呼叫 `markReadAction`，成功後 `window.dispatchEvent(new Event(MESSAGES_READ_EVENT))`，導覽列徽章重新查詢。不在伺服器渲染時標記（避免 prefetch 把訊息標成已讀）。
9. **未讀徽章**：`unread_conversation_count()`（有未讀的對話數），由 `UnreadBadge` 直接用瀏覽器 client 呼叫 RPC（不需要 Server Action：definer 函式自己用 `auth.uid()`）。查詢時機：mount、`pathname` 改變、`MESSAGES_READ_EVENT`、任何新訊息（Realtime）。超過 9 顯示「9+」。
10. **Realtime**：Postgres Changes 訂閱 `public.messages` 的 INSERT。Realtime 以訂閱者的 JWT 檢查 `messages_select`，所以徽章與列表的訂閱不必加過濾，開著的對話加 `conversation_id=eq.<id>`。訂閱前 `await supabase.realtime.setAuth()`（不帶參數 = 取目前 session），避免第一次連線還是 anon。channel 名稱加 `crypto.randomUUID()`，因為 `channel(topic)` 對同名 topic 回傳同一個 channel（React StrictMode 重掛、或兩個元件同名時會出錯）。訂閱失敗（`CHANNEL_ERROR`／`TIMED_OUT`）時對話頁顯示「即時更新已中斷，請重新整理頁面」，不做輪詢。
11. **列表的即時更新**：不在 client 維護列表狀態。`LiveRefresh` 收到任何新訊息就 debounce 400ms 後 `router.refresh()`，由伺服器重算預覽、排序、未讀數；`router.refresh()` 會保留 `ThreadView` 的 `useState`（文件 `use-router.md`），`ThreadView` 用「prop 改變時合併」的寫法把新的 `initialMessages` 併進目前的訊息。對話頁的列表裡，目前這一列不顯示未讀數（標記已讀與 refresh 有先後）。
12. **頁面結構**：不用 `messages/layout.tsx`（layout 需要 `useSelectedLayoutSegment` 判斷目前對話，在動態參數下會 suspend，而且 layout 在換對話時不會重新讀列表）。列表頁與對話頁各自渲染「左列表、右內容」，手機用 `hidden md:block` 切成兩頁。桌面兩欄高度固定 `md:h-[calc(100dvh-10rem)]`（主內容區 `md:my-3`、`md:py-8` 加上標題），E2E 時在 1280×900 確認沒有整頁捲動，不對就只調這個數字。
13. **分頁**：`list_messages` 由新到舊、`(created_at, id)` 游標。第一頁要 51 則判斷還有沒有更早的（`MESSAGE_PAGE_SIZE + 1`），畫面顯示 50 則；「載入較早的訊息」用 `loadOlderMessagesAction(conversationId, 最早一則的 createdAt, id)`。
14. **合作案脈絡**：對話標題區直接以使用者 client 讀 `collaborations`（`conversation_id = id`，RLS 只給參與者與管理員）。合作案詳情需要 `conversation_id`：`get_collaboration` 回傳欄位變了，要 drop 再 create（其餘邏輯與 `20261125000300_collab_reads.sql` 相同），`CollabRow.conversation_id` 設為選填，舊測試的 literal 不用改。
15. **管理員**：RLS 本來就讓管理員讀所有 `messages`、`conversations`；`get_conversation`、`list_messages` 也允許管理員（唯讀，`my_side = 'admin'`）。但 `send_message`、`mark_conversation_read` 只給參與者，頁面也要求視角等於該區（管理員進不了 `/brand`、`/creator`）。README 附上讀取被標記訊息的 SQL。
16. **`02_briefs_messaging_rls.test.sql`**：「對話參與者可以發訊息」改呼叫 `send_message`（斷言數 12 不變）；「第三方不能發」與「不能自己設定違規標記」兩個直接 insert 的斷言仍是 `42501`（現在是因為沒有 insert 權限），不用改。

## File Structure

| 檔案 | 責任 |
|---|---|
| `supabase/migrations/20261126000100_messaging_write.sql` | 收回 messages 直接寫入、`is_conversation_participant` 權限、內文 2000、`has_contact_info`、trigger、`conversation_reads`、`start_conversation`、`send_message`、`mark_conversation_read`、Realtime publication |
| `supabase/migrations/20261126000200_messaging_reads.sql` | `list_my_conversations`、`get_conversation`、`list_messages`、`unread_conversation_count`、`get_collaboration`（加 `conversation_id`） |
| `supabase/tests/18_messaging_write.test.sql`（51）、`19_messaging_reads.test.sql`（24） | pgTAP |
| `supabase/tests/02_briefs_messaging_rls.test.sql` | 發訊息改走 `send_message` |
| `src/lib/supabase/database.types.ts` | `npm run db:types` 產生（不手改） |
| `src/lib/messages/contact.ts` | 聯絡方式偵測（與 `has_contact_info` 相同規則）、提醒文字 |
| `src/lib/validation/message.ts` | 內文清理與驗證 |
| `src/lib/messages/view.ts` | Row 型別與 mapper、合併去重、時間與預覽文字、徽章文字、網址、暫停說明、常數 |
| `src/lib/messages/errors.ts` | 資料庫錯誤 → 中文 |
| `src/lib/messages/load.ts` | 伺服器端讀取（server-only）：列表、對話（標題 + 第一頁訊息 + 合作案）、較早的訊息 |
| `src/lib/messages/actions.ts` | 共用 Server Actions：送出、標記已讀、載入較早的訊息 |
| `src/app/brand/messages/actions.ts` | 品牌開啟對話 |
| `src/lib/collabs/view.ts` | `Collab.conversationId` |
| `src/components/shell/nav.ts`、`SideNav.tsx`、`BottomTabBar.tsx`、`UnreadBadge.tsx` | 「訊息」連結與未讀徽章 |
| `src/app/brand/layout.tsx` | 註解更新（手機底部導覽列多了「訊息」） |
| `src/components/messages/useMessageInserts.ts` | Realtime 訂閱 hook |
| `src/components/messages/LiveRefresh.tsx`、`ConversationList.tsx`、`ThreadHeader.tsx`、`ThreadView.tsx`、`MessageBubble.tsx`、`Composer.tsx`、`MessagesPages.tsx`、`MessageButton.tsx` | 畫面 |
| `src/app/brand/messages/page.tsx`、`[id]/page.tsx`、`src/app/creator/messages/page.tsx`、`[id]/page.tsx` | 頁面 |
| `src/components/collabs/InvitePanel.tsx`、`EventList.tsx`、`CollabDetail.tsx`、`src/app/c/[handle]/profile-view.test.ts` | 入口：「傳訊息」、「前往對話」 |
| `README.md`、`docs/superpowers/plans/2026-11-22-foundation-followups.md` | 文件同步 |

---

### Task 1: 資料庫：寫入路徑（收回直接寫入、聯絡方式 trigger、開啟對話、送出、已讀、Realtime）

**Files:**
- Create: `supabase/migrations/20261126000100_messaging_write.sql`、`supabase/tests/18_messaging_write.test.sql`
- Modify: `supabase/tests/02_briefs_messaging_rls.test.sql`、`src/lib/supabase/database.types.ts`（產生）

**Interfaces:**
- Consumes: `public.clean_text(text)`、`public.has_bidi(text)`、`public.my_role()`、`public.is_admin()`、`public.ensure_conversation(uuid, uuid)`（計畫 6）、`public.is_conversation_participant(uuid)`、`messages_select` policy（計畫 1，不變）。
- Produces（後面的 task 依賴）：
  - `start_conversation(p_creator_id uuid) → uuid`
  - `send_message(p_conversation_id uuid, p_body text) → table (id, conversation_id, sender_id, body, flagged_contact, created_at)`
  - `mark_conversation_read(p_conversation_id uuid) → void`
  - `has_contact_info(text) → boolean`（不授權給 API 角色）、trigger `messages_flag_contact`
  - 資料表 `conversation_reads(conversation_id, user_id, last_read_at)`
  - `messages` 在 `supabase_realtime` publication；任何 API 角色對 `messages` 只有 SELECT（anon 沒有）
  - 錯誤：`not authenticated`／`not a brand`（42501）、`creator not found`／`conversation not found`（P0002）、`conversation closed`（55000）、`invalid body`（22023）、`too many messages`／`too many conversations`（54000）

- [ ] **Step 1: 寫失敗的測試 `supabase/tests/18_messaging_write.test.sql`**

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(51);

-- 801 品牌、802 第三方品牌、803 頻率限制用的品牌；811 已審核、812 待審核、813 停權創作者；819 管理員（沒有 profile）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000801', 'p7-b1@test.local'),
  ('00000000-0000-0000-0000-000000000802', 'p7-b2@test.local'),
  ('00000000-0000-0000-0000-000000000803', 'p7-b3@test.local'),
  ('00000000-0000-0000-0000-000000000811', 'p7-c1@test.local'),
  ('00000000-0000-0000-0000-000000000812', 'p7-c2@test.local'),
  ('00000000-0000-0000-0000-000000000813', 'p7-c3@test.local'),
  ('00000000-0000-0000-0000-000000000819', 'p7-admin@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000801', 'brand', '七號品牌'),
  ('00000000-0000-0000-0000-000000000802', 'brand', '路人品牌'),
  ('00000000-0000-0000-0000-000000000803', 'brand', '灌訊息品牌'),
  ('00000000-0000-0000-0000-000000000811', 'creator', '七號小美'),
  ('00000000-0000-0000-0000-000000000812', 'creator', '七號新人'),
  ('00000000-0000-0000-0000-000000000813', 'creator', '七號停權');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000819');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000801', '七號品牌'),
  ('00000000-0000-0000-0000-000000000802', '路人品牌'),
  ('00000000-0000-0000-0000-000000000803', '灌訊息品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000811', 'p7mei', 'p7mei', 'approved'),
  ('00000000-0000-0000-0000-000000000812', 'p7new', 'p7new', 'pending'),
  ('00000000-0000-0000-0000-000000000813', 'p7gone', 'p7gone', 'suspended');
-- 頻率限制：31 位已審核創作者，803 已經在 24 小時內開了 30 個對話
insert into auth.users (id, email)
  select ('00000000-0000-0000-0000-0000008' || lpad(g::text, 5, '0'))::uuid, 'p7-rate' || g || '@test.local'
    from generate_series(1, 31) g;
insert into public.profiles (id, role, display_name)
  select ('00000000-0000-0000-0000-0000008' || lpad(g::text, 5, '0'))::uuid, 'creator', '量產' || g
    from generate_series(1, 31) g;
insert into public.creator_profiles (user_id, handle, ig_username, status)
  select ('00000000-0000-0000-0000-0000008' || lpad(g::text, 5, '0'))::uuid, 'p7rate' || g, 'p7rate' || g, 'approved'
    from generate_series(1, 31) g;
insert into public.conversations (brand_id, creator_id)
  select '00000000-0000-0000-0000-000000000803', ('00000000-0000-0000-0000-0000008' || lpad(g::text, 5, '0'))::uuid
    from generate_series(1, 30) g;
-- 801 與 811 已有對話（例如之前的邀約）；801 與停權的 813 也有
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000008c001', '00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000811'),
  ('00000000-0000-0000-0000-00000008c002', '00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000813');

-- ── A. 權限 ──
select ok(not has_table_privilege('authenticated', 'public.messages', 'INSERT'), 'authenticated 不能直接 insert messages');
select ok(not has_column_privilege('authenticated', 'public.messages', 'body', 'INSERT'), '計畫 1 的欄位 insert 權限已收回');
select ok(not has_table_privilege('service_role', 'public.messages', 'INSERT'), 'service_role 也不能直接 insert');
select ok(not has_table_privilege('anon', 'public.messages', 'SELECT'), 'anon 讀不到 messages');
select ok(not has_table_privilege('authenticated', 'public.messages', 'UPDATE'), '沒有人能 update messages');
select ok(not has_table_privilege('authenticated', 'public.messages', 'DELETE'), '沒有人能 delete messages');
select ok(not has_function_privilege('anon', 'public.is_conversation_participant(uuid)', 'EXECUTE'),
  'anon 不能呼叫 is_conversation_participant');
select ok(has_function_privilege('authenticated', 'public.is_conversation_participant(uuid)', 'EXECUTE'),
  'authenticated 仍可呼叫（policy 與 Realtime 需要）');
select ok(exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'),
  'messages 在 supabase_realtime publication 裡');
select ok(not has_table_privilege('authenticated', 'public.conversation_reads', 'INSERT'), '已讀只能經由函式寫入');

-- ── B. 聯絡方式偵測（與 src/lib/messages/contact.test.ts 相同的案例）──
select ok(
  (select bool_and(public.has_contact_info(t)) from (values
    ('我的電話 0912-345-678'), ('０９１２３４５６７８'), ('+886 912 345 678'), ('(02) 2345-6789'), ('07-123-4567'),
    ('mail: Mei.Lin@Example.com.tw'), ('看 https://foo.bar/x'), ('www.abc.xyz'), ('line.me/ti/p/abc'), ('官網 abc.com 有'),
    ('LINE ID: mei_123'), ('ＬＩＮＥ：mei'), ('加我賴'), ('加個line吧'), ('賴: abc'), ('line@abc')) x(t)),
  '電話、Email、連結、LINE 都偵測得到');
select ok(
  (select not bool_or(public.has_contact_info(t)) from (values
    ('預算 NT$30,000 元'), ('2026-11-26 交稿'), ('deadline: 12/1'), ('online 直播'), ('line drawing 風格'),
    ('abc.comx'), ('e.g. 這樣'), ('訂單 123456789'), ('IG @mei.ig'), ('09123456789'), (E'加\n\n賴')) x(t)),
  '一般內容不會誤判');

-- ── C. 開啟對話 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000811","role":"authenticated"}', true);
select throws_ok($$select public.start_conversation('00000000-0000-0000-0000-000000000801')$$,
  '42501', 'not a brand', '創作者不能主動開啟對話');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.start_conversation('00000000-0000-0000-0000-000000000811')$$,
  '42501', 'not authenticated', '沒有登入不能開啟對話');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000801","role":"authenticated"}', true);
select throws_ok($$select public.start_conversation('00000000-0000-0000-0000-000000000812')$$,
  'P0002', 'creator not found', '不能找待審核的創作者');
select throws_ok($$select public.start_conversation('00000000-0000-0000-0000-0000000008ff')$$,
  'P0002', 'creator not found', '不存在的創作者');
select is(public.start_conversation('00000000-0000-0000-0000-000000000811'),
  '00000000-0000-0000-0000-00000008c001'::uuid, '已有對話就回傳同一個');
select is(public.start_conversation('00000000-0000-0000-0000-000000000813'),
  '00000000-0000-0000-0000-00000008c002'::uuid, '已有對話的停權創作者也回傳（畫面顯示暫停）');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000802","role":"authenticated"}', true);
select lives_ok($$select public.start_conversation('00000000-0000-0000-0000-000000000811')$$, '品牌可以找已審核的創作者');
select is((select count(*)::int from public.conversations
            where brand_id = '00000000-0000-0000-0000-000000000802' and creator_id = '00000000-0000-0000-0000-000000000811'),
  1, '建立了對話');
select is(public.start_conversation('00000000-0000-0000-0000-000000000811'),
  (select id from public.conversations
    where brand_id = '00000000-0000-0000-0000-000000000802' and creator_id = '00000000-0000-0000-0000-000000000811'),
  '再按一次回傳同一個對話');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000803","role":"authenticated"}', true);
select throws_ok($$select public.start_conversation('00000000-0000-0000-0000-000000800031')$$,
  '54000', 'too many conversations', '24 小時內最多開 30 個新對話');
select lives_ok($$select public.start_conversation('00000000-0000-0000-0000-000000800001')$$,
  '已經有的對話不受頻率限制');

-- ── D. 送出訊息 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000802","role":"authenticated"}', true);
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c001', '插話')$$,
  'P0002', 'conversation not found', '第三方不能在別人的對話裡發訊息');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000819","role":"authenticated"}', true);
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c001', '我是管理員')$$,
  'P0002', 'conversation not found', '管理員不能代替參與者發訊息');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000811","role":"authenticated"}', true);
select is((select body from public.send_message('00000000-0000-0000-0000-00000008c001', E'  你好​  ')),
  '你好', '創作者可以在既有對話裡發訊息，內文已清理');
select is((select sender_id::text from public.messages where body = '你好'),
  '00000000-0000-0000-0000-000000000811', 'sender_id 一定是呼叫者');
select is((select body from public.send_message('00000000-0000-0000-0000-00000008c001', E'第一行\r\n第二行\r第三行')),
  E'第一行\n第二行\n第三行', 'CRLF 與 CR 都換成 LF');
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c001', E' \t\n')$$,
  '22023', 'invalid body', '空白訊息');
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c001', repeat('字', 2001))$$,
  '22023', 'invalid body', '最多 2000 字');
select lives_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c001', repeat('字', 2000))$$,
  '剛好 2000 字可以');
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c001', E'abc‮')$$,
  '22023', 'invalid body', '雙向控制字元');
select is((select flagged_contact from public.send_message('00000000-0000-0000-0000-00000008c001', '我的 LINE ID: mei_123')),
  true, '含聯絡方式的訊息仍可送出，但被標記');
select is((select flagged_contact from public.send_message('00000000-0000-0000-0000-00000008c001', '收到，謝謝')),
  false, '一般訊息沒有標記');
select throws_ok(
  $$insert into public.messages (conversation_id, sender_id, body)
    values ('00000000-0000-0000-0000-00000008c001', '00000000-0000-0000-0000-000000000801', '冒名')$$,
  '42501', null, '不能直接 insert（也就不能偽造 sender）');
select throws_ok($$update public.messages set body = '改掉' where conversation_id = '00000000-0000-0000-0000-00000008c001'$$,
  '42501', null, '不能修改訊息');
select throws_ok($$delete from public.messages where conversation_id = '00000000-0000-0000-0000-00000008c001'$$,
  '42501', null, '不能刪除訊息');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000801","role":"authenticated"}', true);
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c002', '還在嗎')$$,
  '55000', 'conversation closed', '創作者停權時品牌不能送');
select lives_ok(
  $$select public.send_message('00000000-0000-0000-0000-00000008c001', '第 ' || g || ' 則') from generate_series(1, 20) g$$,
  '1 分鐘內 20 則可以');
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c001', '第 21 則')$$,
  '54000', 'too many messages', '第 21 則被頻率限制擋下');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000813","role":"authenticated"}', true);
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c002', '我回來了')$$,
  '55000', 'conversation closed', '停權的創作者也不能送');

-- ── E. 已讀 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000802","role":"authenticated"}', true);
select throws_ok($$select public.mark_conversation_read('00000000-0000-0000-0000-00000008c001')$$,
  'P0002', 'conversation not found', '第三方不能標記已讀');
select lives_ok(
  $$select public.mark_conversation_read(cv.id) from public.conversations cv
     where cv.creator_id = '00000000-0000-0000-0000-000000000811'$$,
  '沒有訊息的對話也可以標記（不寫入）');
select is((select count(*)::int from public.conversation_reads), 0, '沒有訊息時不寫已讀');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000811","role":"authenticated"}', true);
select lives_ok($$select public.mark_conversation_read('00000000-0000-0000-0000-00000008c001')$$, '參與者可以標記已讀');
select is((select last_read_at from public.conversation_reads
            where conversation_id = '00000000-0000-0000-0000-00000008c001'),
  (select max(created_at) from public.messages where conversation_id = '00000000-0000-0000-0000-00000008c001'),
  '已讀時間 = 最後一則訊息的時間');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000801","role":"authenticated"}', true);
select is((select count(*)::int from public.conversation_reads), 0, '只讀得到自己的已讀紀錄');

-- ── F. 可見性 ──
select is((select count(*)::int from public.messages where conversation_id = '00000000-0000-0000-0000-00000008c001'),
  25, '參與者看得到對話裡的訊息');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000802","role":"authenticated"}', true);
select is((select count(*)::int from public.messages where conversation_id = '00000000-0000-0000-0000-00000008c001'),
  0, '第三方看不到');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000819","role":"authenticated"}', true);
select is((select count(*)::int from public.messages where conversation_id = '00000000-0000-0000-0000-00000008c001' and flagged_contact),
  1, '管理員看得到被標記的訊息');

-- ── G. trigger：任何路徑寫入都重新計算 ──
reset role;
insert into public.messages (conversation_id, sender_id, body, flagged_contact) values
  ('00000000-0000-0000-0000-00000008c001', '00000000-0000-0000-0000-000000000801', 'mail me: a@b.co', false);
select is((select flagged_contact from public.messages where body = 'mail me: a@b.co'), true,
  '擁有者直接 insert 時 flagged_contact 也由 trigger 決定');

select * from finish();
rollback;
```

- [ ] **Step 2: 更新 `supabase/tests/02_briefs_messaging_rls.test.sql`**

把

```sql
select lives_ok(
  $$insert into public.messages (conversation_id, body)
    values ('00000000-0000-0000-0000-00000000a001', '謝謝，我有興趣！')$$,
  '對話參與者可以發訊息');
```

換成（斷言數不變，`plan(12)` 不用改）：

```sql
select lives_ok(
  $$select public.send_message('00000000-0000-0000-0000-00000000a001', '謝謝，我有興趣！')$$,
  '對話參與者可以發訊息（計畫 7 起經由 send_message）');
```

同一個檔案其他斷言不改：第三方直接 insert、自己設定 `flagged_contact` 仍然是 `42501`（現在是因為沒有 insert 權限）。

- [ ] **Step 3: 跑測試確認失敗**

Run: `npx supabase test db`
Expected: `18_messaging_write.test.sql` 失敗（`function public.start_conversation(uuid) does not exist` 之類）、`02` 失敗（`function public.send_message(...) does not exist`），其他檔案通過。

- [ ] **Step 4: 寫 migration `supabase/migrations/20261126000100_messaging_write.sql`**

```sql
-- 站內訊息（計畫 7）之一：寫入路徑。訊息只能經由 send_message 寫入；聯絡方式由 BEFORE INSERT trigger 判斷；
-- 品牌主動開啟對話（start_conversation）；已讀（conversation_reads、mark_conversation_read）；Realtime publication。
-- 權限一律在這裡明確寫出（雲端新專案不會自動授權，本機會；見 20261124000100_explicit_api_grants.sql）。

-- 1. messages 收回所有直接寫入（計畫 1 開放了參與者直接 insert；20261124000100 還給了 anon SELECT）。
--    之後只有 send_message（definer）能寫入；任何 API 角色都不能 UPDATE／DELETE。
drop policy messages_insert_participant on public.messages;
revoke all on public.messages from anon, authenticated, service_role;
grant select on public.messages to authenticated, service_role;

-- is_conversation_participant：messages_select policy 以 authenticated 身分呼叫（Realtime 檢查訂閱者能不能讀這一列時也是），
-- 所以保留 authenticated、service_role，從 PUBLIC 與 anon 收回（followups「9. 管理後台」的其中一項）。
revoke execute on function public.is_conversation_participant(uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid) to authenticated, service_role;

-- 2. 內文 1–2000 字（計畫 1 是 4000；與 src/lib/validation/message.ts 的 MESSAGE_BODY_MAX 一致）。
--    計畫 7 之前沒有任何畫面能寫入訊息，正式環境不會有超過 2000 字的舊資料。
alter table public.messages drop constraint messages_body_check;
alter table public.messages add constraint messages_body_check check (char_length(body) between 1 and 2000);

-- 頻率限制（send_message）用：同一個人最近 1 分鐘送出幾則
create index messages_sender_created_idx on public.messages (sender_id, created_at);

-- 3. 聯絡方式偵測（電話、Email、LINE、外部連結）。規則與 src/lib/messages/contact.ts 的 contactKinds 完全相同，
--    兩邊的註解互相指向；改一邊就要改另一邊，並更新兩邊共用的測試案例（18_messaging_write.test.sql、contact.test.ts）。
--    先 NFKC 正規化（全形數字、全形英文、全形冒號都變半形）再轉小寫；電話另外去掉空白、Tab、括號、點、連字號後比對。
--    這些都是沒有反向參照的正規表示式，「有沒有符合」在 Postgres ARE 與 JS 的結果相同。
create function public.has_contact_info(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  v text := lower(normalize(coalesce(p, ''), nfkc));
  d text;
begin
  -- Email
  if v ~ '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}' then
    return true;
  end if;
  -- 外部連結：https://、www.、常見網域結尾（line.me、bit.ly 也在這裡）
  if v ~ '(https?://|www\.)'
     or v ~ '[a-z0-9-]\.(com|net|org|tw|me|io|co|cc|ly|gl|app|link|page|site)([^a-z0-9]|$)' then
    return true;
  end if;
  -- LINE：「line id」「line:」「line@」、「加我賴」「加個line」、「賴:」
  if v ~ '(^|[^a-z])line[ \t]*(id|[:@])'
     or v ~ '加[^\n]{0,2}(賴|line)'
     or v ~ '賴[ \t]*(id|[:@])' then
    return true;
  end if;
  -- 電話：手機 09xxxxxxxx、+886 9xxxxxxxx；市話 0[2-8] 加 7–8 碼
  d := regexp_replace(v, '[ \t().-]', '', 'g');
  if d ~ '(^|[^0-9])(\+?886|0)9[0-9]{8}([^0-9]|$)'
     or d ~ '(^|[^0-9])0[2-8][0-9]{7,8}([^0-9]|$)' then
    return true;
  end if;
  return false;
end;
$$;
revoke execute on function public.has_contact_info(text) from public, anon, authenticated, service_role;

-- 4. flagged_contact 一律由這個 trigger 算（followups「7. 站內訊息」：不能讓訊息改走 service_role，
--    那樣 sender_id 的預設值 auth.uid() 會是 null）。任何路徑寫入（包含擁有者在 SQL Editor）都會重新計算。
create function public.messages_flag_contact() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.flagged_contact := public.has_contact_info(new.body);
  return new;
end;
$$;
revoke execute on function public.messages_flag_contact() from public, anon, authenticated, service_role;
create trigger messages_flag_contact before insert on public.messages
  for each row execute function public.messages_flag_contact();

-- 5. 已讀：每位參與者在每個對話各一列，last_read_at = 讀到的最後一則訊息的 created_at。
--    只能經由 mark_conversation_read 寫入；本人可以讀自己的列。
create table public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null,
  primary key (conversation_id, user_id)
);
alter table public.conversation_reads enable row level security;
create policy conversation_reads_select_own on public.conversation_reads
  for select to authenticated
  using (user_id = auth.uid());
revoke all on public.conversation_reads from anon, authenticated, service_role;
grant select on public.conversation_reads to authenticated, service_role;

-- 6. 品牌主動開啟對話（公開頁「傳訊息」）：只有品牌、只能找已審核的創作者；已有對話就直接回傳（不論創作者現在的狀態）。
--    創作者不能主動開啟對話（使用者決定 2026-11-26）。同一個品牌 24 小時內最多建立 30 個新對話（防灌訊息）。
create function public.start_conversation(p_creator_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.my_role() is distinct from 'brand'
     or not exists (select 1 from public.brand_profiles bp where bp.user_id = v_uid) then
    raise exception 'not a brand' using errcode = '42501';
  end if;
  select cv.id into v_id from public.conversations cv
   where cv.brand_id = v_uid and cv.creator_id = p_creator_id;
  if v_id is not null then
    return v_id;
  end if;
  if not exists (select 1 from public.creator_profiles cp
                  where cp.user_id = p_creator_id and cp.status = 'approved') then
    raise exception 'creator not found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.conversations cv
       where cv.brand_id = v_uid and cv.created_at > now() - interval '1 day') >= 30 then
    raise exception 'too many conversations' using errcode = '54000';
  end if;
  return public.ensure_conversation(v_uid, p_creator_id);
end;
$$;
revoke execute on function public.start_conversation(uuid) from public, anon, authenticated, service_role;
grant execute on function public.start_conversation(uuid) to authenticated;

-- 7. 送出訊息：只有對話的品牌或創作者（管理員不行）。
--    內文先把 CRLF／CR 換成 LF 再 clean_text，不可有 bidi，1–2000 字（與 src/lib/validation/message.ts 一致）。
--    創作者不是 approved（停權）時對話暫停，雙方都不能送（55000 conversation closed）。
--    頻率限制：同一個人 1 分鐘內最多 20 則（54000 too many messages）。回傳新訊息（含 trigger 算好的 flagged_contact）。
create function public.send_message(p_conversation_id uuid, p_body text)
returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  body text,
  flagged_contact boolean,
  created_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_body text := nullif(public.clean_text(regexp_replace(p_body, E'\r\n?', E'\n', 'g')), '');
  v_status text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select cp.status into v_status
    from public.conversations cv
    join public.creator_profiles cp on cp.user_id = cv.creator_id
   where cv.id = p_conversation_id and (cv.brand_id = v_uid or cv.creator_id = v_uid);
  if not found then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  if v_status <> 'approved' then
    raise exception 'conversation closed' using errcode = '55000';
  end if;
  if v_body is null or public.has_bidi(v_body) or char_length(v_body) > 2000 then
    raise exception 'invalid body' using errcode = '22023';
  end if;
  if (select count(*) from public.messages m
       where m.sender_id = v_uid and m.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many messages' using errcode = '54000';
  end if;
  return query
  insert into public.messages as m (conversation_id, sender_id, body)
  values (p_conversation_id, v_uid, v_body)
  returning m.id, m.conversation_id, m.sender_id, m.body, m.flagged_contact, m.created_at;
end;
$$;
revoke execute on function public.send_message(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.send_message(uuid, text) to authenticated;

-- 8. 標記已讀：last_read_at 推進到這個對話目前最後一則訊息的時間（只會往後、不會倒退）。沒有訊息時不寫。
create function public.mark_conversation_read(p_conversation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.conversations cv
                  where cv.id = p_conversation_id and (cv.brand_id = v_uid or cv.creator_id = v_uid)) then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  insert into public.conversation_reads as r (conversation_id, user_id, last_read_at)
  select p_conversation_id, v_uid, max(m.created_at)
    from public.messages m
   where m.conversation_id = p_conversation_id
  having max(m.created_at) is not null
  on conflict (conversation_id, user_id)
  do update set last_read_at = greatest(r.last_read_at, excluded.last_read_at);
end;
$$;
revoke execute on function public.mark_conversation_read(uuid) from public, anon, authenticated, service_role;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- 9. Realtime：新訊息推送給訂閱者。Postgres Changes 會以訂閱者的身分檢查 messages_select（RLS），
--    所以參與者（與管理員）只收得到自己讀得到的訊息。
alter publication supabase_realtime add table public.messages;
```

- [ ] **Step 5: 套用 migration、跑測試、產生型別**

```bash
npx supabase migration up
npx supabase test db
npm run db:types
```
Expected: 全部通過（`18` 51 個、`02` 12 個，其他檔案的斷言數不變）。`database.types.ts` 出現 `start_conversation`、`send_message`、`mark_conversation_read`、`conversation_reads`；`messages` 的 Insert 型別仍在（型別不反映權限），程式不可以用它。

- [ ] **Step 6: 其他檢查與 commit**

```bash
npm run lint && npm run typecheck && npm test
git add supabase/migrations/20261126000100_messaging_write.sql supabase/tests/18_messaging_write.test.sql \
  supabase/tests/02_briefs_messaging_rls.test.sql src/lib/supabase/database.types.ts
git commit -m "計畫 7 Task 1：訊息寫入只走函式、聯絡方式 trigger、開啟對話、已讀、Realtime publication"
```

---

### Task 2: 資料庫：讀取（對話列表、標題、訊息分頁、未讀數、合作案帶出對話）

**Files:**
- Create: `supabase/migrations/20261126000200_messaging_reads.sql`、`supabase/tests/19_messaging_reads.test.sql`
- Modify: `src/lib/supabase/database.types.ts`（產生）

**Interfaces:**
- Consumes: Task 1 的 `conversation_reads`、`send_message`、`mark_conversation_read`；計畫 6 的 `get_collaboration`。
- Produces：
  - `list_my_conversations() → table (id, my_side, counterpart_name, counterpart_image_path, counterpart_handle, last_body, last_sender_is_me, last_at, unread_count, closed)`
  - `get_conversation(p_id uuid) → table (id, my_side, brand_id, brand_name, brand_logo_path, creator_id, creator_name, creator_handle, creator_avatar_path, closed)`
  - `list_messages(p_conversation_id uuid, p_before_at timestamptz default null, p_before_id uuid default null, p_limit integer default 50) → table (id, sender_id, body, flagged_contact, created_at)`（由新到舊）
  - `unread_conversation_count() → integer`
  - `get_collaboration(p_id)` 最後多一欄 `conversation_id uuid`

- [ ] **Step 1: 寫失敗的測試 `supabase/tests/19_messaging_reads.test.sql`**

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- 841 品牌、842 另一個品牌；851、852 已審核創作者、853 停權創作者；859 管理員（沒有 profile）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000841', 'p7r-b1@test.local'),
  ('00000000-0000-0000-0000-000000000842', 'p7r-b2@test.local'),
  ('00000000-0000-0000-0000-000000000851', 'p7r-c1@test.local'),
  ('00000000-0000-0000-0000-000000000852', 'p7r-c2@test.local'),
  ('00000000-0000-0000-0000-000000000853', 'p7r-c3@test.local'),
  ('00000000-0000-0000-0000-000000000859', 'p7r-admin@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000841', 'brand', '讀取品牌'),
  ('00000000-0000-0000-0000-000000000842', 'brand', '另一個品牌'),
  ('00000000-0000-0000-0000-000000000851', 'creator', '讀取小美'),
  ('00000000-0000-0000-0000-000000000852', 'creator', '讀取阿哲'),
  ('00000000-0000-0000-0000-000000000853', 'creator', '讀取停權');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000859');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000841', '讀取品牌'),
  ('00000000-0000-0000-0000-000000000842', '另一個品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000851', 'p7rmei', 'p7rmei', 'approved'),
  ('00000000-0000-0000-0000-000000000852', 'p7rzhe', 'p7rzhe', 'approved'),
  ('00000000-0000-0000-0000-000000000853', 'p7rgone', 'p7rgone', 'suspended');
-- c841：有訊息；c842：品牌開了但沒傳訊息、沒有合作案；c843：停權創作者、只有合作案；c844：另一個品牌與 851
insert into public.conversations (id, brand_id, creator_id, created_at) values
  ('00000000-0000-0000-0000-00000008c841', '00000000-0000-0000-0000-000000000841', '00000000-0000-0000-0000-000000000851', now() - interval '6 hours'),
  ('00000000-0000-0000-0000-00000008c842', '00000000-0000-0000-0000-000000000841', '00000000-0000-0000-0000-000000000852', now() - interval '5 hours'),
  ('00000000-0000-0000-0000-00000008c843', '00000000-0000-0000-0000-000000000841', '00000000-0000-0000-0000-000000000853', now() - interval '4 hours'),
  ('00000000-0000-0000-0000-00000008c844', '00000000-0000-0000-0000-000000000842', '00000000-0000-0000-0000-000000000851', now() - interval '6 hours');
insert into public.messages (id, conversation_id, sender_id, body, created_at) values
  ('00000000-0000-0000-0000-00000008a001', '00000000-0000-0000-0000-00000008c841', '00000000-0000-0000-0000-000000000851', '嗨', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-00000008a002', '00000000-0000-0000-0000-00000008c841', '00000000-0000-0000-0000-000000000841', '您好', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-00000008a003', '00000000-0000-0000-0000-00000008c841', '00000000-0000-0000-0000-000000000851', '報價多少？', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-00000008a004', '00000000-0000-0000-0000-00000008c844', '00000000-0000-0000-0000-000000000842', '另一個品牌的訊息', now() - interval '30 minutes');
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status) values
  ('00000000-0000-0000-0000-00000008e001', '00000000-0000-0000-0000-000000000841', '00000000-0000-0000-0000-000000000853',
   '00000000-0000-0000-0000-00000008c843', '停權前的邀約', 'x', 1000, 'invited');

-- ── 列表 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000841","role":"authenticated"}', true);
select is(
  (select string_agg(t.counterpart_name, ',' order by t.ordinality) from public.list_my_conversations() with ordinality t),
  '讀取小美,讀取停權,讀取阿哲', '品牌：依最後一則訊息（沒有就用建立時間）由新到舊，含自己開的空對話');
select is(
  (select my_side || '|' || counterpart_handle || '|' || last_body || '|' || last_sender_is_me || '|' || unread_count || '|' || closed
     from public.list_my_conversations() where id = '00000000-0000-0000-0000-00000008c841'),
  'brand|p7rmei|報價多少？|false|2|false', '最後一則訊息、未讀數（對方送的 2 則）');
select is((select closed from public.list_my_conversations() where id = '00000000-0000-0000-0000-00000008c843'),
  true, '創作者停權時對話標記為暫停');
select is(public.unread_conversation_count(), 1, '品牌有 1 個對話有未讀');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000852","role":"authenticated"}', true);
select is((select count(*)::int from public.list_my_conversations()), 0, '創作者看不到品牌開了但還沒傳訊息的空對話');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000853","role":"authenticated"}', true);
select is((select count(*)::int from public.list_my_conversations()), 1, '有合作案的對話即使沒有訊息也看得到');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000851","role":"authenticated"}', true);
select is(
  (select string_agg(t.counterpart_name || ':' || t.unread_count, ',' order by t.ordinality)
     from public.list_my_conversations() with ordinality t),
  '另一個品牌:1,讀取品牌:1', '創作者：看到品牌名稱與各自的未讀數');
select is(public.unread_conversation_count(), 2, '創作者有 2 個對話有未讀');
select lives_ok($$select public.mark_conversation_read('00000000-0000-0000-0000-00000008c841')$$, '標記已讀');
select is((select unread_count from public.list_my_conversations() where id = '00000000-0000-0000-0000-00000008c841'),
  0, '標記後未讀歸零');
select is(public.unread_conversation_count(), 1, '徽章少一個');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000842","role":"authenticated"}', true);
select is((select string_agg(id::text, ',') from public.list_my_conversations()),
  '00000000-0000-0000-0000-00000008c844', '只列自己參與的對話');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select * from public.list_my_conversations()$$, '42501', 'not authenticated', '沒有登入');

-- ── 對話標題 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000842","role":"authenticated"}', true);
select is((select count(*)::int from public.get_conversation('00000000-0000-0000-0000-00000008c841')), 0, '第三方拿不到對話');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000851","role":"authenticated"}', true);
select is(
  (select my_side || '|' || brand_name || '|' || creator_name || '|' || creator_handle || '|' || closed
     from public.get_conversation('00000000-0000-0000-0000-00000008c841')),
  'creator|讀取品牌|讀取小美|p7rmei|false', '創作者拿到對話標題');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000859","role":"authenticated"}', true);
select is((select my_side from public.get_conversation('00000000-0000-0000-0000-00000008c841')), 'admin', '管理員拿得到（唯讀）');

-- ── 訊息分頁 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000841","role":"authenticated"}', true);
select is(
  (select string_agg(t.body, ',' order by t.ordinality)
     from public.list_messages('00000000-0000-0000-0000-00000008c841', null, null, 2) with ordinality t),
  '報價多少？,您好', '第一頁：由新到舊');
select is(
  (select string_agg(t.body, ',' order by t.ordinality)
     from public.list_messages('00000000-0000-0000-0000-00000008c841',
            (select created_at from public.messages where id = '00000000-0000-0000-0000-00000008a002'),
            '00000000-0000-0000-0000-00000008a002', 2) with ordinality t),
  '嗨', '第二頁：從游標之後接著拿');
select is((select count(*)::int from public.list_messages('00000000-0000-0000-0000-00000008c841', null, null, 0)),
  1, 'p_limit 最少 1');
select is((select count(*)::int from public.list_messages('00000000-0000-0000-0000-00000008c841', null, null, 1000)),
  3, 'p_limit 太大時最多 100（這裡全部 3 則）');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000842","role":"authenticated"}', true);
select is((select count(*)::int from public.list_messages('00000000-0000-0000-0000-00000008c841')), 0, '第三方拿不到訊息');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000859","role":"authenticated"}', true);
select is((select count(*)::int from public.list_messages('00000000-0000-0000-0000-00000008c841')), 3, '管理員讀得到');

-- ── 合作案詳情帶出對話 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000841","role":"authenticated"}', true);
select is((select conversation_id from public.get_collaboration('00000000-0000-0000-0000-00000008e001')),
  '00000000-0000-0000-0000-00000008c843'::uuid, 'get_collaboration 回傳 conversation_id');
select ok(not has_function_privilege('anon', 'public.list_my_conversations()', 'EXECUTE'), 'anon 不能呼叫讀取函式');

select * from finish();
rollback;
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx supabase test db`
Expected: `19_messaging_reads.test.sql` 失敗（`function public.list_my_conversations() does not exist`），其他檔案通過。

- [ ] **Step 3: 寫 migration `supabase/migrations/20261126000200_messaging_reads.sql`**

```sql
-- 站內訊息（計畫 7）之二：讀取用的 definer 函式（對話列表、對話標題、訊息分頁、未讀數），
-- 以及 get_collaboration 多回傳 conversation_id（合作案詳情的「前往對話」）。
-- 權限一律在這裡明確寫出（雲端新專案不會自動授權，本機會）。

-- 1. 我的對話列表：只列自己是品牌或創作者的對話（管理員看全部是計畫 9 的後台）。
--    創作者看不到「品牌開了但還沒傳任何訊息、也沒有合作案」的空對話；品牌看得到自己開的空對話。
--    對方的名稱與頭像：品牌讀不到 pending／停權創作者的 profile，所以用 definer 帶出；用 left join，
--    profile 不見時退回「品牌」「創作者」而不是讓整個對話消失（followups 計畫 6「列表用 inner join」一項）。
--    未讀 = 對方送出、而且晚於我的 last_read_at 的訊息數。closed = 創作者不是 approved（對話暫停）。
--    排序：最後一則訊息時間（沒有訊息用對話建立時間）由新到舊。最多 200 筆。
create function public.list_my_conversations()
returns table (
  id uuid,
  my_side text,
  counterpart_name text,
  counterpart_image_path text,
  counterpart_handle text,
  last_body text,
  last_sender_is_me boolean,
  last_at timestamptz,
  unread_count integer,
  closed boolean
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
  select cv.id,
         case when cv.brand_id = v_uid then 'brand' else 'creator' end,
         case when cv.brand_id = v_uid then coalesce(p.display_name, '創作者') else coalesce(bp.brand_name, '品牌') end,
         case when cv.brand_id = v_uid then cp.avatar_path else bp.logo_path end,
         case when cv.brand_id = v_uid then cp.handle else null end,
         left(lm.body, 100),
         lm.sender_id = v_uid,
         coalesce(lm.created_at, cv.created_at),
         (select count(*)::int from public.messages m
           where m.conversation_id = cv.id and m.sender_id <> v_uid
             and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)),
         coalesce(cp.status, '') <> 'approved'
    from public.conversations cv
    left join public.brand_profiles bp on bp.user_id = cv.brand_id
    left join public.creator_profiles cp on cp.user_id = cv.creator_id
    left join public.profiles p on p.id = cv.creator_id
    left join public.conversation_reads r on r.conversation_id = cv.id and r.user_id = v_uid
    left join lateral (
      select m.body, m.sender_id, m.created_at from public.messages m
       where m.conversation_id = cv.id
       order by m.created_at desc, m.id desc
       limit 1
    ) lm on true
   where (cv.brand_id = v_uid or cv.creator_id = v_uid)
     and (cv.brand_id = v_uid
          or lm.created_at is not null
          or exists (select 1 from public.collaborations c where c.conversation_id = cv.id))
   order by coalesce(lm.created_at, cv.created_at) desc, cv.id
   limit 200;
end;
$$;
revoke execute on function public.list_my_conversations() from public, anon, authenticated, service_role;
grant execute on function public.list_my_conversations() to authenticated;

-- 2. 一個對話的標題資料：我是哪一方（brand > creator > admin）、雙方的公開資料、是否暫停。
--    不是參與者也不是管理員：0 列（頁面顯示 404）。
create function public.get_conversation(p_id uuid)
returns table (
  id uuid,
  my_side text,
  brand_id uuid,
  brand_name text,
  brand_logo_path text,
  creator_id uuid,
  creator_name text,
  creator_handle text,
  creator_avatar_path text,
  closed boolean
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
  select cv.id,
         case when cv.brand_id = v_uid then 'brand' when cv.creator_id = v_uid then 'creator' else 'admin' end,
         cv.brand_id, coalesce(bp.brand_name, '品牌'), bp.logo_path,
         cv.creator_id, coalesce(p.display_name, '創作者'), cp.handle, cp.avatar_path,
         coalesce(cp.status, '') <> 'approved'
    from public.conversations cv
    left join public.brand_profiles bp on bp.user_id = cv.brand_id
    left join public.creator_profiles cp on cp.user_id = cv.creator_id
    left join public.profiles p on p.id = cv.creator_id
   where cv.id = p_id
     and (cv.brand_id = v_uid or cv.creator_id = v_uid or public.is_admin());
end;
$$;
revoke execute on function public.get_conversation(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_conversation(uuid) to authenticated;

-- 3. 訊息分頁：由新到舊，(created_at, id) 早於游標的 p_limit 則（1..100，預設 50）。
--    第一頁游標傳 null。只有參與者與管理員拿得到，其他人 0 列。
create function public.list_messages(
  p_conversation_id uuid,
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  sender_id uuid,
  body text,
  flagged_contact boolean,
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
  if not exists (select 1 from public.conversations cv
                  where cv.id = p_conversation_id
                    and (cv.brand_id = v_uid or cv.creator_id = v_uid or public.is_admin())) then
    return;
  end if;
  return query
  select m.id, m.sender_id, m.body, m.flagged_contact, m.created_at
    from public.messages m
   where m.conversation_id = p_conversation_id
     and (p_before_at is null
          or (m.created_at, m.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
   order by m.created_at desc, m.id desc
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;
revoke execute on function public.list_messages(uuid, timestamptz, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.list_messages(uuid, timestamptz, uuid, integer) to authenticated;

-- 4. 導覽列的未讀徽章：有未讀訊息的對話數。沒有登入或不是參與者：0。
create function public.unread_conversation_count() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int
    from public.conversations cv
    left join public.conversation_reads r on r.conversation_id = cv.id and r.user_id = auth.uid()
   where (cv.brand_id = auth.uid() or cv.creator_id = auth.uid())
     and exists (select 1 from public.messages m
                  where m.conversation_id = cv.id and m.sender_id <> auth.uid()
                    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz));
$$;
revoke execute on function public.unread_conversation_count() from public, anon, authenticated, service_role;
grant execute on function public.unread_conversation_count() to authenticated;

-- 5. get_collaboration 多回傳 conversation_id（合作案詳情的「前往對話」）。回傳欄位變了，要先 drop；
--    其餘邏輯與 20261125000300_collab_reads.sql 完全相同。
drop function public.get_collaboration(uuid);
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
  creator_avatar_path text,
  conversation_id uuid
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
         c.creator_id, p.display_name, cp.handle, cp.avatar_path,
         c.conversation_id
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
```

- [ ] **Step 4: 套用 migration、跑測試、產生型別**

```bash
npx supabase migration up
npx supabase test db
npm run db:types
```
Expected: 全部通過（`19` 24 個；`15_collab_reads.test.sql` 的 `get_collaboration` 斷言不受多一欄影響，仍是 22 個）。`database.types.ts` 的 `get_collaboration` Returns 多了 `conversation_id`。

- [ ] **Step 5: 其他檢查與 commit**

`src/lib/collabs/view.ts` 的 `CollabRow` 還沒有 `conversation_id`（Task 3 加），`load.ts` 是先轉成 `unknown` 再轉型，typecheck 仍會過。

```bash
npm run lint && npm run typecheck && npm test
git add supabase/migrations/20261126000200_messaging_reads.sql supabase/tests/19_messaging_reads.test.sql \
  src/lib/supabase/database.types.ts
git commit -m "計畫 7 Task 2：對話列表、標題、訊息分頁、未讀數的讀取函式；合作案詳情帶出對話"
```

---

### Task 3: 純函式：聯絡方式、內文驗證、顯示規則、錯誤對應、導覽列、合作案帶出對話

**Files:**
- Create: `src/lib/messages/contact.ts`、`src/lib/messages/contact.test.ts`、`src/lib/validation/message.ts`、`src/lib/validation/message.test.ts`、`src/lib/messages/view.ts`、`src/lib/messages/view.test.ts`、`src/lib/messages/errors.ts`、`src/lib/messages/errors.test.ts`
- Modify: `src/lib/collabs/view.ts`、`src/lib/collabs/view.test.ts`、`src/components/shell/nav.ts`、`src/components/shell/nav.test.ts`

**Interfaces:**
- Consumes: `cleanTextWithin`（`src/lib/validation/onboarding.ts`）、`hasBadChar`、`textLength`（`src/lib/validation/brief.ts`）、`formatDateTimeTw`（`src/lib/briefs/dates.ts`）。
- Produces（後面的 task 依賴）：
  - `contact.ts`：`type ContactKind = "phone" | "email" | "line" | "link"`、`contactKinds(text): ContactKind[]`、`contactWarning(kinds): string | null`、`CONTACT_LABEL`
  - `validation/message.ts`：`MESSAGE_BODY_MAX = 2000`、`cleanMessageBody(v)`、`validateMessageBody(body): string | null`
  - `messages/view.ts`：`MessageSide`、`MESSAGE_PAGE_SIZE = 50`、`MESSAGES_READ_EVENT`、`ConversationListItem`／`ConversationListRow`／`toConversationListItem`、`previewText`、`listTimeLabel(iso, today)`、`unreadBadgeText(n)`、`messagesHref(side, id?)`、`EMPTY_LIST_TEXT`、`Conversation`／`ConversationRow`／`toConversation`、`counterpartOf(c, side)`、`closedNotice(side)`、`Message`／`MessageRow`／`toMessage`、`mergeMessages(a, b)`、`messageTime(iso)`、`ThreadEntry`／`withDaySeparators(messages)`
  - `messages/errors.ts`：`messageErrorMessage(error): string`
  - `Collab.conversationId: string | null`（`CollabRow.conversation_id?: string | null`）
  - `NavItem.badge?: "messages"`；「訊息」連到 `/brand/messages`、`/creator/messages`

- [ ] **Step 1: 寫失敗的測試**

`src/lib/messages/contact.test.ts`（案例與 `18_messaging_write.test.sql`「B.」相同）：

```ts
import { describe, expect, it } from "vitest";
import { contactKinds, contactWarning } from "./contact";

// 與 supabase/tests/18_messaging_write.test.sql「B. 聯絡方式偵測」相同的案例；改規則時兩邊一起改。
const POSITIVE = [
  "我的電話 0912-345-678", "０９１２３４５６７８", "+886 912 345 678", "(02) 2345-6789", "07-123-4567",
  "mail: Mei.Lin@Example.com.tw", "看 https://foo.bar/x", "www.abc.xyz", "line.me/ti/p/abc", "官網 abc.com 有",
  "LINE ID: mei_123", "ＬＩＮＥ：mei", "加我賴", "加個line吧", "賴: abc", "line@abc",
];
const NEGATIVE = [
  "預算 NT$30,000 元", "2026-11-26 交稿", "deadline: 12/1", "online 直播", "line drawing 風格",
  "abc.comx", "e.g. 這樣", "訂單 123456789", "IG @mei.ig", "09123456789", "加\n\n賴",
];

describe("contactKinds", () => {
  it.each(POSITIVE)("偵測得到：%s", (t) => {
    expect(contactKinds(t).length).toBeGreaterThan(0);
  });
  it.each(NEGATIVE)("不會誤判：%s", (t) => {
    expect(contactKinds(t)).toEqual([]);
  });
  it("分出種類", () => {
    expect(contactKinds("0912-345-678")).toEqual(["phone"]);
    expect(contactKinds("a@b.com")).toEqual(["email", "link"]);
    expect(contactKinds("LINE ID: mei")).toEqual(["line"]);
    expect(contactKinds("https://x.y/z")).toEqual(["link"]);
  });
  it("連續呼叫結果一致（不受 global regex 的 lastIndex 影響）", () => {
    expect(contactKinds("0912345678")).toEqual(["phone"]);
    expect(contactKinds("0912345678")).toEqual(["phone"]);
  });
});

describe("contactWarning", () => {
  it("沒有偵測到回傳 null", () => {
    expect(contactWarning([])).toBeNull();
  });
  it("列出種類", () => {
    expect(contactWarning(["phone", "line"])).toContain("可能含有電話、LINE");
  });
});
```

`src/lib/validation/message.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { cleanMessageBody, MESSAGE_BODY_MAX, validateMessageBody } from "./message";

describe("cleanMessageBody", () => {
  it("CRLF 與 CR 換成 LF、去掉前後空白與零寬字元，保留中間的換行", () => {
    expect(cleanMessageBody("  第一行\r\n第二行\r第三行​  ")).toBe("第一行\n第二行\n第三行");
  });
  it("超長輸入直接截斷（之後的長度檢查一定會擋）", () => {
    const out = cleanMessageBody("字".repeat(10_000));
    expect(validateMessageBody(out)).toBe(`訊息最多 ${MESSAGE_BODY_MAX} 字`);
  });
});

describe("validateMessageBody", () => {
  it("空白", () => {
    expect(validateMessageBody(cleanMessageBody(" \t\n"))).toBe("請輸入訊息");
  });
  it("剛好 2000 字可以、2001 字不行（以 code point 計）", () => {
    expect(validateMessageBody("字".repeat(2000))).toBeNull();
    expect(validateMessageBody("😀".repeat(2000))).toBeNull();
    expect(validateMessageBody("字".repeat(2001))).toBe("訊息最多 2000 字");
  });
  it("雙向控制字元與 NUL", () => {
    expect(validateMessageBody("abc‮")).toBe("含有不允許的特殊字元");
    expect(validateMessageBody("a\u0000b")).toBe("含有不允許的特殊字元");
  });
});
```

`src/lib/messages/view.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import {
  closedNotice, counterpartOf, listTimeLabel, mergeMessages, messagesHref, messageTime, previewText,
  toConversation, toConversationListItem, toMessage, unreadBadgeText, withDaySeparators, type Message,
} from "./view";

const msg = (id: string, createdAt: string, body = id): Message => ({ id, senderId: "u", body, flagged: false, createdAt });

describe("列表", () => {
  it("toConversationListItem：null 欄位有預設值", () => {
    const it0 = toConversationListItem({
      id: "c1", my_side: "brand", counterpart_name: null, counterpart_image_path: null, counterpart_handle: "mei",
      last_body: null, last_sender_is_me: null, last_at: null, unread_count: null, closed: null,
    });
    expect(it0).toEqual({
      id: "c1", side: "brand", counterpartName: "", counterpartImagePath: null, counterpartHandle: "mei",
      lastBody: null, lastSenderIsMe: false, lastAt: "", unread: 0, closed: false,
    });
  });
  it("previewText：換行變空白、最多 40 字、自己送的加「你：」", () => {
    expect(previewText({ lastBody: null, lastSenderIsMe: false })).toBe("還沒有訊息");
    expect(previewText({ lastBody: "第一行\n第二行", lastSenderIsMe: true })).toBe("你：第一行 第二行");
    expect(previewText({ lastBody: "字".repeat(41), lastSenderIsMe: false })).toBe(`${"字".repeat(40)}…`);
  });
  it("listTimeLabel：台灣今天顯示時間，其他天顯示日期", () => {
    // 2026-11-26T01:05:00Z = 台灣 11/26 09:05
    expect(listTimeLabel("2026-11-26T01:05:00Z", "2026-11-26")).toBe("09:05");
    expect(listTimeLabel("2026-11-25T15:59:00Z", "2026-11-26")).toBe("11/25");
    expect(listTimeLabel("2026-11-25T16:00:00Z", "2026-11-26")).toBe("00:00");
    expect(listTimeLabel("壞掉", "2026-11-26")).toBe("");
  });
  it("unreadBadgeText", () => {
    expect(unreadBadgeText(0)).toBeNull();
    expect(unreadBadgeText(-1)).toBeNull();
    expect(unreadBadgeText(3)).toBe("3");
    expect(unreadBadgeText(10)).toBe("9+");
  });
  it("messagesHref", () => {
    expect(messagesHref("brand")).toBe("/brand/messages");
    expect(messagesHref("creator", "c1")).toBe("/creator/messages/c1");
  });
});

describe("對話", () => {
  const c = toConversation({
    id: "c1", my_side: "x", brand_id: "b", brand_name: "花粉", brand_logo_path: "b/logo.png", creator_id: "u",
    creator_name: "小美", creator_handle: "mei", creator_avatar_path: null, closed: true,
  });
  it("toConversation：my_side 不是 brand／creator 就是 admin", () => {
    expect(c).toMatchObject({ side: "admin", brandName: "花粉", creatorHandle: "mei", closed: true });
  });
  it("counterpartOf：品牌看到創作者、創作者看到品牌", () => {
    expect(counterpartOf(c, "brand")).toEqual({ name: "小美", imagePath: null, handle: "mei" });
    expect(counterpartOf(c, "creator")).toEqual({ name: "花粉", imagePath: "b/logo.png", handle: null });
  });
  it("closedNotice", () => {
    expect(closedNotice("brand")).toContain("停權");
    expect(closedNotice("creator")).toContain("你的帳號");
  });
});

describe("訊息", () => {
  it("toMessage", () => {
    expect(toMessage({ id: "m1", sender_id: null, body: null, flagged_contact: true, created_at: null }))
      .toEqual({ id: "m1", senderId: "", body: "", flagged: true, createdAt: "" });
  });
  it("mergeMessages：依 id 去重、依時間再依 id 由舊到新", () => {
    const a = [msg("b", "2026-11-26T01:00:00Z"), msg("c", "2026-11-26T02:00:00Z")];
    const b = [msg("c", "2026-11-26T02:00:00Z", "新版"), msg("a", "2026-11-26T01:00:00Z"), msg("d", "2026-11-26T00:00:00Z")];
    const out = mergeMessages(a, b);
    expect(out.map((m) => m.id)).toEqual(["d", "a", "b", "c"]);
    expect(out[3].body).toBe("新版");
  });
  it("messageTime：台灣時間", () => {
    expect(messageTime("2026-11-26T01:05:00Z")).toBe("09:05");
    expect(messageTime("")).toBe("");
  });
  it("withDaySeparators：台灣日期改變時插入分隔線", () => {
    const out = withDaySeparators([
      msg("a", "2026-11-25T15:00:00Z"), // 台灣 11/25 23:00
      msg("b", "2026-11-25T16:30:00Z"), // 台灣 11/26 00:30
      msg("c", "2026-11-26T01:00:00Z"),
    ]);
    expect(out.map((e) => (e.kind === "day" ? e.label : e.key))).toEqual(["2026/11/25", "a", "2026/11/26", "b", "c"]);
  });
});
```

`src/lib/messages/errors.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { messageErrorMessage } from "./errors";

describe("messageErrorMessage", () => {
  it("認得的錯誤轉成中文", () => {
    expect(messageErrorMessage({ code: "54000", message: "too many messages" })).toBe("傳送太頻繁，請稍候一分鐘再試");
    expect(messageErrorMessage({ code: "55000", message: "conversation closed" })).toBe("對話已暫停，無法傳送訊息");
    expect(messageErrorMessage({ code: "P0002", message: "creator not found" })).toContain("找不到這位創作者");
  });
  it("其他錯誤（含原型鏈上的鍵）一律是通用訊息", () => {
    expect(messageErrorMessage({ message: "boom" })).toBe("發生錯誤，請稍後再試");
    expect(messageErrorMessage({ message: "toString" })).toBe("發生錯誤，請稍後再試");
    expect(messageErrorMessage({})).toBe("發生錯誤，請稍後再試");
  });
});
```

`src/components/shell/nav.test.ts` 檔尾加上：

```ts
describe("訊息（計畫 7）", () => {
  it("品牌與創作者的「訊息」已開放並顯示未讀徽章，對話頁也會亮起", () => {
    expect(BRAND_NAV.find((i) => i.label === "訊息")).toMatchObject({ href: "/brand/messages", badge: "messages" });
    expect(CREATOR_NAV.find((i) => i.label === "訊息")).toMatchObject({ href: "/creator/messages", badge: "messages" });
    expect(isActive("/brand/messages", "/brand/messages/00000000-0000-0000-0000-000000000001")).toBe(true);
    expect(BRAND_NAV.filter((i) => i.badge).length).toBe(1);
  });
});
```

`src/lib/collabs/view.test.ts`「詳情」第一個測試的期望改成（多檢查 `conversationId`）：

```ts
    expect(c).toMatchObject({ title: "案", deliverables: "", amount: 4500, status: "in_review", side: "admin", conversationId: null });
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test`
Expected: 新的四個檔案失敗（找不到模組），`nav.test.ts` 的新測試失敗（`href` 是 null），`collabs/view.test.ts` 失敗（沒有 `conversationId`）。

- [ ] **Step 3: 實作**

`src/lib/messages/contact.ts`：

```ts
// 聯絡方式偵測（送出前提醒用）。規則與 supabase/migrations/20261126000100_messaging_write.sql 的 has_contact_info
// 完全相同；改一邊就要改另一邊，並更新兩邊共用的測試案例（contact.test.ts、18_messaging_write.test.sql）。
// 先 NFKC 正規化再轉小寫；電話另外去掉空白、Tab、括號、點、連字號。資料庫的 trigger 才是最後的判斷。

export type ContactKind = "phone" | "email" | "line" | "link";

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/;
const LINK_RES = [
  /(https?:\/\/|www\.)/,
  /[a-z0-9-]\.(com|net|org|tw|me|io|co|cc|ly|gl|app|link|page|site)([^a-z0-9]|$)/,
];
const LINE_RES = [/(^|[^a-z])line[ \t]*(id|[:@])/, /加[^\n]{0,2}(賴|line)/, /賴[ \t]*(id|[:@])/];
const PHONE_STRIP_RE = /[ \t().-]/g;
const PHONE_RES = [/(^|[^0-9])(\+?886|0)9[0-9]{8}([^0-9]|$)/, /(^|[^0-9])0[2-8][0-9]{7,8}([^0-9]|$)/];

export const CONTACT_LABEL: Record<ContactKind, string> = {
  phone: "電話",
  email: "Email",
  line: "LINE",
  link: "外部連結",
};

/** 訊息裡可能含有的聯絡方式（依電話、Email、LINE、外部連結的順序）；沒有回傳空陣列。 */
export function contactKinds(text: string): ContactKind[] {
  const v = text.normalize("NFKC").toLowerCase();
  const digits = v.replace(PHONE_STRIP_RE, "");
  const kinds: ContactKind[] = [];
  if (PHONE_RES.some((r) => r.test(digits))) kinds.push("phone");
  if (EMAIL_RE.test(v)) kinds.push("email");
  if (LINE_RES.some((r) => r.test(v))) kinds.push("line");
  if (LINK_RES.some((r) => r.test(v))) kinds.push("link");
  return kinds;
}

/** 送出前的提醒文字；沒有偵測到回傳 null。 */
export function contactWarning(kinds: ContactKind[]): string | null {
  if (kinds.length === 0) return null;
  const what = kinds.map((k) => CONTACT_LABEL[k]).join("、");
  return `這則訊息可能含有${what}。為了保障雙方權益，請在平台內溝通與付款；仍可送出，但平台會留存紀錄。`;
}
```

`src/lib/validation/message.ts`：

```ts
// 訊息內文的清理與驗證。規則與資料庫的 send_message（20261126000100_messaging_write.sql）一致：
// CRLF／CR → LF、clean_text、不可有 bidi（JS 另外擋 NUL）、1–2000 字（以 code point 計）。資料庫是最後防線。
import { hasBadChar, textLength } from "./brief";
import { cleanTextWithin } from "./onboarding";

export const MESSAGE_BODY_MAX = 2000;
// 清理前的截斷長度：至少要是上限的兩倍以上（cleanTextWithin 的規則）
const RAW_LIMIT = 4800;

export function cleanMessageBody(v: string): string {
  return cleanTextWithin(v.replace(/\r\n?/g, "\n"), RAW_LIMIT);
}

/** 已清理的內文；錯誤時回傳畫面文字，沒問題回傳 null。 */
export function validateMessageBody(body: string): string | null {
  if (body === "") return "請輸入訊息";
  if (hasBadChar(body)) return "含有不允許的特殊字元";
  if (textLength(body) > MESSAGE_BODY_MAX) return `訊息最多 ${MESSAGE_BODY_MAX} 字`;
  return null;
}
```

`src/lib/messages/view.ts`：

```ts
// 站內訊息的顯示規則與 Row → 顯示物件。RPC 的回傳型別把欄位都標成非 null，實際上可能是 null，
// 所以這裡的 Row 型別欄位都可為 null，呼叫端先轉成 unknown 再轉型。
import { formatDateTimeTw } from "@/lib/briefs/dates";

export type MessageSide = "brand" | "creator";

/** 開啟對話時第一頁、與每次「載入較早的訊息」的則數。 */
export const MESSAGE_PAGE_SIZE = 50;
/** 標記已讀成功後在 window 發出的事件；導覽列的未讀徽章收到後重新查詢。 */
export const MESSAGES_READ_EVENT = "kollink:messages-read";
const PREVIEW_MAX = 40;

function toSide(v: unknown): MessageSide {
  return v === "brand" ? "brand" : "creator";
}

// ── 列表 ──

export type ConversationListItem = {
  id: string;
  side: MessageSide;
  counterpartName: string;
  counterpartImagePath: string | null;
  counterpartHandle: string | null;
  lastBody: string | null;
  lastSenderIsMe: boolean;
  lastAt: string;
  unread: number;
  closed: boolean;
};

export type ConversationListRow = {
  id: string;
  my_side: string | null;
  counterpart_name: string | null;
  counterpart_image_path: string | null;
  counterpart_handle: string | null;
  last_body: string | null;
  last_sender_is_me: boolean | null;
  last_at: string | null;
  unread_count: number | null;
  closed: boolean | null;
};

export function toConversationListItem(r: ConversationListRow): ConversationListItem {
  return {
    id: r.id,
    side: toSide(r.my_side),
    counterpartName: r.counterpart_name ?? "",
    counterpartImagePath: r.counterpart_image_path ?? null,
    counterpartHandle: r.counterpart_handle ?? null,
    lastBody: r.last_body ?? null,
    lastSenderIsMe: r.last_sender_is_me ?? false,
    lastAt: r.last_at ?? "",
    unread: r.unread_count ?? 0,
    closed: r.closed ?? false,
  };
}

/** 列表的預覽：換行改成空白、最多 40 字（以 code point 計），自己送的加「你：」。 */
export function previewText(it: Pick<ConversationListItem, "lastBody" | "lastSenderIsMe">): string {
  if (!it.lastBody) return "還沒有訊息";
  const flat = it.lastBody.replace(/\s+/g, " ").trim();
  const cps = [...flat];
  const short = cps.length > PREVIEW_MAX ? `${cps.slice(0, PREVIEW_MAX).join("")}…` : flat;
  return it.lastSenderIsMe ? `你：${short}` : short;
}

/** 列表的時間：台灣今天顯示 HH:mm，其他天顯示 MM/DD。today 是伺服器算好的 YYYY-MM-DD。 */
export function listTimeLabel(iso: string, today: string): string {
  if (Number.isNaN(Date.parse(iso))) return "";
  const t = formatDateTimeTw(iso); // YYYY/MM/DD HH:mm
  return t.slice(0, 10) === today.replaceAll("-", "/") ? t.slice(11) : t.slice(5, 10);
}

/** 未讀徽章：0 不顯示、超過 9 顯示 9+。 */
export function unreadBadgeText(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 9 ? "9+" : String(Math.floor(n));
}

export function messagesHref(side: MessageSide, id?: string): string {
  return id ? `/${side}/messages/${id}` : `/${side}/messages`;
}

export const EMPTY_LIST_TEXT: Record<MessageSide, string> = {
  brand: "還沒有對話。到創作者的公開頁按「傳訊息」開始聊聊。",
  creator: "還沒有對話。品牌傳訊息、錄取或邀請你之後，對話會出現在這裡。",
};

// ── 對話 ──

export type Conversation = {
  id: string;
  side: MessageSide | "admin";
  brandId: string;
  brandName: string;
  brandLogoPath: string | null;
  creatorId: string;
  creatorName: string;
  creatorHandle: string | null;
  creatorAvatarPath: string | null;
  closed: boolean;
};

export type ConversationRow = {
  id: string;
  my_side: string | null;
  brand_id: string | null;
  brand_name: string | null;
  brand_logo_path: string | null;
  creator_id: string | null;
  creator_name: string | null;
  creator_handle: string | null;
  creator_avatar_path: string | null;
  closed: boolean | null;
};

export function toConversation(r: ConversationRow): Conversation {
  return {
    id: r.id,
    side: r.my_side === "brand" || r.my_side === "creator" ? r.my_side : "admin",
    brandId: r.brand_id ?? "",
    brandName: r.brand_name ?? "",
    brandLogoPath: r.brand_logo_path ?? null,
    creatorId: r.creator_id ?? "",
    creatorName: r.creator_name ?? "",
    creatorHandle: r.creator_handle ?? null,
    creatorAvatarPath: r.creator_avatar_path ?? null,
    closed: r.closed ?? false,
  };
}

/** 對方：品牌視角是創作者，創作者視角是品牌。 */
export function counterpartOf(c: Conversation, side: MessageSide): { name: string; imagePath: string | null; handle: string | null } {
  return side === "brand"
    ? { name: c.creatorName, imagePath: c.creatorAvatarPath, handle: c.creatorHandle }
    : { name: c.brandName, imagePath: c.brandLogoPath, handle: null };
}

/** 對話暫停（創作者不是 approved）時輸入區的說明。 */
export function closedNotice(side: MessageSide): string {
  return side === "brand" ? "這位創作者的帳號目前停權，對話暫停。" : "你的帳號目前停權，暫時無法傳送訊息。";
}

// ── 訊息 ──

export type Message = { id: string; senderId: string; body: string; flagged: boolean; createdAt: string };

export type MessageRow = {
  id: string;
  sender_id: string | null;
  body: string | null;
  flagged_contact: boolean | null;
  created_at: string | null;
};

export function toMessage(r: MessageRow): Message {
  return {
    id: r.id,
    senderId: r.sender_id ?? "",
    body: r.body ?? "",
    flagged: r.flagged_contact ?? false,
    createdAt: r.created_at ?? "",
  };
}

function compareMessages(a: Message, b: Message): number {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  if (ta !== tb) return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** 合併兩批訊息：依 id 去重（後者優先），依 (createdAt, id) 由舊到新。 */
export function mergeMessages(a: Message[], b: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const m of a) byId.set(m.id, m);
  for (const m of b) byId.set(m.id, m);
  return [...byId.values()].sort(compareMessages);
}

/** 訊息下方的時間（台灣時間 HH:mm）。 */
export function messageTime(iso: string): string {
  if (Number.isNaN(Date.parse(iso))) return "";
  return formatDateTimeTw(iso).slice(11);
}

export type ThreadEntry =
  | { kind: "day"; key: string; label: string }
  | { kind: "message"; key: string; message: Message };

/** 在台灣日期改變的地方插入日期分隔線（2026/11/26）。 */
export function withDaySeparators(messages: Message[]): ThreadEntry[] {
  const out: ThreadEntry[] = [];
  let lastDay = "";
  for (const m of messages) {
    const day = Number.isNaN(Date.parse(m.createdAt)) ? "" : formatDateTimeTw(m.createdAt).slice(0, 10);
    if (day && day !== lastDay) {
      out.push({ kind: "day", key: `day-${day}`, label: day });
      lastDay = day;
    }
    out.push({ kind: "message", key: m.id, message: m });
  }
  return out;
}
```

`src/lib/messages/errors.ts`：

```ts
// 訊息相關 definer 函式（20261126000100、000200）的錯誤 → 畫面文字。
type DbError = { code?: string; message?: string };

const MESSAGES: Record<string, string> = {
  "not authenticated": "登入已逾時，請重新登入",
  "not a brand": "只有品牌可以主動傳訊息",
  "creator not found": "找不到這位創作者，或對方還沒通過審核",
  "conversation not found": "找不到這個對話",
  "conversation closed": "對話已暫停，無法傳送訊息",
  "invalid body": "訊息不能空白、最多 2000 字，也不能含特殊控制字元",
  "too many messages": "傳送太頻繁，請稍候一分鐘再試",
  "too many conversations": "今天開啟的新對話已達上限，請明天再試",
};

export function messageErrorMessage(error: DbError): string {
  const m = error.message ?? "";
  return Object.hasOwn(MESSAGES, m) ? MESSAGES[m] : "發生錯誤，請稍後再試";
}
```

`src/components/shell/nav.ts`：`NavItem` 加上 `badge`，兩個「訊息」改成連結：

```ts
/** href 為 null 代表「即將推出」；badge 為 "messages" 時在圖示右上角顯示未讀對話數（計畫 7）。 */
export type NavItem = { label: string; href: string | null; icon: NavIconName; badge?: "messages" };
```
```ts
  { label: "訊息", href: "/brand/messages", icon: "MessageCircle", badge: "messages" },
```
```ts
  { label: "訊息", href: "/creator/messages", icon: "MessageCircle", badge: "messages" },
```
（原本是 `export type NavItem = { label: string; href: string | null; icon: NavIconName }; // href 為 null 代表「即將推出」` 與兩行 `{ label: "訊息", href: null, icon: "MessageCircle" },`。）

`src/lib/collabs/view.ts`：

1. `Collab` 型別最後（`creatorAvatarPath: string | null;` 之後）加：
```ts
  /** 這個合作案所在的對話（計畫 7「前往對話」）。 */
  conversationId: string | null;
```
2. `CollabRow` 型別最後（`creator_avatar_path: string | null;` 之後）加：
```ts
  /** 計畫 7 起 get_collaboration 才有這一欄；選填，讓舊的測試 literal 不必改。 */
  conversation_id?: string | null;
```
3. `toCollab` 回傳物件最後（`creatorAvatarPath: r.creator_avatar_path ?? null,` 之後）加：
```ts
    conversationId: r.conversation_id ?? null,
```

- [ ] **Step 4: 跑測試確認通過、commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/lib/messages/contact.ts src/lib/messages/contact.test.ts src/lib/validation/message.ts src/lib/validation/message.test.ts \
  src/lib/messages/view.ts src/lib/messages/view.test.ts src/lib/messages/errors.ts src/lib/messages/errors.test.ts \
  src/lib/collabs/view.ts src/lib/collabs/view.test.ts src/components/shell/nav.ts src/components/shell/nav.test.ts
git commit -m "計畫 7 Task 3：聯絡方式偵測、內文驗證、訊息顯示規則、錯誤對應、導覽列「訊息」"
```
Expected: 全過。導覽列「訊息」此時連到還不存在的頁面（Task 6 才建立），本機點了會 404，這個 task 不驗畫面。本計畫撰寫時這些檔案已在 repo 的暫存複本跑過 `tsc`、`eslint`、`vitest`，全部通過。

---

### Task 4: 伺服器端讀取與 Server Actions

**Files:**
- Create: `src/lib/messages/load.ts`、`src/lib/messages/load.test.ts`、`src/lib/messages/actions.ts`、`src/lib/messages/actions.test.ts`、`src/app/brand/messages/actions.ts`、`src/app/brand/messages/actions.test.ts`

**Interfaces:**
- Consumes: Task 1–2 的 RPC、Task 3 的純函式、`getCurrentUser`／`requireRole`、`createClient`（server）、`isUuid`、`toCollabStatus`。
- Produces：
  - `loadMyConversations(): Promise<ConversationListItem[]>`
  - `loadThread(id): Promise<ThreadData | null>`；`ThreadData = { conversation: Conversation; messages: Message[]; hasMore: boolean; collabs: ConversationCollab[] }`、`ConversationCollab = { id; title; status: CollabStatus }`
  - `loadOlderMessages(id, beforeAt, beforeId): Promise<MessagePage>`；`MessagePage = { messages: Message[]; hasMore: boolean }`
  - `sendMessageAction(conversationId, body) → SendResult`（`{ ok: true; message: Message } | { ok: false; error }`）
  - `markReadAction(conversationId) → ActionResult`
  - `loadOlderMessagesAction(conversationId, beforeAt, beforeId) → OlderResult`（`{ ok: true; messages; hasMore } | { ok: false; error }`）
  - `startConversationAction(prev: StartState, fd)`（欄位 `creatorId`；成功 redirect `/brand/messages/<id>`；`StartState = { error?: string }`）

- [ ] **Step 1: 寫失敗的測試**

`src/lib/messages/load.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from }) }));

import { loadMyConversations, loadOlderMessages, loadThread } from "./load";

const ID = "00000000-0000-0000-0000-00000008c001";

function collabsQuery(data: unknown[]) {
  const q = { select: () => q, eq: () => q, order: async () => ({ data, error: null }) };
  return q;
}
const row = (n: number) => ({
  id: `m${n}`, sender_id: "u", body: `第 ${n} 則`, flagged_contact: false,
  created_at: new Date(Date.UTC(2026, 10, 26, 0, n)).toISOString(),
});

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

describe("loadMyConversations", () => {
  it("呼叫 list_my_conversations 並轉成顯示物件", async () => {
    rpc.mockResolvedValue({ data: [{ id: "c1", my_side: "creator", counterpart_name: "花粉", unread_count: 2 }], error: null });
    const items = await loadMyConversations();
    expect(rpc).toHaveBeenCalledWith("list_my_conversations");
    expect(items[0]).toMatchObject({ id: "c1", side: "creator", counterpartName: "花粉", unread: 2 });
  });
  it("錯誤往上丟", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(loadMyConversations()).rejects.toThrow("boom");
  });
});

describe("loadThread", () => {
  it("看不到時回傳 null，不再查其他資料", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await loadThread(ID)).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });
  it("第一頁多拿一則判斷 hasMore，回傳由舊到新；帶出合作案", async () => {
    // list_messages 由新到舊回傳 51 則（m51 … m1）
    const rows = Array.from({ length: 51 }, (_, i) => row(51 - i));
    rpc.mockImplementation(async (fn: string) => fn === "get_conversation"
      ? { data: [{ id: ID, my_side: "brand", creator_name: "小美", closed: false }], error: null }
      : { data: rows, error: null });
    from.mockReturnValue(collabsQuery([{ id: "k1", title: "春季開箱", status: "in_review" }]));
    const d = await loadThread(ID);
    expect(rpc).toHaveBeenCalledWith("list_messages", { p_conversation_id: ID, p_limit: 51 });
    expect(from).toHaveBeenCalledWith("collaborations");
    expect(d?.conversation).toMatchObject({ id: ID, side: "brand", creatorName: "小美" });
    expect(d?.hasMore).toBe(true);
    expect(d?.messages).toHaveLength(50);
    expect(d?.messages[0].id).toBe("m2");
    expect(d?.messages[49].id).toBe("m51");
    expect(d?.collabs).toEqual([{ id: "k1", title: "春季開箱", status: "in_review" }]);
  });
});

describe("loadOlderMessages", () => {
  it("帶游標呼叫、不足一頁時 hasMore 為 false", async () => {
    rpc.mockResolvedValue({ data: [row(2), row(1)], error: null });
    const page = await loadOlderMessages(ID, "2026-11-26T00:03:00.000Z", "m3");
    expect(rpc).toHaveBeenCalledWith("list_messages", {
      p_conversation_id: ID, p_limit: 51, p_before_at: "2026-11-26T00:03:00.000Z", p_before_id: "m3",
    });
    expect(page).toEqual({ hasMore: false, messages: [expect.objectContaining({ id: "m1" }), expect.objectContaining({ id: "m2" })] });
  });
});
```

`src/lib/messages/actions.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, rpc, loadOlderMessages } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), rpc: vi.fn(), loadOlderMessages: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
vi.mock("./load", () => ({ loadOlderMessages }));

import { loadOlderMessagesAction, markReadAction, sendMessageAction } from "./actions";

const CONV = "00000000-0000-0000-0000-00000008c001";
const MSG = "00000000-0000-0000-0000-00000008a001";

beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue({ id: "u1", profile: { role: "creator", displayName: "小美" } });
  rpc.mockReset();
  loadOlderMessages.mockReset();
});

describe("sendMessageAction", () => {
  it("清理內文後呼叫 send_message，回傳資料庫寫入的訊息", async () => {
    rpc.mockResolvedValue({
      data: [{ id: MSG, conversation_id: CONV, sender_id: "u1", body: "第一行\n第二行", flagged_contact: false, created_at: "2026-11-26T01:00:00Z" }],
      error: null,
    });
    const res = await sendMessageAction(CONV, "  第一行\r\n第二行  ");
    expect(rpc).toHaveBeenCalledWith("send_message", { p_conversation_id: CONV, p_body: "第一行\n第二行" });
    expect(res).toEqual({ ok: true, message: { id: MSG, senderId: "u1", body: "第一行\n第二行", flagged: false, createdAt: "2026-11-26T01:00:00Z" } });
  });
  it("沒有登入或不是品牌／創作者", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await sendMessageAction(CONV, "嗨")).toEqual({ ok: false, error: "登入已逾時，請重新登入" });
    getCurrentUser.mockResolvedValue({ id: "a", profile: null });
    expect(await sendMessageAction(CONV, "嗨")).toEqual({ ok: false, error: "登入已逾時，請重新登入" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("參數型別不對、內文空白或太長：不呼叫資料庫", async () => {
    expect(await sendMessageAction("not-a-uuid", "嗨")).toMatchObject({ ok: false, error: "資料格式不正確，請重新整理頁面" });
    expect(await sendMessageAction(CONV, 123)).toMatchObject({ ok: false });
    expect(await sendMessageAction(CONV, " \n ")).toEqual({ ok: false, error: "請輸入訊息" });
    expect(await sendMessageAction(CONV, "字".repeat(2001))).toEqual({ ok: false, error: "訊息最多 2000 字" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("資料庫錯誤轉成中文", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "54000", message: "too many messages" } });
    expect(await sendMessageAction(CONV, "嗨")).toEqual({ ok: false, error: "傳送太頻繁，請稍候一分鐘再試" });
  });
});

describe("markReadAction", () => {
  it("呼叫 mark_conversation_read", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await markReadAction(CONV)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("mark_conversation_read", { p_conversation_id: CONV });
  });
  it("id 不對不呼叫；資料庫錯誤轉成中文", async () => {
    expect(await markReadAction("x")).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "conversation not found" } });
    expect(await markReadAction(CONV)).toEqual({ ok: false, error: "找不到這個對話" });
  });
});

describe("loadOlderMessagesAction", () => {
  it("檢查游標後讀取", async () => {
    loadOlderMessages.mockResolvedValue({ messages: [], hasMore: false });
    expect(await loadOlderMessagesAction(CONV, "2026-11-26T01:00:00Z", MSG)).toEqual({ ok: true, messages: [], hasMore: false });
    expect(loadOlderMessages).toHaveBeenCalledWith(CONV, "2026-11-26T01:00:00Z", MSG);
  });
  it("游標格式不對不讀取", async () => {
    expect(await loadOlderMessagesAction(CONV, "昨天", MSG)).toMatchObject({ ok: false });
    expect(await loadOlderMessagesAction(CONV, "2026-11-26T01:00:00Z", "m1")).toMatchObject({ ok: false });
    expect(loadOlderMessages).not.toHaveBeenCalled();
  });
  it("讀取失敗回傳通用訊息", async () => {
    loadOlderMessages.mockRejectedValue(new Error("boom"));
    expect(await loadOlderMessagesAction(CONV, "2026-11-26T01:00:00Z", MSG)).toEqual({ ok: false, error: "發生錯誤，請稍後再試" });
  });
});
```

`src/app/brand/messages/actions.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, rpc, redirect } = vi.hoisted(() => ({
  requireRole: vi.fn(), rpc: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/current-user", () => ({ requireRole }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { startConversationAction } from "./actions";

const CREATOR = "00000000-0000-0000-0000-000000000811";
const CONV = "00000000-0000-0000-0000-00000008c001";

function form(o: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
  return f;
}

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: "brand-1" });
  rpc.mockReset();
  redirect.mockClear();
});

describe("startConversationAction", () => {
  it("開啟對話後導到對話頁", async () => {
    rpc.mockResolvedValue({ data: CONV, error: null });
    await expect(startConversationAction({}, form({ creatorId: CREATOR }))).rejects.toThrow(`REDIRECT /brand/messages/${CONV}`);
    expect(requireRole).toHaveBeenCalledWith("brand");
    expect(rpc).toHaveBeenCalledWith("start_conversation", { p_creator_id: CREATOR });
  });
  it("creatorId 不是 UUID 不呼叫資料庫", async () => {
    expect(await startConversationAction({}, form({ creatorId: "x" }))).toEqual({ error: "資料格式不正確，請重新整理頁面" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("資料庫錯誤轉成中文", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "creator not found" } });
    expect(await startConversationAction({}, form({ creatorId: CREATOR }))).toEqual({ error: "找不到這位創作者，或對方還沒通過審核" });
    expect(redirect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test`
Expected: 三個新檔案失敗（找不到模組）。

- [ ] **Step 3: 實作**

`src/lib/messages/load.ts`：

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toCollabStatus, type CollabStatus } from "@/lib/collabs/view";
import {
  MESSAGE_PAGE_SIZE, toConversation, toConversationListItem, toMessage,
  type Conversation, type ConversationListItem, type ConversationListRow, type ConversationRow,
  type Message, type MessageRow,
} from "./view";

// 站內訊息的伺服器端讀取。全部用使用者自己的 client（definer 函式與 RLS 自己檢查身分）。
// 會讀 cookie：只能在 requireRole 之後呼叫。不快取。

/** 我的對話（最後一則訊息由新到舊；最多 200 筆）。 */
export async function loadMyConversations(): Promise<ConversationListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_conversations");
  if (error) throw error;
  return ((data ?? []) as unknown as ConversationListRow[]).map(toConversationListItem);
}

export type ConversationCollab = { id: string; title: string; status: CollabStatus };
export type ThreadData = { conversation: Conversation; messages: Message[]; hasMore: boolean; collabs: ConversationCollab[] };
export type MessagePage = { messages: Message[]; hasMore: boolean };

/** list_messages 是由新到舊；多拿一則判斷還有沒有更早的，回傳由舊到新。 */
async function fetchPage(id: string, before: { at: string; id: string } | null): Promise<MessagePage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_messages", {
    p_conversation_id: id,
    p_limit: MESSAGE_PAGE_SIZE + 1,
    ...(before ? { p_before_at: before.at, p_before_id: before.id } : {}),
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown as MessageRow[];
  return {
    messages: rows.slice(0, MESSAGE_PAGE_SIZE).map(toMessage).reverse(),
    hasMore: rows.length > MESSAGE_PAGE_SIZE,
  };
}

/** 一個對話：標題、最新 50 則訊息、這個對話的合作案。不是參與者（也不是管理員）或不存在回傳 null。 */
export async function loadThread(id: string): Promise<ThreadData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_conversation", { p_id: id });
  if (error) throw error;
  const row = ((data ?? []) as unknown as ConversationRow[])[0];
  if (!row) return null;

  const [page, collabs] = await Promise.all([
    fetchPage(id, null),
    supabase.from("collaborations").select("id, title, status").eq("conversation_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (collabs.error) throw collabs.error;
  return {
    conversation: toConversation(row),
    messages: page.messages,
    hasMore: page.hasMore,
    collabs: (collabs.data ?? []).map((c) => ({ id: c.id, title: c.title, status: toCollabStatus(c.status) })),
  };
}

/** 比 (beforeAt, beforeId) 更早的 50 則（由舊到新）。 */
export async function loadOlderMessages(id: string, beforeAt: string, beforeId: string): Promise<MessagePage> {
  return fetchPage(id, { at: beforeAt, id: beforeId });
}
```

`src/lib/messages/actions.ts`：

```ts
"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/briefs/query";
import { cleanMessageBody, validateMessageBody } from "@/lib/validation/message";
import { messageErrorMessage } from "./errors";
import { loadOlderMessages } from "./load";
import { toMessage, type Message, type MessageRow } from "./view";

// 品牌與創作者共用的訊息 actions。requireRole 只能指定一種角色，所以這裡用 getCurrentUser 確認是品牌或創作者；
// 是不是這個對話的參與者由資料庫函式檢查。不 revalidate：畫面由 ThreadView 自己更新、列表由 Realtime 觸發 refresh。

const BAD_INPUT = "資料格式不正確，請重新整理頁面";
const SIGNED_OUT = "登入已逾時，請重新登入";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SendResult = { ok: true; message: Message } | { ok: false; error: string };
export type OlderResult = { ok: true; messages: Message[]; hasMore: boolean } | { ok: false; error: string };

async function isMessagingUser(): Promise<boolean> {
  const role = (await getCurrentUser())?.profile?.role;
  return role === "brand" || role === "creator";
}

/** 送出訊息。回傳資料庫寫入的那一則（含 trigger 算好的 flagged_contact）。 */
export async function sendMessageAction(conversationId: unknown, body: unknown): Promise<SendResult> {
  if (!(await isMessagingUser())) return { ok: false, error: SIGNED_OUT };
  if (!isUuid(conversationId) || typeof body !== "string") return { ok: false, error: BAD_INPUT };
  const clean = cleanMessageBody(body);
  const err = validateMessageBody(clean);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_message", { p_conversation_id: conversationId, p_body: clean });
  if (error) return { ok: false, error: messageErrorMessage(error) };
  const row = ((data ?? []) as unknown as MessageRow[])[0];
  if (!row) return { ok: false, error: messageErrorMessage({}) };
  return { ok: true, message: toMessage(row) };
}

/** 標記已讀（開啟對話、收到對方訊息時由 ThreadView 呼叫）。 */
export async function markReadAction(conversationId: unknown): Promise<ActionResult> {
  if (!(await isMessagingUser())) return { ok: false, error: SIGNED_OUT };
  if (!isUuid(conversationId)) return { ok: false, error: BAD_INPUT };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
  if (error) return { ok: false, error: messageErrorMessage(error) };
  return { ok: true };
}

/** 載入比目前最早一則更早的 50 則。 */
export async function loadOlderMessagesAction(conversationId: unknown, beforeAt: unknown, beforeId: unknown): Promise<OlderResult> {
  if (!(await isMessagingUser())) return { ok: false, error: SIGNED_OUT };
  if (!isUuid(conversationId) || !isUuid(beforeId) || typeof beforeAt !== "string" || Number.isNaN(Date.parse(beforeAt))) {
    return { ok: false, error: BAD_INPUT };
  }
  try {
    const page = await loadOlderMessages(conversationId, beforeAt, beforeId);
    return { ok: true, ...page };
  } catch (e) {
    return { ok: false, error: messageErrorMessage(e as { message?: string }) };
  }
}
```

`src/app/brand/messages/actions.ts`：

```ts
"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/briefs/query";
import { messageErrorMessage } from "@/lib/messages/errors";

export type StartState = { error?: string };

/** 公開頁的「傳訊息」：開啟（或找到既有的）對話後導過去。 */
export async function startConversationAction(_prev: StartState, fd: FormData): Promise<StartState> {
  await requireRole("brand");
  const creatorId = fd.get("creatorId");
  if (!isUuid(creatorId)) return { error: "資料格式不正確，請重新整理頁面" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_conversation", { p_creator_id: creatorId });
  if (error) return { error: messageErrorMessage(error) };
  redirect(`/brand/messages/${data as unknown as string}`);
}
```

- [ ] **Step 4: 跑測試確認通過、commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/lib/messages/load.ts src/lib/messages/load.test.ts src/lib/messages/actions.ts src/lib/messages/actions.test.ts \
  src/app/brand/messages/actions.ts src/app/brand/messages/actions.test.ts
git commit -m "計畫 7 Task 4：對話與訊息的伺服器讀取、送出／已讀／載入較早訊息／開啟對話的 Server Actions"
```

---

### Task 5: Realtime 訂閱與導覽列未讀徽章

**Files:**
- Create: `src/components/messages/useMessageInserts.ts`、`src/components/shell/UnreadBadge.tsx`
- Modify: `src/components/shell/SideNav.tsx`、`src/components/shell/BottomTabBar.tsx`、`src/app/brand/layout.tsx`

**Interfaces:**
- Consumes: Task 2 的 `unread_conversation_count`、Task 3 的 `MESSAGES_READ_EVENT`、`unreadBadgeText`、`MessageRow`、`NavItem.badge`；`createClient`（browser）。
- Produces：
  - `useMessageInserts(tag: string, conversationId: string | null, onInsert: (row: MessageRow) => void): LiveStatus`（`"connecting" | "live" | "error"`）
  - `<UnreadBadge />`（放在有 `relative` 的圖示容器裡）

- [ ] **Step 1: `src/components/messages/useMessageInserts.ts`**

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MessageRow } from "@/lib/messages/view";

export type LiveStatus = "connecting" | "live" | "error";

/**
 * 訂閱 messages 的 INSERT（Supabase Realtime Postgres Changes）。Realtime 以訂閱者的 JWT 檢查 messages_select（RLS），
 * 所以只收得到自己讀得到的訊息；conversationId 有值時再加上 conversation_id 的過濾。
 * 訂閱前先 await realtime.setAuth()（不帶參數 = 取目前 session 的 JWT），避免第一次連線還是 anon、什麼都收不到。
 * channel 名稱加亂數：realtime-js 對同名 topic 會回傳同一個 channel。
 */
export function useMessageInserts(tag: string, conversationId: string | null, onInsert: (row: MessageRow) => void): LiveStatus {
  const callback = useRef(onInsert);
  useEffect(() => {
    callback.current = onInsert;
  });
  const [status, setStatus] = useState<LiveStatus>("connecting");

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(`messages:${tag}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: conversationId ? `conversation_id=eq.${conversationId}` : undefined,
          },
          (payload) => callback.current(payload.new as MessageRow),
        )
        .subscribe((s) => {
          if (s === "SUBSCRIBED") setStatus("live");
          else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus("error");
        });
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [tag, conversationId]);

  return status;
}
```

- [ ] **Step 2: `src/components/shell/UnreadBadge.tsx`**

用「`tick` 加一」觸發重新查詢，`setCount` 只在 promise 的 callback 裡呼叫（`react-hooks/set-state-in-effect` 不允許在 effect 裡同步呼叫會 setState 的函式；本計畫撰寫時第一版就是被這條規則擋下）。

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MESSAGES_READ_EVENT, unreadBadgeText } from "@/lib/messages/view";
import { useMessageInserts } from "@/components/messages/useMessageInserts";

async function fetchUnread(): Promise<number | null> {
  const { data, error } = await createClient().rpc("unread_conversation_count");
  return !error && typeof data === "number" ? data : null;
}

/**
 * 導覽列「訊息」圖示右上角的未讀徽章（有未讀的對話數）。用瀏覽器 client 直接呼叫 unread_conversation_count
 * （definer 函式自己用 auth.uid()）。重新查詢的時機：掛上、換頁、ThreadView 標記已讀、任何新訊息（Realtime）。
 */
export function UnreadBadge() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetchUnread()
      .then((n) => {
        if (!cancelled && n !== null) setCount(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname, tick]);

  useEffect(() => {
    window.addEventListener(MESSAGES_READ_EVENT, bump);
    return () => window.removeEventListener(MESSAGES_READ_EVENT, bump);
  }, [bump]);

  useMessageInserts("nav", null, bump);

  const text = unreadBadgeText(count);
  if (!text) return null;
  return (
    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-btn bg-danger px-1 text-[10px] font-semibold leading-none text-on-ink">
      {text}
      <span className="sr-only">個對話有未讀訊息</span>
    </span>
  );
}
```

- [ ] **Step 3: 導覽列放上徽章**

`src/components/shell/SideNav.tsx`：
1. `import { NavIcon } from "./NavIcon";` 下面加 `import { UnreadBadge } from "./UnreadBadge";`
2. 連結裡的 `<NavIcon name={it.icon} size={22} />` 換成：
```tsx
                  <span className="relative inline-flex">
                    <NavIcon name={it.icon} size={22} />
                    {it.badge === "messages" && <UnreadBadge />}
                  </span>
```
（只換 `<Link>` 裡那一個；「即將推出」的 `<span>` 不動。）

`src/components/shell/BottomTabBar.tsx`：
1. 同樣加 `import { UnreadBadge } from "./UnreadBadge";`
2. `<Link>` 裡的 `<NavIcon name={it.icon} size={20} />` 換成：
```tsx
            <span className="relative inline-flex">
              <NavIcon name={it.icon} size={20} />
              {it.badge === "messages" && <UnreadBadge />}
            </span>
```

`src/app/brand/layout.tsx`：註解 `{/* 手機只放可用的項目，「即將推出」的 4 項放不下 */}` 改成 `{/* 手機只放可用的項目（計畫 7 起共 5 項）；「即將推出」的項目放不下 */}`（品牌手機底部導覽列多了「訊息」）。

桌面時 `SideNav` 與（隱藏的）`BottomTabBar` 各有一個徽章，等於兩個訂閱、兩次查詢；量很小，不另外共用。

- [ ] **Step 4: 檢查、commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/components/messages/useMessageInserts.ts src/components/shell/UnreadBadge.tsx \
  src/components/shell/SideNav.tsx src/components/shell/BottomTabBar.tsx src/app/brand/layout.tsx
git commit -m "計畫 7 Task 5：Realtime 訂閱 hook、導覽列未讀徽章"
```
畫面與即時行為由 Task 8 的 E2E 驗證（vitest 是 node 環境）。

---

### Task 6: 訊息頁面（列表、對話、輸入區）

**Files:**
- Create: `src/components/messages/LiveRefresh.tsx`、`ConversationList.tsx`、`ThreadHeader.tsx`、`MessageBubble.tsx`、`Composer.tsx`、`ThreadView.tsx`、`MessagesPages.tsx`；`src/app/brand/messages/page.tsx`、`src/app/brand/messages/[id]/page.tsx`、`src/app/creator/messages/page.tsx`、`src/app/creator/messages/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 3–5 的全部；`Counterpart`（`src/components/collabs/Counterpart.tsx`）、`COLLAB_STATUS_LABEL`、`todayTw`、`isUuid`、`requireRole`。
- Produces：`ConversationIndexSection({ side })`、`ThreadSection({ side, params })`、`MessagesSkeleton()`；四個路由。

- [ ] **Step 1: 列表的即時更新 `src/components/messages/LiveRefresh.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMessageInserts } from "./useMessageInserts";

/**
 * 對話列表的即時更新：收到任何新訊息（Realtime 只送自己讀得到的）就 debounce 400ms 後 router.refresh()，
 * 由伺服器重算預覽、排序與未讀數。refresh 會保留 ThreadView 的 state（use-router.md）。
 */
export function LiveRefresh() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useMessageInserts("list", null, () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 400);
  });
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return null;
}
```

- [ ] **Step 2: 對話列表 `src/components/messages/ConversationList.tsx`**

```tsx
import Link from "next/link";
import { Counterpart } from "@/components/collabs/Counterpart";
import {
  EMPTY_LIST_TEXT, listTimeLabel, messagesHref, previewText, unreadBadgeText,
  type ConversationListItem, type MessageSide,
} from "@/lib/messages/view";

type Props = { side: MessageSide; items: ConversationListItem[]; activeId: string | null; today: string };

/** 對話列表。目前打開的那一列反白、不顯示未讀數（標記已讀與重新整理有先後）。 */
export function ConversationList({ side, items, activeId, today }: Props) {
  if (items.length === 0) {
    return <p className="rounded-card border border-line bg-surface p-6 text-center text-sm text-muted">{EMPTY_LIST_TEXT[side]}</p>;
  }
  return (
    <ul aria-label="對話列表" className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {items.map((it) => {
        const active = it.id === activeId;
        const unread = active ? null : unreadBadgeText(it.unread);
        return (
          <li key={it.id}>
            <Link
              href={messagesHref(side, it.id)}
              aria-current={active ? "page" : undefined}
              className={`flex items-start gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink ${active ? "bg-primary-soft" : "hover:bg-bg"}`}
            >
              <Counterpart side={side} name={it.counterpartName} imagePath={it.counterpartImagePath} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`min-w-0 truncate text-ink ${unread ? "font-bold" : "font-semibold"}`}>{it.counterpartName}</p>
                  <span className="shrink-0 text-xs text-muted">{listTimeLabel(it.lastAt, today)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className={`min-w-0 flex-1 truncate text-sm ${unread ? "text-ink" : "text-muted"}`}>{previewText(it)}</p>
                  {it.closed && <span className="shrink-0 rounded-btn bg-primary-soft px-2 py-0.5 text-xs text-muted">暫停</span>}
                  {unread && (
                    <span className="shrink-0 rounded-btn bg-ink px-2 py-0.5 text-xs font-semibold text-on-ink">
                      {unread}<span className="sr-only"> 則未讀</span>
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 3: 標題區 `src/components/messages/ThreadHeader.tsx`**

```tsx
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Counterpart } from "@/components/collabs/Counterpart";
import { COLLAB_STATUS_LABEL } from "@/lib/collabs/view";
import type { ConversationCollab } from "@/lib/messages/load";
import { counterpartOf, messagesHref, type Conversation, type MessageSide } from "@/lib/messages/view";

/** 對話標題區：對方、（品牌）公開頁連結、這個對話的合作案膠囊。手機另有回到列表的按鈕。 */
export function ThreadHeader({ side, c, collabs }: { side: MessageSide; c: Conversation; collabs: ConversationCollab[] }) {
  const other = counterpartOf(c, side);
  const collabBase = side === "brand" ? "/brand/collabs" : "/creator/collabs";
  return (
    <header className="shrink-0 rounded-card border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <Link href={messagesHref(side)} className="-ml-1 flex h-11 w-9 items-center justify-center rounded-btn text-ink md:hidden">
          <ChevronLeft size={22} strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">回到訊息列表</span>
        </Link>
        <Counterpart side={side} name={other.name} imagePath={other.imagePath} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-ink">{other.name}</h2>
          {other.handle && (
            <Link href={`/c/${other.handle}`} className="text-xs text-muted underline-offset-2 hover:underline">查看公開頁</Link>
          )}
        </div>
      </div>
      {collabs.length > 0 && (
        <ul aria-label="這個對話的合作案" className="relative mt-3 flex gap-2 overflow-x-auto pb-1">
          {collabs.map((k) => (
            <li key={k.id} className="shrink-0">
              <Link href={`${collabBase}/${k.id}`} className="block max-w-60 truncate rounded-btn bg-primary-soft px-3 py-1.5 text-xs text-ink">
                {k.title}・{COLLAB_STATUS_LABEL[k.status]}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
```

- [ ] **Step 4: 訊息泡泡 `src/components/messages/MessageBubble.tsx`**

```tsx
import { ShieldAlert } from "lucide-react";
import { messageTime, type Message } from "@/lib/messages/view";

/** 一則訊息：自己的靠右淡色底、對方的靠左白底。被標記的訊息雙方都看得到提示。 */
export function MessageBubble({ m, mine }: { m: Message; mine: boolean }) {
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-input px-3.5 py-2 text-sm text-ink md:max-w-[70%] ${mine ? "bg-primary-soft" : "border border-line bg-surface"}`}
      >
        <span className="sr-only">{mine ? "你：" : "對方："}</span>
        {m.body}
      </p>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
        {m.flagged && (
          <>
            <ShieldAlert size={12} strokeWidth={1.5} aria-hidden="true" />
            <span>可能含聯絡方式，平台已留存紀錄・</span>
          </>
        )}
        <time dateTime={m.createdAt}>{messageTime(m.createdAt)}</time>
      </p>
    </div>
  );
}
```

- [ ] **Step 5: 輸入區 `src/components/messages/Composer.tsx`**

`bottom-[calc(4.25rem+env(safe-area-inset-bottom))]` 讓手機的輸入區固定在底部導覽列上方（導覽列：上 padding 0.5rem + 項目 3rem + 下 padding 0.5rem + 1px 邊框）。Task 8 在 390 寬確認沒有被導覽列蓋住，不對就只調這個數字。

```tsx
"use client";

import { useState, useTransition } from "react";
import { sendMessageAction } from "@/lib/messages/actions";
import { contactKinds, contactWarning } from "@/lib/messages/contact";
import type { Message } from "@/lib/messages/view";
import { textLength } from "@/lib/validation/brief";
import { cleanMessageBody, MESSAGE_BODY_MAX, validateMessageBody } from "@/lib/validation/message";

/**
 * 輸入區。偵測到聯絡方式時先在下方提醒（不是 confirm()），按「仍要送出」才送；改了內容要重新確認。
 * Enter 換行；Ctrl／⌘ + Enter 送出。受控輸入，送出用 onSubmit（不用 form action，避免 React 重設欄位）。
 */
export function Composer({ conversationId, onSent }: { conversationId: string; onSent: (m: Message) => void }) {
  const [body, setBody] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const count = textLength(body);

  function send(force: boolean) {
    if (pending) return;
    const clean = cleanMessageBody(body);
    const err = validateMessageBody(clean);
    if (err) {
      setError(err);
      return;
    }
    const w = contactWarning(contactKinds(clean));
    if (w && !force) {
      setWarning(w);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await sendMessageAction(conversationId, clean);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setBody("");
        setWarning(null);
        onSent(res.message);
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(false);
      }}
      className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] shrink-0 rounded-card border border-line bg-surface p-3 md:static"
    >
      <label htmlFor="message-body" className="sr-only">訊息</label>
      <textarea
        id="message-body"
        value={body}
        rows={2}
        placeholder="輸入訊息…"
        onChange={(e) => {
          setBody(e.target.value);
          setWarning(null);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send(false);
          }
        }}
        className="block max-h-40 min-h-11 w-full resize-y rounded-input border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
      />
      {warning && (
        <div role="alert" className="mt-2 rounded-input border border-line bg-primary-soft p-3 text-sm text-ink">
          <p>{warning}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={pending} onClick={() => send(true)}
              className="h-9 rounded-btn bg-ink px-4 text-sm font-semibold text-on-ink disabled:opacity-60">
              仍要送出
            </button>
            <button type="button" disabled={pending} onClick={() => setWarning(null)}
              className="h-9 rounded-btn border border-line bg-surface px-4 text-sm font-semibold text-ink">
              修改訊息
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className={`text-xs ${count > MESSAGE_BODY_MAX ? "text-danger" : "text-muted"}`}>
          {count} / {MESSAGE_BODY_MAX}<span className="hidden md:inline">・Ctrl／⌘ + Enter 送出</span>
        </span>
        <button type="submit" disabled={pending || warning !== null}
          className="h-11 rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60">
          {pending ? "送出中…" : "送出"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 6: 對話內容 `src/components/messages/ThreadView.tsx`**

「prop 改變時合併」用 React 文件的「在 render 時根據 prop 調整 state」寫法（`seenInitial`），不用 effect（`react-hooks/set-state-in-effect`）。`ThreadSection` 給 `ThreadView` 加 `key={id}`，切換對話時整個重來。

```tsx
"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { loadOlderMessagesAction, markReadAction } from "@/lib/messages/actions";
import {
  closedNotice, mergeMessages, MESSAGES_READ_EVENT, toMessage, withDaySeparators,
  type Message, type MessageSide,
} from "@/lib/messages/view";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { useMessageInserts } from "./useMessageInserts";

type Props = {
  conversationId: string;
  meId: string;
  side: MessageSide;
  initialMessages: Message[];
  initialHasMore: boolean;
  closed: boolean;
};

/**
 * 對話內容：訊息（由舊到新、日期分隔線）、載入較早的訊息、即時新訊息、標記已讀、輸入區。
 * router.refresh()（列表的 LiveRefresh）會帶來新的 initialMessages：合併進目前的訊息，不覆蓋已載入的舊訊息。
 */
export function ThreadView({ conversationId, meId, side, initialMessages, initialHasMore, closed }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [seenInitial, setSeenInitial] = useState(initialMessages);
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, startOlder] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  if (initialMessages !== seenInitial) {
    setSeenInitial(initialMessages);
    setMessages((cur) => mergeMessages(cur, initialMessages));
  }

  const markRead = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    markReadAction(conversationId)
      .then((r) => {
        if (r.ok) window.dispatchEvent(new Event(MESSAGES_READ_EVENT));
      })
      .catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [markRead]);

  const live = useMessageInserts("thread", conversationId, (row) => {
    const m = toMessage(row);
    setMessages((cur) => mergeMessages(cur, [m]));
    if (m.senderId !== meId) markRead();
  });

  // 最後一則改變（收到或送出新訊息、第一次進入）時捲到最底；載入較早的訊息不會改變最後一則，所以不捲動
  const lastId = messages.length > 0 ? messages[messages.length - 1].id : null;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  function loadOlder() {
    const first = messages[0];
    if (!first) return;
    setError(null);
    startOlder(async () => {
      try {
        const r = await loadOlderMessagesAction(conversationId, first.createdAt, first.id);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setMessages((cur) => mergeMessages(r.messages, cur));
        setHasMore(r.hasMore);
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 md:overflow-y-auto">
        {live === "error" && (
          <p role="status" className="mb-3 rounded-input bg-surface p-3 text-center text-sm text-muted">即時更新已中斷，請重新整理頁面</p>
        )}
        {hasMore && (
          <div className="mb-3 text-center">
            <button type="button" onClick={loadOlder} disabled={loadingOlder}
              className="h-9 rounded-btn border border-line bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-60">
              {loadingOlder ? "載入中…" : "載入較早的訊息"}
            </button>
          </div>
        )}
        {error && <p role="alert" className="mb-3 text-center text-sm text-danger">{error}</p>}
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">還沒有訊息，打聲招呼吧。</p>
        ) : (
          <ol aria-label="訊息" className="space-y-3 px-1">
            {withDaySeparators(messages).map((e) =>
              e.kind === "day" ? (
                <li key={e.key} className="py-1 text-center text-xs text-muted">{e.label}</li>
              ) : (
                <li key={e.key}><MessageBubble m={e.message} mine={e.message.senderId === meId} /></li>
              ),
            )}
          </ol>
        )}
        <div ref={endRef} />
      </div>
      {closed ? (
        <p className="shrink-0 rounded-card border border-line bg-surface p-4 text-center text-sm text-muted">{closedNotice(side)}</p>
      ) : (
        <Composer conversationId={conversationId} onSent={(m) => setMessages((cur) => mergeMessages(cur, [m]))} />
      )}
    </div>
  );
}
```

- [ ] **Step 7: 頁面內容 `src/components/messages/MessagesPages.tsx`**

```tsx
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { todayTw } from "@/lib/briefs/dates";
import { isUuid } from "@/lib/briefs/query";
import { loadMyConversations, loadThread } from "@/lib/messages/load";
import type { MessageSide } from "@/lib/messages/view";
import { ConversationList } from "./ConversationList";
import { LiveRefresh } from "./LiveRefresh";
import { ThreadHeader } from "./ThreadHeader";
import { ThreadView } from "./ThreadView";

/**
 * 桌面左邊列表、右邊內容；手機只顯示其中一邊（列表頁顯示列表，對話頁顯示對話）。
 * 桌面兩欄固定在視窗內各自捲動（10rem = 主內容區上下的 margin、padding 與標題）。
 */
function MessagesLayout({ list, thread }: { list: React.ReactNode; thread: React.ReactNode | null }) {
  return (
    <div>
      <h1 className={`text-[32px] font-bold text-ink ${thread ? "hidden md:block" : ""}`}>訊息</h1>
      <LiveRefresh />
      <div className="mt-4 md:grid md:h-[calc(100dvh-10rem)] md:grid-cols-[20rem_minmax(0,1fr)] md:gap-4">
        <div className={`min-h-0 md:block md:overflow-y-auto ${thread ? "hidden" : ""}`}>{list}</div>
        <div className={`min-h-0 min-w-0 flex-col gap-3 md:flex ${thread ? "flex" : "hidden"}`}>
          {thread ?? (
            <p className="flex flex-1 items-center justify-center rounded-card border border-line bg-surface text-sm text-muted">
              選擇一個對話開始聊天
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** 列表頁的內容（在 <Suspense> 內）：layout 的 Gate 在用戶端換頁時不會重跑，這裡自己 requireRole。 */
export async function ConversationIndexSection({ side }: { side: MessageSide }) {
  await requireRole(side);
  const items = await loadMyConversations();
  // requireRole 之後才能讀現在時間
  const today = todayTw();
  return <MessagesLayout list={<ConversationList side={side} items={items} activeId={null} today={today} />} thread={null} />;
}

/** 對話頁的內容（在 <Suspense> 內）。不是參與者、不是這一區的視角、id 不是 UUID：一律 notFound()（soft 404）。 */
export async function ThreadSection({ side, params }: { side: MessageSide; params: Promise<{ id: string }> }) {
  const me = await requireRole(side);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [items, thread] = await Promise.all([loadMyConversations(), loadThread(id)]);
  if (!thread || thread.conversation.side !== side) notFound();
  const today = todayTw();
  return (
    <MessagesLayout
      list={<ConversationList side={side} items={items} activeId={id} today={today} />}
      thread={
        <>
          <ThreadHeader side={side} c={thread.conversation} collabs={thread.collabs} />
          <ThreadView
            key={id}
            conversationId={id}
            meId={me.id}
            side={side}
            initialMessages={thread.messages}
            initialHasMore={thread.hasMore}
            closed={thread.conversation.closed}
          />
        </>
      }
    />
  );
}

export function MessagesSkeleton() {
  return (
    <div aria-busy="true">
      <p className="sr-only">載入中…</p>
      <div className="h-10 w-32 rounded-full bg-surface" />
      <div className="mt-4 h-64 rounded-card border border-line bg-surface" />
    </div>
  );
}
```

- [ ] **Step 8: 四個路由**

`src/app/brand/messages/page.tsx`：

```tsx
import { Suspense } from "react";
import { ConversationIndexSection, MessagesSkeleton } from "@/components/messages/MessagesPages";

// 頁面殼是靜態的；session 在 <Suspense> 內讀（cacheComponents）
export default function BrandMessagesPage() {
  return (
    <Suspense fallback={<MessagesSkeleton />}>
      <ConversationIndexSection side="brand" />
    </Suspense>
  );
}
```

`src/app/brand/messages/[id]/page.tsx`：

```tsx
import { Suspense } from "react";
import { MessagesSkeleton, ThreadSection } from "@/components/messages/MessagesPages";

type Props = { params: Promise<{ id: string }> };

export default function BrandThreadPage({ params }: Props) {
  return (
    <Suspense fallback={<MessagesSkeleton />}>
      <ThreadSection side="brand" params={params} />
    </Suspense>
  );
}
```

`src/app/creator/messages/page.tsx`：

```tsx
import { Suspense } from "react";
import { ConversationIndexSection, MessagesSkeleton } from "@/components/messages/MessagesPages";

// 頁面殼是靜態的；session 在 <Suspense> 內讀（cacheComponents）
export default function CreatorMessagesPage() {
  return (
    <Suspense fallback={<MessagesSkeleton />}>
      <ConversationIndexSection side="creator" />
    </Suspense>
  );
}
```

`src/app/creator/messages/[id]/page.tsx`：

```tsx
import { Suspense } from "react";
import { MessagesSkeleton, ThreadSection } from "@/components/messages/MessagesPages";

type Props = { params: Promise<{ id: string }> };

export default function CreatorThreadPage({ params }: Props) {
  return (
    <Suspense fallback={<MessagesSkeleton />}>
      <ThreadSection side="creator" params={params} />
    </Suspense>
  );
}
```

- [ ] **Step 9: 檢查、commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/components/messages/LiveRefresh.tsx src/components/messages/ConversationList.tsx src/components/messages/ThreadHeader.tsx \
  src/components/messages/MessageBubble.tsx src/components/messages/Composer.tsx src/components/messages/ThreadView.tsx \
  src/components/messages/MessagesPages.tsx src/app/brand/messages/page.tsx "src/app/brand/messages/[id]/page.tsx" \
  src/app/creator/messages/page.tsx "src/app/creator/messages/[id]/page.tsx"
git commit -m "計畫 7 Task 6：訊息列表與對話頁（即時更新、載入較早的訊息、聯絡方式提醒、對話暫停）"
```

---

### Task 7: 入口：公開頁「傳訊息」、合作案詳情「前往對話」

**Files:**
- Create: `src/components/messages/MessageButton.tsx`
- Modify: `src/components/collabs/InvitePanel.tsx`、`src/components/collabs/EventList.tsx`、`src/components/collabs/CollabDetail.tsx`、`src/app/c/[handle]/profile-view.test.ts`

**Interfaces:**
- Consumes: Task 4 的 `startConversationAction`、Task 3 的 `messagesHref`、`Collab.conversationId`。
- Produces：`<MessageButton creatorId />`；`EventList({ events, chatHref: string | null })`。

- [ ] **Step 1: 寫失敗的測試**

`src/app/c/[handle]/profile-view.test.ts`：
1. 在 `vi.mock("@/app/brand/collabs/actions", …)` 下面加一行（`MessageButton` 會 import 品牌的 server action，裡面有 `server-only`）：
```ts
vi.mock("@/app/brand/messages/actions", () => ({ startConversationAction: vi.fn() }));
```
2. 檔尾加：
```ts
describe("ProfileView 傳訊息（計畫 7）", () => {
  it("只有品牌看到「傳訊息」", () => {
    expect(html("brand", false)).toContain("傳訊息");
    expect(html("guest")).not.toContain("傳訊息");
    expect(html("creator")).not.toContain("傳訊息");
  });
});
```

Run: `npm test` → 新測試失敗（品牌的頁面沒有「傳訊息」）。

- [ ] **Step 2: `src/components/messages/MessageButton.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { MessageCircle } from "lucide-react";
import { startConversationAction, type StartState } from "@/app/brand/messages/actions";

/** 公開頁的「傳訊息」（只有品牌看得到）：開啟或找到既有的對話後導過去。 */
export function MessageButton({ creatorId }: { creatorId: string }) {
  const [state, action, pending] = useActionState<StartState, FormData>(startConversationAction, {});
  return (
    <form action={action} className="min-w-0">
      <input type="hidden" name="creatorId" value={creatorId} />
      <button type="submit" disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-btn border border-line bg-surface font-semibold text-ink disabled:opacity-60">
        <MessageCircle size={18} strokeWidth={1.5} aria-hidden="true" />
        {pending ? "開啟中…" : "傳訊息"}
      </button>
      {state.error && <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: `src/components/collabs/InvitePanel.tsx`**

1. `import { OfferForm } from "./OfferForm";` 上面加 `import { MessageButton } from "@/components/messages/MessageButton";`
2. 元件說明的第一行最後加「旁邊是「傳訊息」（計畫 7）。」
3. 收合狀態的按鈕

```tsx
        <button key="open" type="button" onClick={() => setOpen(true)}
          className="flex h-11 w-full items-center justify-center rounded-btn bg-ink font-semibold text-on-ink">
          邀請合作
        </button>
```

換成兩欄：

```tsx
        <div key="open" className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setOpen(true)}
            className="flex h-11 w-full items-center justify-center rounded-btn bg-ink font-semibold text-on-ink">
            邀請合作
          </button>
          <MessageButton creatorId={creatorId} />
        </div>
```

- [ ] **Step 4: 合作案詳情「前往對話」**

`src/components/collabs/EventList.tsx` 整個換成：

```tsx
import Link from "next/link";
import { eventText, eventTime, type CollabEvent } from "@/lib/collabs/view";

/** 對話與紀錄：系統事件（audit log）；訊息在對話頁，標題右邊連過去（計畫 7）。 */
export function EventList({ events, chatHref }: { events: CollabEvent[]; chatHref: string | null }) {
  return (
    <section aria-labelledby="events-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="events-title" className="text-lg font-bold text-ink">對話與紀錄</h2>
        {chatHref && <Link href={chatHref} className="shrink-0 text-sm font-semibold text-ink underline-offset-2 hover:underline">前往對話 →</Link>}
      </div>
      <ol className="mt-3 space-y-2 rounded-card border border-line bg-surface p-4 md:p-5">
        {events.map((e) => (
          <li key={e.id} className="flex gap-3 text-sm">
            <span className="w-24 shrink-0 text-xs leading-5 text-muted">{eventTime(e.createdAt)}</span>
            <span className="min-w-0 whitespace-pre-line break-words text-ink">{eventText(e)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

`src/components/collabs/CollabDetail.tsx`：
1. `import type { CollabSide } from "@/lib/collabs/view";` 下面加 `import { messagesHref } from "@/lib/messages/view";`
2. `<EventList events={events} />` 換成：
```tsx
      <EventList events={events} chatHref={c.conversationId ? messagesHref(side, c.conversationId) : null} />
```

- [ ] **Step 5: 檢查、commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/components/messages/MessageButton.tsx src/components/collabs/InvitePanel.tsx src/components/collabs/EventList.tsx \
  src/components/collabs/CollabDetail.tsx "src/app/c/[handle]/profile-view.test.ts"
git commit -m "計畫 7 Task 7：公開頁「傳訊息」、合作案詳情「前往對話」"
```
本計畫撰寫時，Task 3–7 的全部程式已在 repo 的暫存複本（型別檔手動補上 Task 1–2 的函式）跑過 `tsc --noEmit`、`eslint src`、`vitest run`（58 個檔案、535 個測試），全部通過；`next build` 沒有跑，由 Task 8 驗證。

---

### Task 8: 文件同步（README、followups）與本機端對端驗收

**Files:**
- Modify: `README.md`、`docs/superpowers/plans/2026-11-22-foundation-followups.md`

**Interfaces:**
- Consumes: Task 1–7 的全部成果。
- Produces: README「站內訊息（管理後台完成前）」一節；followups 的決定、完成標記與新的後續事項；E2E 截圖（存在本機暫存資料夾，不 commit）。

- [ ] **Step 1: README**

在「## 合作案的付款與撥款（金流與管理後台完成前）」整節**之後**、「## 正式環境（Hosted Supabase）設定」之前，加上新的一節：

````markdown
## 站內訊息（管理後台完成前）

- 品牌在創作者公開頁按「傳訊息」開啟對話；創作者不能主動開啟，只能在已有的對話裡回覆（由品牌傳訊息、錄取或邀請建立）。
- 訊息含電話、Email、LINE ID 或外部連結時，送出前會提醒；仍可送出，資料庫會自動標記 `flagged_contact`。違規訊息列表是計畫 9 的後台，在那之前用 SQL 查（Supabase Studio 的 SQL Editor，直接複製整段）：

```sql
select m.created_at at time zone 'Asia/Taipei' as 台灣時間,
       bp.brand_name as 品牌, cp.handle as 創作者,
       case when m.sender_id = cv.brand_id then '品牌' else '創作者' end as 發送者,
       m.body as 內容, m.conversation_id as 對話
  from public.messages m
  join public.conversations cv on cv.id = m.conversation_id
  left join public.brand_profiles bp on bp.user_id = cv.brand_id
  left join public.creator_profiles cp on cp.user_id = cv.creator_id
 where m.flagged_contact
 order by m.created_at desc
 limit 100;
```

- 創作者停權（`creator_profiles.status = 'suspended'`，見上方「審核創作者」）時，他的所有對話自動暫停：雙方都看得到歷史訊息，但不能再送。改回 `approved` 就恢復。
- 頻率限制：每人 1 分鐘最多 20 則訊息；每個品牌 24 小時最多開 30 個新對話。
- 即時更新用 Supabase Realtime（migration 已把 `messages` 加進 `supabase_realtime` publication，不需要在 Dashboard 另外開）。
````

在「## 正式環境（Hosted Supabase）設定」裡，`deliverables` 那一段（「交稿檔案的 Storage bucket `deliverables` 由 migration…」）之後加一段：

```markdown
站內訊息的即時更新用 Supabase Realtime：migration `20261126000100_messaging_write.sql` 會把 `messages` 加進 `supabase_realtime` publication，隨 `db push --remote` 一起生效。推完後到 Dashboard → Database → Publications 確認 `supabase_realtime` 包含 `messages`。不需要新的環境變數。
```

同一節的「**部署順序：先推資料庫，再合併 PR。**」那一段，括號裡的 migration 清單最後（`20261125000400_collab_review_fixes.sql` 之後）加上「，計畫 7 的 `20261126000100_messaging_write.sql`、`20261126000200_messaging_reads.sql`」。

- [ ] **Step 2: followups**

`docs/superpowers/plans/2026-11-22-foundation-followups.md`：

1. 「## 執行中做出的決定」表格最後加四列：

```markdown
| 站內訊息只走函式 | `messages` 收回所有 API 角色的寫入與 anon 讀取（只剩 authenticated／service_role 的 SELECT）；送出只能經由 `send_message`（參與者、內文 1–2000 字、對話未暫停、每人每分鐘 20 則）。`flagged_contact` 一律由 BEFORE INSERT trigger（`has_contact_info`）計算，規則與 `src/lib/messages/contact.ts` 相同。 |
| 誰能開啟對話 | 只有品牌，經由 `start_conversation`（已審核創作者；已有對話直接回傳；24 小時最多 30 個新對話）。創作者（包括報名過的）不能主動開啟。品牌開了但還沒傳訊息、也沒有合作案的空對話，創作者看不到。 |
| 對話暫停 | 創作者不是 approved 時，雙方都不能再送訊息，歷史訊息照常顯示。 |
| 已讀與即時 | `conversation_reads.last_read_at` = 最後一則訊息的 `created_at`，由 client 在開啟對話與收到訊息時呼叫 `mark_conversation_read`。即時更新用 Realtime Postgres Changes（`messages` 在 `supabase_realtime` publication；RLS 以訂閱者身分過濾），訂閱前先 `realtime.setAuth()`。 |
```

2. 「### 7. 站內訊息」整段換成：

```markdown
### 7. 站內訊息
- `flagged_contact` 用 BEFORE INSERT trigger 計算，不讓訊息改走 service_role。→ 已完成（計畫 7：`messages_flag_contact`）
- 把 `messages` 加進 `supabase_realtime` publication。→ 已完成（計畫 7）
- ~~待決定：誰可以主動開啟對話~~ → 已決定（計畫 7）：只有品牌，對象是已審核的創作者。
- 補測試：偽造 sender、第三方建立對話、update / delete 被拒絕、管理員可見性。→ 已完成（計畫 7：`18_messaging_write.test.sql`）
- 計畫 7 新增的後續事項：
  - 違規訊息列表、停權操作在計畫 9 的後台；目前用 README 的 SQL 查。
  - 聯絡方式偵測抓不到中文數字電話、「at」寫法的 Email、拆成多則的號碼；IG 帳號（`@xxx`）刻意不算。誤判（例如「訂單編號 0912345678」）只會多一個標記。
  - 沒有離線通知（Email／推播）：對方不在線上時只能靠下次登入看到徽章。
  - 沒有封鎖、檢舉、刪除或編輯訊息、附件、已讀回條。
  - 列表最多 200 個對話、沒有分頁與搜尋。
  - 已讀時間用最後一則訊息的 `created_at`：極少數情況下，較早的 `created_at` 卻較晚 commit 的訊息會被當成已讀。
  - 頻率限制沒有鎖，並行送出可能稍微超過 20 則／分鐘。
  - 品牌按「傳訊息」就會建立對話（即使最後沒有送出），24 小時 30 個的上限也把錄取、邀請建立的對話算進去。
  - 導覽列在桌面時有兩個徽章元件（側邊與隱藏的底部導覽列），各自訂閱一次 Realtime。
  - Realtime 斷線只顯示提示，不自動輪詢或重連後補抓訊息（重新整理即可）。
  - 對話頁的捲動在手機是整頁捲動，輸入區用 sticky 固定在底部導覽列上方；iOS 鍵盤彈出時的表現只在 E2E 的 390 寬模擬過。
```

3. 「### 9. 管理後台」第二點最後加：`（計畫 7 已收回 is_conversation_participant 的 PUBLIC／anon；is_admin、my_role 仍待處理）`

- [ ] **Step 3: Commit 文件**

```bash
git add README.md docs/superpowers/plans/2026-11-22-foundation-followups.md
git commit -m "計畫 7 Task 8：README（站內訊息、違規訊息 SQL、部署）與待辦同步"
```

- [ ] **Step 4: 全部檢查與 build（server 都還沒啟動）**

先確認沒有其他 `next build`／`next dev`／`next start` 在跑（`lsof -iTCP:3000 -sTCP:LISTEN` 沒有輸出，也沒有其他 agent 正在 build）。

```bash
npm run lint && npm run typecheck && npm test && npm run build && npx supabase test db
```
Expected: 全部通過；build 沒有 `Uncached data was accessed outside of <Suspense>`、`new Date()`／`Date.now()` 相關錯誤；route 清單有 `ƒ /brand/messages`、`ƒ /brand/messages/[id]`、`ƒ /creator/messages`、`ƒ /creator/messages/[id]`。

- [ ] **Step 5: 本機種子資料（只用本機 Supabase）**

測試快速登入的帳號：品牌 `dev-brand@kollink.test`、創作者 `dev-creator@kollink.test`（handle `devcreator`，自動是已審核）。先在 `http://localhost:3000/login` 各按一次「測試品牌」「測試創作者」，讓帳號存在。種子 id 前綴 `00000000-0000-0000-0000-0000e2e7`。

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 <<'SQL'
-- 第三方品牌與另一位創作者（第三方打不開別人的對話）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000e2e70011', 'p7-other-creator@test.local'),
  ('00000000-0000-0000-0000-0000e2e70021', 'p7-third-brand@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000e2e70011', 'creator', 'E2E 小涵'),
  ('00000000-0000-0000-0000-0000e2e70021', 'brand', 'E2E 第三方品牌');
insert into public.creator_profiles (user_id, handle, ig_username, follower_count, status) values
  ('00000000-0000-0000-0000-0000e2e70011', 'p7han', 'p7han', 5000, 'approved');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000e2e70021', 'E2E 第三方品牌');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-0000e2e70c01', '00000000-0000-0000-0000-0000e2e70021', '00000000-0000-0000-0000-0000e2e70011');
insert into public.messages (conversation_id, sender_id, body) values
  ('00000000-0000-0000-0000-0000e2e70c01', '00000000-0000-0000-0000-0000e2e70021', '別人的對話');
-- 測試品牌與測試創作者之間的邀約（第 6 步「前往對話」用；對話由 invite 的同一條路建立）
insert into public.conversations (brand_id, creator_id)
select b.id, c.id from auth.users b, auth.users c
 where b.email = 'dev-brand@kollink.test' and c.email = 'dev-creator@kollink.test'
on conflict (brand_id, creator_id) do nothing;
insert into public.collaborations (brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status)
select cv.brand_id, cv.creator_id, cv.id, 'E2E 訊息測試邀約', 'IG 貼文 1 篇', 3000, 'invited'
  from public.conversations cv
  join auth.users b on b.id = cv.brand_id and b.email = 'dev-brand@kollink.test'
  join auth.users c on c.id = cv.creator_id and c.email = 'dev-creator@kollink.test';
SQL
```
Expected：`INSERT 0 2`、`INSERT 0 2`、`INSERT 0 1`、`INSERT 0 1`、`INSERT 0 1`、`INSERT 0 1`、`INSERT 0 1`（或 `INSERT 0 0`：對話已存在）、`INSERT 0 1`。

```bash
E2E=$(mktemp -d)/kollink-p7-e2e && mkdir -p "$E2E" && echo "$E2E"
```
截圖存在 `$E2E`。

- [ ] **Step 6: 啟動 dev server（唯一的一個）**

```bash
npm run dev -- -p 3000
```
背景執行、記下 PID。瀏覽器一律用 **`http://localhost:3000`**（不要用 `127.0.0.1`：`allowedDevOrigins`）。這期間不要執行 `npm run build`。若 `next dev` 改了 `AGENTS.md`，照 `AGENTS.md` 的說明一起 commit。

瀏覽器自動化用 playwright-core（安裝在 scratchpad，不加進專案）：`cd <scratchpad> && npm init -y && npm i playwright-core`，用系統的 Chrome（`chromium.launch({ channel: "chrome", headless: true })`）。品牌與創作者用兩個獨立的 browser context，**同時開著**（驗證即時更新）。登入：`page.goto("http://localhost:3000/login")` 後按「測試品牌」／「測試創作者」（等同 `POST /auth/dev-login`，`account=brand|creator`）。每個標「截圖」的步驟在 viewport `390x844` 與 `1280x900` 各截一張；截圖前檢查 `document.documentElement.scrollWidth <= window.innerWidth` 是 `true`。即時更新的斷言一律「不重新整理、等待最多 5 秒」（`expect.poll` 或 `waitForSelector`）。

- [ ] **Step 7: 端對端操作**

1. **品牌開啟對話**：品牌開 `/c/p7han`（E2E 小涵，沒有既有對話）→「邀請合作」旁邊有「傳訊息」（390 時在底部兩欄；截圖）→ 按下 → 跳到 `/brand/messages/<id>`：標題「E2E 小涵」與「查看公開頁」、「還沒有訊息，打聲招呼吧。」（截圖）。回上一頁再按一次「傳訊息」→ 同一個 `<id>`。用 psql 確認小涵看不到這個空對話：
   ```bash
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -Atc "begin; set local role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"00000000-0000-0000-0000-0000e2e70011\",\"role\":\"authenticated\"}', true); select count(*) from public.list_my_conversations() where counterpart_name <> 'E2E 第三方品牌'; rollback;"
   ```
   Expected：最後一行 `0`。
2. **第一則訊息與即時徽章**：創作者停在 `/creator`。品牌開 `/c/devcreator` →「傳訊息」→ 對話頁標題下方有合作案膠囊「E2E 訊息測試邀約・邀約中」→ 輸入「您好，想跟你聊聊冬季的合作」→「送出」→ 訊息出現在右側、輸入框清空。創作者**不重新整理**：導覽列「訊息」右上角出現「1」（截圖：390 的底部導覽列、1280 的側邊導覽列）。
3. **已讀與即時回覆**：創作者點「訊息」→ 列表那一列粗體、未讀「1」、預覽是品牌的訊息（截圖）→ 點進去 → 徽章消失（不重新整理）。創作者回「好的，請說」→ 品牌那邊**不重新整理**就出現回覆（左側白底）；品牌的徽章最後是沒有數字（正在看這個對話，已自動標記已讀；標記完成前可能短暫出現「1」）；桌面左欄列表的預覽變成「好的，請說」（截圖）。
4. **聯絡方式提醒**：品牌輸入「我的 LINE ID: mei_123」→「送出」→ 輸入框下方出現「這則訊息可能含有LINE…」與「仍要送出」「修改訊息」，訊息還沒送出（截圖）→「修改訊息」→ 提醒消失 → 再按「送出」→ 提醒再出現 →「仍要送出」→ 訊息送出，雙方的這則訊息下方都有「可能含聯絡方式，平台已留存紀錄」。照 README「站內訊息」的 SQL 用 psql 執行 → 第一列內容是「我的 LINE ID: mei_123」。輸入只有空白按「送出」→「請輸入訊息」。用 Ctrl+Enter（1280）送出「快捷鍵測試」成功。
5. **載入較早的訊息**：
   ```bash
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 <<'SQL'
   insert into public.messages (conversation_id, sender_id, body, created_at)
   select cv.id, cv.brand_id, '舊訊息 ' || g, now() - interval '3 days' + g * interval '1 minute'
     from public.conversations cv
     join auth.users b on b.id = cv.brand_id and b.email = 'dev-brand@kollink.test'
     join auth.users c on c.id = cv.creator_id and c.email = 'dev-creator@kollink.test',
          generate_series(1, 60) g;
   SQL
   ```
   創作者重新整理對話頁 → 捲到最底、最上方有「載入較早的訊息」與日期分隔線 → 按下 → 出現「舊訊息 1」之前的訊息、按鈕消失、畫面沒有跳到最底（截圖）。
6. **合作案詳情「前往對話」**：品牌開 `/brand/collabs` →「E2E 訊息測試邀約」→「對話與紀錄」右邊「前往對話 →」→ 到同一個 `/brand/messages/<id>`；膠囊點回合作案詳情。創作者那邊同樣有「前往對話 →」，連到 `/creator/messages/<id>`。
7. **對話暫停**：
   ```bash
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -Atc "update public.creator_profiles set status = 'suspended' where handle = 'devcreator'"
   ```
   雙方重新整理：品牌輸入區變成「這位創作者的帳號目前停權，對話暫停。」、列表那一列有「暫停」標籤；創作者看到「你的帳號目前停權，暫時無法傳送訊息。」（截圖）。在另一個沒重新整理的分頁送出訊息 → 顯示「對話已暫停，無法傳送訊息」。改回：
   ```bash
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -Atc "update public.creator_profiles set status = 'approved' where handle = 'devcreator'"
   ```
   重新整理後恢復輸入區。
8. **權限**：品牌開 `/brand/messages/00000000-0000-0000-0000-0000e2e70c01`、創作者開 `/creator/messages/00000000-0000-0000-0000-0000e2e70c01` → 404 畫面；`/brand/messages/not-a-uuid` → 404。品牌開 `/creator/messages` → 被導回 `/brand`；創作者開 `/brand/messages` → 被導回 `/creator`。創作者開 `/c/p7han` → 沒有「傳訊息」。
9. **手機版**：390 寬，創作者 `/creator/messages` 只有列表；點進對話只有對話（標題左邊有返回）；輸入區在底部導覽列上方、沒有被蓋住；送出新訊息後最新一則在輸入區上方可見；沒有整頁水平捲軸（截圖）。1280 寬兩欄、整頁不捲動，只有列表與訊息區各自捲動；若整頁出現捲軸，只調整 `MessagesPages.tsx` 的 `md:h-[calc(100dvh-10rem)]`，並在回報中寫明調整後的值。

- [ ] **Step 8: 關閉 server、清理種子資料**

```bash
kill <Step 6 的 PID>
lsof -iTCP:3000 -sTCP:LISTEN || echo "已關閉"
npx supabase db reset
npx supabase test db
git status --short
```
Expected：「已關閉」；`db reset` 成功（會重新套用所有 migration、清空本機資料，包括測試快速登入的帳號，下次按一下就會重建）；`supabase test db` 全過；`git status` 乾淨（若 Step 7 調整了高度或 `AGENTS.md` 被 `next dev` 改了，就照 Step 6 的說明 commit：「計畫 7 Task 8：E2E 驗收修正（…）」）。把截圖資料夾路徑與每張截圖的檔名回報給 controller。

---

## 完成後（controller 執行，不是 task）

1. **端對端驗收複查**：派一個沒參與實作的 subagent，看 Task 8 Step 7 的截圖，對照 spec「頁面」「驗收」逐項檢查（手機 390、桌面 1280）。
2. **全分支最終審查**：review package 用 `git merge-base main HEAD` 為起點。特別看：Realtime 訂閱的授權（只靠 RLS）、`send_message` 的身分與暫停檢查、聯絡方式 JS／SQL 規則是否一字不差。
3. 開 PR（base 為 `main`），PR 說明寫明部署順序：
   - **合併前先執行 `npx supabase db push --remote`**（新 migration `20261126000100_messaging_write.sql`、`20261126000200_messaging_reads.sql`）。`get_collaboration` 多了一欄：舊版程式在 migration 之後、部署之前仍能運作（多的欄位被忽略）。
   - 確認 Supabase Dashboard → Database → Publications 的 `supabase_realtime` 包含 `messages`。
   - 不需要新的環境變數。
