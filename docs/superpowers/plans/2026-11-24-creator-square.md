# Kollink 品牌端創作者廣場 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在品牌後台首頁 `/brand` 建立「創作者廣場」：關鍵字與多條件篩選（全部記在網址）、四種排序、卡片／列表切換、「載入更多」、♡ 收藏與「只看收藏」，並在公開頁 `/c/<handle>` 給品牌 ♡。

**Architecture:** 資料層新增 `creator_favorites`（RLS：品牌只能讀、增、刪自己的收藏）、兩個只給品牌的 SECURITY DEFINER 函式 `search_creators`（篩選、排序、分頁、總數一次查完）與 `popular_style_tags`，以及 followups 列出的索引。網址的 searchParams 由純函式 `parseSquareQuery` 解析（容忍任何垃圾值）與 `serializeSquareQuery` 產生；頁面在 `<Suspense>` 內以品牌自己的 client 讀第一批 24 位。篩選改變時用 `router.replace` 換網址讓伺服器重新渲染；「載入更多」與 ♡ 是 Server Action（品牌自己的 client），♡ 用 `useOptimistic` 先切換、失敗切回。

**Tech Stack:** Next.js 16.4.6（App Router、`cacheComponents`、Server Actions）、React 19.3（`useOptimistic`、`useTransition`、`useSyncExternalStore`）、TypeScript、Tailwind v4、Supabase CLI 3.2（Postgres）、pgTAP、Vitest、lucide-react。

**Spec:** `docs/superpowers/specs/2026-11-24-creator-square-design.md`（含使用者決定；視覺沿用 `docs/superpowers/specs/2026-11-24-ui-refresh-design.md`；延後事項與既有決定見 `docs/superpowers/plans/2026-11-22-foundation-followups.md`）

## Global Constraints

- Next.js 16 與訓練資料不同：寫程式前先讀 `node_modules/next/dist/docs/` 對應文件（本計畫用到的已列在下方「設計決定」）。`middleware.ts` 已改名為 `proxy.ts`。
- `cacheComponents` 已開啟：讀 `cookies()`、`headers()`、`searchParams`、`params` 的元件必須在 `<Suspense>` 內；不要在 layout 最外層 await session（`node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`）。不可使用 `export const runtime`、`export const dynamic`。
- 金鑰：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（瀏覽器可見）、`SUPABASE_SECRET_KEY`（只能出現在 import `server-only` 的檔案，絕不加 `NEXT_PUBLIC_` 前綴）。
- 讀取與寫入一律用**使用者自己的** client（`src/lib/supabase/server.ts`），不可使用 `createAdminClient()`（E2E 的本機種子資料除外，那是在終端機用 SQL／Storage API 建立，不是 app 程式碼）。
- SQL 函式一律 `set search_path = ''`，物件名稱寫完整 schema；`RETURNS TABLE` 的 plpgsql 函式加 `#variable_conflict use_column`，欄位一律加表別名。
- 資料表與函式權限寫在 migration：新資料表先 `revoke all ... from anon, authenticated, service_role` 再明確 `grant`（本機預設權限會自動授權全部，雲端不會；見 followups「資料表權限寫在 migration」）。新函式先 `revoke execute ... from public, anon, authenticated, service_role` 再 `grant` 給需要的角色。
- 錯誤碼：身分不符 `raise exception 'not a brand' using errcode = '42501'`。
- 搜尋與篩選必須能容忍清單以外的值（followups「4. 創作者廣場」）：網址裡的任何值都不能讓頁面或資料庫報錯。
- 每個讀取使用者資料的後台頁面與 Server Action 都要呼叫 `requireRole("brand")`（layout 的 Gate 不算數）。公開頁 `/c/*` 不呼叫 `requireRole`。
- Server Action 是公開的 POST 端點：參數一律當成 `unknown` 檢查型別與範圍（`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`「Security」）。
- `supabase gen types` 產生的 RPC 回傳型別把 `RETURNS TABLE` 的欄位都標成非 null，實際上可能是 null：mapper 用自己定義、欄位可為 null 的 Row 型別（比照 `src/lib/creators/view.ts` 的 `PublicCreatorRow`）。
- 介面文字為繁體中文；產品名稱只從 `src/lib/site.ts` 的 `SITE_NAME` 取得。
- 顏色只用 `src/app/globals.css` 的 token class：`bg-bg`、`bg-panel`、`bg-surface`、`border-line`、`divide-line`、`text-ink`、`bg-ink`、`text-muted`、`text-on-ink`、`text-primary`、`bg-primary`、`bg-primary-soft`、`text-success`、`bg-success-soft`、`text-danger`、`ring-ink`、`accent-ink`（`bg-ink/40` 這類透明度修飾可以）；圓角 `rounded-card`、`rounded-btn`、`rounded-nav`、`rounded-input`。不可用 `text-white` 或其他色碼。
- 不新增 npm 套件。圖示用已安裝的 `lucide-react`，`strokeWidth={1.5}`、`aria-hidden="true"`。
- localStorage 讀寫一律包 try/catch；讀不到時預設卡片模式。
- 只動**本機** Supabase：不可執行 `supabase link`、`db push --remote`、`supabase config push`，也不可連到正式專案。
- 不可同時跑兩個 `next build`／`next dev`／`next start`（共用 `.next`）。只有 Task 7 會啟動伺服器，用完要關掉。
- 每個 task 結束時：`npm run lint && npm run typecheck && npm test` 全過；有動到 SQL 的 task 另跑 `npx supabase test db` 全過。
- Commit 訊息用中文寫「計畫 4 Task N：重點」，結尾加你所在環境指定的 Co-Authored-By 歸屬行（寫實際執行的模型）。
- 前置：Docker Desktop 已啟動，`npx supabase start` 已執行，`.env.local` 已設定（見 README「本機開發」）。

## 設計決定

讀過的文件：
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`（`searchParams` 是 Promise、「Handling filtering with `searchParams`」；是 Request-time API，要在 `<Suspense>` 內 await）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md`（`router.replace(href, { scroll: false })`；`router.bfcacheId`：push／replace 到新的 segment 會換、只換 search params 或 refresh 不換）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`（`useSearchParams` 會影響 prerender；改用伺服器解析好的 query 當 prop 傳下去）
- `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`（「Sequential dispatch on the client」：同一個 client 的 action 一個一個送；「A single response carries data and UI」：沒有呼叫 `revalidatePath`／`refresh` 時只回傳值、不重新渲染；「Security」：action 是公開的 POST）
- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`、`node_modules/next/dist/docs/01-app/02-guides/forms.md`、`node_modules/next/dist/docs/01-app/02-guides/single-page-applications.md`（`useOptimistic` + `startTransition`；`use(browser())`）
- `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`（`cacheComponents` 下 client 狀態會被 `<Activity>` 保留；對話框要在 effect cleanup 關掉）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/refresh.md`、`revalidatePath.md`

決定：
1. **篩選、排序、關鍵字只存在網址。** 頁面 `src/app/brand/page.tsx` 在 `<Suspense>` 內 `await searchParams`，用 `parseSquareQuery` 解析成 `SquareQuery`，以品牌自己的 client 呼叫 `search_creators` 讀第一批（24 位）。client 端不呼叫 `useSearchParams`，query 由伺服器當 prop 傳給 `SquareView`。篩選改變時 `SquareView` 用 `startTransition(() => router.replace(squareHref(next), { scroll: false }))`：伺服器重新渲染、舊畫面在轉換期間保留（不會閃回 Suspense fallback），篩選 UI 用 `useOptimistic(query)` 立刻反映。用 `replace` 而不是 `push`：每點一個篩選都進歷史紀錄，上一頁會很難用。
2. **「載入更多」用 Server Action 回傳下一批資料，不用網址 `?page=`。** `loadMoreCreatorsAction(queryString, offset)` 在伺服器重新解析查詢字串（不信任 client 傳來的物件）、`requireRole("brand")`、回傳 `{ items, hasMore }`，client 把結果接在已顯示的結果後面（以 `userId` 去重）。理由：(a) 每次請求最多 24 位，資料庫的 `p_limit` 維持 ≤ 48；用 `?page=N` 重新渲染要嘛一次讀 N×24 位、要嘛只顯示第 N 頁，都不符合「保留已顯示的結果」；(b) 已顯示的資料不用重抓；(c) 分享或重新整理時回到第一批，符合 spec「篩選、排序、關鍵字都記在網址」（頁數不在 spec 的網址狀態內）。結果清單元件以 `key={`${router.bfcacheId}|${queryKey}`}` 重設：換篩選或從別頁重新進來都從第一批開始，上一頁（back/forward）則保留已載入的結果。
3. **♡ 收藏用 Server Action + `useOptimistic`，不 revalidate。** `setFavoriteAction(creatorId, favorite)` 以品牌自己的 client 直接 insert／delete `creator_favorites`（RLS 只允許自己的收藏；重複收藏的 `23505` 視為成功）。不呼叫 `revalidatePath`／`refresh`：那會讓每按一次 ♡ 就重跑整頁搜尋。`FavoriteButton` 自己保存狀態，並以 `key={String(initial)}` 在伺服器給的新值不同時重設；從公開頁點導覽列回到廣場是新的請求，會讀到最新的 `is_favorite`。在「只看收藏」裡取消收藏，卡片留在畫面上直到下次篩選或重新整理（避免版面跳動）。
4. **卡片／列表模式記在 localStorage，用 `useSyncExternalStore` 讀。** server snapshot 固定是 `card`（spec：讀不到時預設卡片），hydrate 後才換成使用者存的模式；列表模式的使用者會先看到一瞬間卡片。沒有用 `use(browser())`：它會讓整個結果區在 SSR 時只輸出 fallback，並在伺服器回報 recoverable error。寫入失敗（無痕、停用儲存）時記在記憶體，這次瀏覽仍然有效。
5. **區間一律「含下限、不含上限」**：粉絲 `< 1,000`、`1,000–9,999`、`10,000–99,999`、`≥ 100,000`；起價 `< 5,000`、`5,000–19,999`、`≥ 20,000`；互動率 `≥ 1／3／5`。
6. **總數用 window 函式**（`count(*) over ()` 放在 `search_creators` 的 `total_count` 欄位），不另寫 `count_creators`：同一次查詢、篩選條件只寫一份。
7. **列表欄位排序**：粉絲數、互動率、貼文報價三個欄位標題可點，分別切換成「粉絲數（高到低）」「互動率（高到低）」「起價（低到高）」；再點一次目前的欄位回到「最新加入」。「貼文報價」欄顯示 IG 貼文價，但排序依 spec 的四種排序之一（起價），標題的說明文字寫清楚。其他欄位不可點。
8. **「清除篩選」保留排序**（排序不是篩選）。
9. **空狀態**：只開了「只看收藏」、其他篩選都沒開且沒有結果 → 「還沒有收藏的創作者」；其他沒有結果的情況 → 「找不到符合條件的創作者」＋「清除篩選」。

## File Structure

| 檔案 | 責任 |
|---|---|
| `supabase/migrations/20261124000400_creator_square.sql` | `creator_favorites`、索引、`search_creators`、`popular_style_tags`、權限 |
| `supabase/tests/10_creator_square.test.sql` | pgTAP（96 個） |
| `src/lib/supabase/database.types.ts` | `npm run db:types` 產生（不手改） |
| `src/lib/creators/square-query.ts` | 網址 ⇄ `SquareQuery`（容忍垃圾值）、選項常數、RPC 參數、清除與計數、空狀態判斷 |
| `src/lib/creators/square-view.ts` | `SquareCreator` 型別、RPC 列轉換、卡片標籤、價格文字、去重合併 |
| `src/lib/creators/view-mode.ts` | 卡片／列表模式的 localStorage 讀寫（try/catch） |
| `src/lib/creators/view.ts` | 匯出既有的 `toNumberOrNull` |
| `src/lib/creators/square.ts` | `searchSquare()`、`loadPopularStyleTags()`（server-only） |
| `src/lib/creators/public-profile.ts` | 新增 `loadIsFavorite()` |
| `src/app/brand/actions.ts` | `setFavoriteAction`、`loadMoreCreatorsAction` |
| `src/components/square/FavoriteButton.tsx` | ♡（樂觀更新、失敗切回並顯示錯誤） |
| `src/components/square/Avatar.tsx` | 頭像或名字首字 |
| `src/components/square/CreatorCard.tsx` | 卡片 |
| `src/components/square/CreatorTable.tsx` | 列表（可點的排序標題、可左右捲動） |
| `src/components/square/FilterPanel.tsx` | 篩選欄內容 |
| `src/components/square/FilterDrawer.tsx` | 手機／平板的篩選抽屜（`<dialog>`） |
| `src/components/square/useViewMode.ts` | `useViewMode()` hook |
| `src/components/square/SquareResults.tsx` | 結果區（卡片或列表、載入更多、空狀態） |
| `src/components/square/SquareView.tsx` | 廣場外框（篩選欄、結果數、排序、模式切換、導覽） |
| `src/app/brand/page.tsx` | 廣場頁（`<Suspense>`、`requireRole`、讀第一批） |
| `src/app/c/[handle]/ProfileView.tsx`、`src/app/c/[handle]/page.tsx` | 品牌在公開頁看到 ♡ |
| `public/*.svg` | 刪除 scaffold 留下的檔案 |
| `README.md`、`docs/superpowers/plans/2026-11-22-foundation-followups.md` | 文件同步 |

---

### Task 1: 資料庫：收藏、搜尋函式、熱門標籤、索引

**Files:**
- Create: `supabase/migrations/20261124000400_creator_square.sql`、`supabase/tests/10_creator_square.test.sql`
- Modify: `src/lib/supabase/database.types.ts`（產生）

**Interfaces:**
- Consumes: `public.my_role()`、`public.clean_text(text)`（既有 migration）；`creator_profiles`、`profiles`、`creator_rates`、`creator_portfolio_items`、`brand_profiles`。
- Produces:
  - 資料表 `creator_favorites(brand_id uuid → brand_profiles.user_id, creator_id uuid → creator_profiles.user_id, created_at timestamptz, primary key (brand_id, creator_id))`。authenticated：SELECT、DELETE、INSERT (brand_id, creator_id)；service_role：SELECT；anon：無。RLS：只能讀、刪自己的；新增時 `brand_id = auth.uid() and my_role() = 'brand'`。重複新增得到 `23505`。
  - `search_creators(p_keyword text, p_favorites_only boolean, p_categories text[], p_style_tags text[], p_follower_min integer, p_follower_max integer, p_engagement_min numeric, p_price_min integer, p_price_max integer, p_regions text[], p_collab_types text[], p_sort text, p_limit integer, p_offset integer)`，全部有預設值 → 列 `(user_id uuid, handle text, display_name text, avatar_path text, region text, categories text[], style_tags text[], collab_types text[], follower_count integer, engagement_rate numeric, min_price integer, post_price integer, portfolio_paths text[], is_favorite boolean, created_at timestamptz, total_count bigint)`。只給 authenticated；非品牌 `42501 not a brand`。`p_sort` 是 `newest|followers|engagement|price`（其他當 newest）；`p_limit` 夾在 1..48。
  - `popular_style_tags()` → 列 `(tag text, uses bigint)`，最多 20 列；只給 authenticated；非品牌 `42501`。
  - 索引 `creator_profiles_status_created_idx`、`creator_profiles_categories_gin`、`creator_profiles_style_tags_gin`、`creator_profiles_collab_types_gin`、`creator_rates_creator_price_idx`、`creator_favorites_brand_created_idx`。

- [ ] **Step 1: 寫失敗的測試 `supabase/tests/10_creator_square.test.sql`**

測試在自己的 transaction 裡先把本機既有的已審核創作者改成停權（結束時 rollback 還原），所以本機有沒有測試快速登入或 E2E 留下的資料都不影響結果；所有 fixture 都在這個檔案的 transaction 內，不會影響 `01`、`05` 那些會數列數的舊測試。

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(96);

-- 本機資料庫可能已有測試快速登入或 E2E 留下的已審核創作者：先全部改成停權，只讓本檔的 fixture 是已審核
-- （整個檔案在 transaction 裡，結束時 rollback 還原）
update public.creator_profiles set status = 'suspended' where status = 'approved';

-- 501、502 品牌；511–517 已審核創作者；520 待審核；521 停權；540 還沒建立帳號
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000501', 'sq-b1@test.local'),
  ('00000000-0000-0000-0000-000000000502', 'sq-b2@test.local'),
  ('00000000-0000-0000-0000-000000000511', 'sq-c1@test.local'),
  ('00000000-0000-0000-0000-000000000512', 'sq-c2@test.local'),
  ('00000000-0000-0000-0000-000000000513', 'sq-c3@test.local'),
  ('00000000-0000-0000-0000-000000000514', 'sq-c4@test.local'),
  ('00000000-0000-0000-0000-000000000515', 'sq-c5@test.local'),
  ('00000000-0000-0000-0000-000000000516', 'sq-c6@test.local'),
  ('00000000-0000-0000-0000-000000000517', 'sq-c7@test.local'),
  ('00000000-0000-0000-0000-000000000520', 'sq-pending@test.local'),
  ('00000000-0000-0000-0000-000000000521', 'sq-suspended@test.local'),
  ('00000000-0000-0000-0000-000000000540', 'sq-none@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000501', 'brand', '品牌一'),
  ('00000000-0000-0000-0000-000000000502', 'brand', '品牌二'),
  ('00000000-0000-0000-0000-000000000511', 'creator', 'Amy 美妝'),
  ('00000000-0000-0000-0000-000000000512', 'creator', 'Ben 旅遊'),
  ('00000000-0000-0000-0000-000000000513', 'creator', 'Cat 100%'),
  ('00000000-0000-0000-0000-000000000514', 'creator', 'Dan_x'),
  ('00000000-0000-0000-0000-000000000515', 'creator', 'Eve'),
  ('00000000-0000-0000-0000-000000000516', 'creator', 'Fay'),
  ('00000000-0000-0000-0000-000000000517', 'creator', 'Gus'),
  ('00000000-0000-0000-0000-000000000520', 'creator', 'Amy pending'),
  ('00000000-0000-0000-0000-000000000521', 'creator', 'Amy suspended');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000501', '品牌一'),
  ('00000000-0000-0000-0000-000000000502', '品牌二');
insert into public.creator_profiles
  (user_id, handle, ig_username, follower_count, engagement_rate, region, categories, style_tags, collab_types, status, created_at)
values
  ('00000000-0000-0000-0000-000000000511', 'sq_amy', 'amy.ig', 500, 1.5, '台北市',
   array['美妝'], array['自然', '清新'], array['IG 貼文', 'Reels'], 'approved', '2026-01-01'),
  ('00000000-0000-0000-0000-000000000512', 'sq_ben', 'ben_travel', 5000, 3.2, '台中市',
   array['旅遊'], array['戶外'], array['Reels'], 'approved', '2026-01-02'),
  ('00000000-0000-0000-0000-000000000513', 'sq_cat', 'cat.ig', 50000, 5.5, '台北市',
   array['美食', '生活'], array['自然'], array['IG 貼文'], 'approved', '2026-01-03'),
  ('00000000-0000-0000-0000-000000000514', 'sq_dan', 'danx', 150000, null, '高雄市',
   array['3C'], '{}', array['限時動態'], 'approved', '2026-01-04'),
  ('00000000-0000-0000-0000-000000000515', 'sq_eve', 'eve.ig', 1000, 5.0, 'Narnia',
   array['穿搭', '怪類別'], array['清新'], array['產品互惠'], 'approved', '2026-01-05'),
  ('00000000-0000-0000-0000-000000000516', 'sq_fay', 'fay.ig', 10000, 1.0, '台北市',
   array['美妝'], '{}', array['IG 貼文'], 'approved', '2026-01-06'),
  ('00000000-0000-0000-0000-000000000517', 'sq_gus', 'gus.ig', 99999, 2.99, '新北市',
   array['美妝'], '{}', array['IG 貼文'], 'approved', '2026-01-06'),
  ('00000000-0000-0000-0000-000000000520', 'sq_pen', 'pen.ig', 800, 4.0, '台北市',
   array['美妝'], array['秘密'], array['IG 貼文'], 'pending', '2026-01-07'),
  ('00000000-0000-0000-0000-000000000521', 'sq_sus', 'sus.ig', 800, 4.0, '台北市',
   array['美妝'], array['秘密'], array['IG 貼文'], 'suspended', '2026-01-08');
insert into public.creator_rates (creator_id, collab_type, price_twd) values
  ('00000000-0000-0000-0000-000000000511', 'IG 貼文', 3000),
  ('00000000-0000-0000-0000-000000000511', 'Reels', 6000),
  ('00000000-0000-0000-0000-000000000512', 'Reels', 8000),
  ('00000000-0000-0000-0000-000000000513', 'IG 貼文', 25000),
  ('00000000-0000-0000-0000-000000000515', '產品互惠', 0),
  ('00000000-0000-0000-0000-000000000516', 'IG 貼文', 5000),
  ('00000000-0000-0000-0000-000000000517', 'IG 貼文', 20000),
  ('00000000-0000-0000-0000-000000000520', 'IG 貼文', 100);
-- 故意不照 position 順序新增，確認回傳依 position 排序且只取前三張
insert into public.creator_portfolio_items (creator_id, image_path, position) values
  ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000511/portfolio-p3.jpg', 3),
  ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000511/portfolio-p1.jpg', 1),
  ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000511/portfolio-p0.jpg', 0),
  ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000511/portfolio-p2.jpg', 2);
insert into public.creator_favorites (brand_id, creator_id) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000512'),
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000516'),
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000520'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000511');

-- 結構與權限
select has_table('public', 'creator_favorites', '有 creator_favorites 資料表');
select col_is_pk('public', 'creator_favorites', array['brand_id', 'creator_id'], '主鍵是 (brand_id, creator_id)');
select ok(has_table_privilege('authenticated', 'public.creator_favorites', 'SELECT'), 'authenticated 可以讀收藏（受 RLS 限制）');
select ok(has_table_privilege('authenticated', 'public.creator_favorites', 'DELETE'), 'authenticated 可以刪收藏（受 RLS 限制）');
select ok(has_column_privilege('authenticated', 'public.creator_favorites', 'creator_id', 'INSERT'), 'authenticated 可以新增收藏');
select ok(not has_column_privilege('authenticated', 'public.creator_favorites', 'created_at', 'INSERT'), 'created_at 不接受寫入');
select ok(not has_table_privilege('authenticated', 'public.creator_favorites', 'UPDATE'), '收藏不開放 UPDATE');
select ok(not has_table_privilege('anon', 'public.creator_favorites', 'SELECT'), 'anon 讀不到收藏');
select ok(has_table_privilege('service_role', 'public.creator_favorites', 'SELECT'), 'service_role 可以讀收藏');
select ok(not has_table_privilege('service_role', 'public.creator_favorites', 'INSERT'), 'service_role 不能新增收藏');
select ok(not has_function_privilege('anon',
  'public.search_creators(text, boolean, text[], text[], integer, integer, numeric, integer, integer, text[], text[], text, integer, integer)',
  'EXECUTE'), 'anon 不能呼叫 search_creators');
select ok(has_function_privilege('authenticated',
  'public.search_creators(text, boolean, text[], text[], integer, integer, numeric, integer, integer, text[], text[], text, integer, integer)',
  'EXECUTE'), 'authenticated 可以呼叫 search_creators（函式內再檢查是不是品牌）');
select ok(not has_function_privilege('service_role',
  'public.search_creators(text, boolean, text[], text[], integer, integer, numeric, integer, integer, text[], text[], text, integer, integer)',
  'EXECUTE'), 'service_role 不能呼叫 search_creators');
select ok(not has_function_privilege('anon', 'public.popular_style_tags()', 'EXECUTE'), 'anon 不能呼叫 popular_style_tags');
select ok(has_function_privilege('authenticated', 'public.popular_style_tags()', 'EXECUTE'), 'authenticated 可以呼叫 popular_style_tags');
select has_index('public', 'creator_profiles', 'creator_profiles_status_created_idx', '索引 creator_profiles(status, created_at desc)');
select has_index('public', 'creator_profiles', 'creator_profiles_categories_gin', 'categories GIN 索引');
select has_index('public', 'creator_profiles', 'creator_profiles_style_tags_gin', 'style_tags GIN 索引');
select has_index('public', 'creator_profiles', 'creator_profiles_collab_types_gin', 'collab_types GIN 索引');
select has_index('public', 'creator_rates', 'creator_rates_creator_price_idx', '索引 creator_rates(creator_id, price_twd)');
select has_index('public', 'creator_favorites', 'creator_favorites_brand_created_idx', '索引 creator_favorites(brand_id, created_at desc)');

-- 訪客
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.search_creators()$$, '42501', null, '訪客不能搜尋');
select throws_ok($$select * from public.popular_style_tags()$$, '42501', null, '訪客不能讀熱門標籤');
select throws_ok($$select * from public.creator_favorites$$, '42501', null, '訪客讀不到收藏');

-- 創作者
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000511","role":"authenticated"}', true);
select throws_ok($$select * from public.search_creators()$$, '42501', 'not a brand', '創作者不能搜尋');
select throws_ok($$select * from public.popular_style_tags()$$, '42501', 'not a brand', '創作者不能讀熱門標籤');
select throws_ok(
  $$insert into public.creator_favorites (brand_id, creator_id)
    values ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000512')$$,
  '42501', null, '創作者不能收藏');
select is((select count(*)::int from public.creator_favorites), 0, '創作者讀不到任何收藏');

-- 還沒建立帳號的使用者
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000540","role":"authenticated"}', true);
select throws_ok($$select * from public.search_creators()$$, '42501', 'not a brand', '沒有 profile 的使用者不能搜尋');

-- 品牌一
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000501","role":"authenticated"}', true);

-- 只列已審核、總數
select is((select count(*)::int from public.search_creators()), 7, '只列出 7 位已審核的創作者');
select is((select count(*)::int from public.search_creators() where handle in ('sq_pen', 'sq_sus')), 0,
  '待審核與停權的不列出');
select is((select distinct total_count::int from public.search_creators(p_limit => 2)), 7,
  'total_count 是全部符合的數量，不受 p_limit 影響');

-- 四種排序（同一天加入的 fay、gus 以 user_id 決定先後）
select is(array(select t.handle from public.search_creators() with ordinality t order by t.ordinality),
  array['sq_fay', 'sq_gus', 'sq_eve', 'sq_dan', 'sq_cat', 'sq_ben', 'sq_amy'], '預設最新加入');
select is(array(select t.handle from public.search_creators(p_sort => 'followers') with ordinality t order by t.ordinality),
  array['sq_dan', 'sq_gus', 'sq_cat', 'sq_fay', 'sq_ben', 'sq_eve', 'sq_amy'], '粉絲數高到低');
select is(array(select t.handle from public.search_creators(p_sort => 'engagement') with ordinality t order by t.ordinality),
  array['sq_cat', 'sq_eve', 'sq_ben', 'sq_gus', 'sq_amy', 'sq_fay', 'sq_dan'], '互動率高到低，沒填的排最後');
select is(array(select t.handle from public.search_creators(p_sort => 'price') with ordinality t order by t.ordinality),
  array['sq_eve', 'sq_amy', 'sq_fay', 'sq_ben', 'sq_gus', 'sq_cat', 'sq_dan'], '起價低到高，沒有報價的排最後');
select is(array(select t.handle from public.search_creators(p_sort => 'drop table') with ordinality t order by t.ordinality),
  array['sq_fay', 'sq_gus', 'sq_eve', 'sq_dan', 'sq_cat', 'sq_ben', 'sq_amy'], '不認得的排序當成最新加入');

-- 分頁穩定：逐頁接起來等於一次取完，不重複也不漏
select is(
  array(select t.handle from public.search_creators(p_limit => 3, p_offset => 0) with ordinality t order by t.ordinality)
  || array(select t.handle from public.search_creators(p_limit => 3, p_offset => 3) with ordinality t order by t.ordinality)
  || array(select t.handle from public.search_creators(p_limit => 3, p_offset => 6) with ordinality t order by t.ordinality),
  array['sq_fay', 'sq_gus', 'sq_eve', 'sq_dan', 'sq_cat', 'sq_ben', 'sq_amy'], '最新加入分頁穩定');
select is(
  array(select t.handle from public.search_creators(p_sort => 'price', p_limit => 2, p_offset => 0) with ordinality t order by t.ordinality)
  || array(select t.handle from public.search_creators(p_sort => 'price', p_limit => 2, p_offset => 2) with ordinality t order by t.ordinality)
  || array(select t.handle from public.search_creators(p_sort => 'price', p_limit => 2, p_offset => 4) with ordinality t order by t.ordinality)
  || array(select t.handle from public.search_creators(p_sort => 'price', p_limit => 2, p_offset => 6) with ordinality t order by t.ordinality),
  array['sq_eve', 'sq_amy', 'sq_fay', 'sq_ben', 'sq_gus', 'sq_cat', 'sq_dan'], '起價排序分頁穩定');
select is(
  array(select t.handle from public.search_creators(p_sort => 'engagement', p_limit => 4, p_offset => 0) with ordinality t order by t.ordinality)
  || array(select t.handle from public.search_creators(p_sort => 'engagement', p_limit => 4, p_offset => 4) with ordinality t order by t.ordinality),
  array['sq_cat', 'sq_eve', 'sq_ben', 'sq_gus', 'sq_amy', 'sq_fay', 'sq_dan'], '互動率排序分頁穩定');
select is((select count(*)::int from public.search_creators(p_limit => 0)), 1, 'p_limit 小於 1 時當成 1');
select is((select count(*)::int from public.search_creators(p_limit => 1000)), 7, 'p_limit 過大不報錯（上限 48）');
select is((select count(*)::int from public.search_creators(p_offset => 100)), 0, '超過最後一頁回傳空的');

-- 關鍵字
select is(array(select handle from public.search_creators(p_keyword => 'amy') order by handle),
  array['sq_amy'], '關鍵字比對名稱、handle，不分大小寫，未審核的不列出');
select is(array(select handle from public.search_creators(p_keyword => 'BEN_T') order by handle),
  array['sq_ben'], '關鍵字比對 IG 帳號');
select is(array(select handle from public.search_creators(p_keyword => '%') order by handle),
  array['sq_cat'], '% 照字面比對');
select is((select count(*)::int from public.search_creators(p_keyword => 'y_')), 0, '_ 照字面比對（不是萬用字元）');
select is((select count(*)::int from public.search_creators(p_keyword => 'sq_')), 7, '_ 照字面比對時仍比得到');
select is((select count(*)::int from public.search_creators(p_keyword => '\')), 0, '反斜線不報錯');
select is(array(select handle from public.search_creators(p_keyword => '  eve  ') order by handle),
  array['sq_eve'], '關鍵字前後空白會去掉');
select is((select count(*)::int from public.search_creators(p_keyword => '   ')), 7, '只有空白的關鍵字等於沒填');

-- 篩選：多選欄位內 OR、不同欄位 AND
select is(array(select handle from public.search_creators(p_categories => array['旅遊', '3C']) order by handle),
  array['sq_ben', 'sq_dan'], '內容領域多選是 OR');
select is(array(select handle from public.search_creators(p_categories => array['美妝'], p_regions => array['台北市']) order by handle),
  array['sq_amy', 'sq_fay'], '內容領域與地區是 AND');
select is(array(select handle from public.search_creators(p_style_tags => array['自然']) order by handle),
  array['sq_amy', 'sq_cat'], '風格標籤');
select is(array(select handle from public.search_creators(p_style_tags => array['自然', '清新'], p_regions => array['台北市']) order by handle),
  array['sq_amy', 'sq_cat'], '風格標籤 OR 加上地區 AND');
select is(array(select handle from public.search_creators(p_collab_types => array['Reels', '限時動態']) order by handle),
  array['sq_amy', 'sq_ben', 'sq_dan'], '合作類型多選是 OR');
select is(array(select handle from public.search_creators(p_regions => array['Narnia']) order by handle),
  array['sq_eve'], '清單以外的地區也能比對（容忍舊資料）');
select is(array(select handle from public.search_creators(p_categories => array['怪類別']) order by handle),
  array['sq_eve'], '清單以外的內容領域也能比對');
select is((select count(*)::int from public.search_creators(p_regions => array['不存在的地方'])), 0, '比對不到時回傳空的，不報錯');
select is((select count(*)::int from public.search_creators(p_categories => '{}')), 7, '空陣列代表不篩選');
select is(array(select handle from public.search_creators(p_follower_max => 1000) order by handle),
  array['sq_amy'], '粉絲 1 千以下（不含 1,000）');
select is(array(select handle from public.search_creators(p_follower_min => 1000, p_follower_max => 10000) order by handle),
  array['sq_ben', 'sq_eve'], '粉絲 1 千到 1 萬（含下限、不含上限）');
select is(array(select handle from public.search_creators(p_follower_min => 10000, p_follower_max => 100000) order by handle),
  array['sq_cat', 'sq_fay', 'sq_gus'], '粉絲 1 萬到 10 萬');
select is(array(select handle from public.search_creators(p_follower_min => 100000) order by handle),
  array['sq_dan'], '粉絲 10 萬以上');
select is(array(select handle from public.search_creators(p_engagement_min => 3) order by handle),
  array['sq_ben', 'sq_cat', 'sq_eve'], '互動率 ≥ 3%，沒填的不列出');
select is(array(select handle from public.search_creators(p_price_max => 5000) order by handle),
  array['sq_amy', 'sq_eve'], '起價 5 千以下（不含 5,000）');
select is(array(select handle from public.search_creators(p_price_min => 5000, p_price_max => 20000) order by handle),
  array['sq_ben', 'sq_fay'], '起價 5 千到 2 萬');
select is(array(select handle from public.search_creators(p_price_min => 20000) order by handle),
  array['sq_cat', 'sq_gus'], '起價 2 萬以上，沒有報價的不列出');
select is(array(select handle from public.search_creators(p_categories => array['美妝'], p_price_min => 5000) order by handle),
  array['sq_fay', 'sq_gus'], '內容領域與起價是 AND');

-- 收藏
select is(array(select handle from public.search_creators(p_favorites_only => true) order by handle),
  array['sq_ben', 'sq_fay'], '只看收藏（收藏的待審核創作者不列出）');
select is((select is_favorite from public.search_creators() where handle = 'sq_ben'), true, '自己收藏的 is_favorite 是 true');
select is((select is_favorite from public.search_creators() where handle = 'sq_amy'), false, '別的品牌收藏的不算');

-- 每列的欄位
select is((select min_price from public.search_creators() where handle = 'sq_amy'), 3000, '起價是最低報價');
select is((select post_price from public.search_creators() where handle = 'sq_amy'), 3000, 'IG 貼文報價');
select is((select min_price from public.search_creators() where handle = 'sq_ben'), 8000, '只有 Reels 時起價是 Reels 的價格');
select is((select post_price from public.search_creators() where handle = 'sq_ben'), null::integer, '沒有 IG 貼文報價時是 null');
select is((select min_price from public.search_creators() where handle = 'sq_dan'), null::integer, '沒有報價時起價是 null');
select is((select portfolio_paths from public.search_creators() where handle = 'sq_amy'),
  array['00000000-0000-0000-0000-000000000511/portfolio-p0.jpg',
        '00000000-0000-0000-0000-000000000511/portfolio-p1.jpg',
        '00000000-0000-0000-0000-000000000511/portfolio-p2.jpg'], '作品依 position 取前三張');
select is((select portfolio_paths from public.search_creators() where handle = 'sq_ben'), '{}'::text[], '沒有作品是空陣列');
select is((select display_name from public.search_creators() where handle = 'sq_cat'), 'Cat 100%', '回傳顯示名稱');
select is((select engagement_rate from public.search_creators() where handle = 'sq_gus'), 2.99::numeric, '回傳互動率');

-- 熱門風格標籤（只算已審核的）
select is(array(select tag from public.popular_style_tags() order by tag),
  array(select unnest(array['自然', '清新', '戶外']) order by 1), '熱門標籤只算已審核的創作者');
select is((select uses::int from public.popular_style_tags() where tag = '自然'), 2, '回傳使用次數');
select is((select tag from public.popular_style_tags() limit 1) in ('自然', '清新'), true, '次數多的排前面');

-- 收藏的 RLS
select is((select count(*)::int from public.creator_favorites), 3, '品牌只看得到自己的收藏');
select lives_ok(
  $$insert into public.creator_favorites (brand_id, creator_id)
    values ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000511')$$,
  '品牌可以收藏');
select is((select is_favorite from public.search_creators() where handle = 'sq_amy'), true, '收藏後 is_favorite 是 true');
select throws_ok(
  $$insert into public.creator_favorites (brand_id, creator_id)
    values ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000516')$$,
  '23505', null, '重複收藏是 unique violation（app 視為成功）');
select throws_ok(
  $$insert into public.creator_favorites (brand_id, creator_id)
    values ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000513')$$,
  '42501', null, '不能幫別的品牌收藏');
select throws_ok(
  $$update public.creator_favorites set creator_id = '00000000-0000-0000-0000-000000000513'
    where creator_id = '00000000-0000-0000-0000-000000000512'$$,
  '42501', null, '收藏不能修改');
-- RLS 讓別的品牌的收藏「看不到」，所以刪除只會影響 0 列（reset role 後再確認品牌二的收藏還在）
delete from public.creator_favorites where brand_id = '00000000-0000-0000-0000-000000000502';
delete from public.creator_favorites where creator_id = '00000000-0000-0000-0000-000000000512';
select is((select count(*)::int from public.creator_favorites
           where creator_id = '00000000-0000-0000-0000-000000000512'), 0, '可以取消自己的收藏');
select is(array(select handle from public.search_creators(p_favorites_only => true) order by handle),
  array['sq_amy', 'sq_fay'], '新增與取消後，只看收藏的結果跟著變');

-- 品牌二
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000502","role":"authenticated"}', true);
select is(array(select handle from public.search_creators(p_favorites_only => true) order by handle),
  array['sq_amy'], '每個品牌只看到自己的收藏');

reset role;
select is((select count(*)::int from public.creator_favorites
           where brand_id = '00000000-0000-0000-0000-000000000502'), 1, '品牌一刪不到品牌二的收藏');
select is((select count(*)::int from public.creator_favorites
           where creator_id = '00000000-0000-0000-0000-000000000520'), 1, '資料庫允許收藏未審核的創作者');
select is((select count(*)::int from public.creator_favorites), 4, '收藏總數正確（原本 4 筆，新增 1、取消 1）');

select * from finish();
rollback;
```

- [ ] **Step 2: 執行測試，確認失敗**

Run: `npx supabase test db`
Expected: `10_creator_square.test.sql` FAIL（`relation "public.creator_favorites" does not exist`），其他檔案照舊通過。

- [ ] **Step 3: 寫 migration `supabase/migrations/20261124000400_creator_square.sql`**

```sql
-- 品牌端創作者廣場（計畫 4）：收藏、搜尋函式、熱門風格標籤、索引
-- 權限一律在這裡明確寫出（雲端新專案不會自動授權，本機會；見 20261124000100_explicit_api_grants.sql）。

-- 1. 收藏：品牌只能讀、新增、刪除自己的收藏；不開放 UPDATE。
--    收藏未審核的創作者資料庫允許（審核狀態會變），廣場只列出已審核的人。
create table public.creator_favorites (
  brand_id uuid not null references public.brand_profiles (user_id) on delete cascade,
  creator_id uuid not null references public.creator_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (brand_id, creator_id)
);
alter table public.creator_favorites enable row level security;

create policy creator_favorites_select_own on public.creator_favorites
  for select to authenticated using (brand_id = auth.uid());
create policy creator_favorites_insert_own on public.creator_favorites
  for insert to authenticated with check (brand_id = auth.uid() and public.my_role() = 'brand');
create policy creator_favorites_delete_own on public.creator_favorites
  for delete to authenticated using (brand_id = auth.uid());

-- 本機的預設權限會自動授權全部，先全部收回再明確授權（created_at 由預設值決定，不接受寫入）
revoke all on public.creator_favorites from anon, authenticated, service_role;
grant select, delete on public.creator_favorites to authenticated;
grant insert (brand_id, creator_id) on public.creator_favorites to authenticated;
grant select on public.creator_favorites to service_role;

-- 2. 索引（followups「4. 創作者廣場」）
create index creator_profiles_status_created_idx on public.creator_profiles (status, created_at desc);
create index creator_profiles_categories_gin on public.creator_profiles using gin (categories);
create index creator_profiles_style_tags_gin on public.creator_profiles using gin (style_tags);
create index creator_profiles_collab_types_gin on public.creator_profiles using gin (collab_types);
create index creator_rates_creator_price_idx on public.creator_rates (creator_id, price_twd);
create index creator_favorites_brand_created_idx on public.creator_favorites (brand_id, created_at desc);

-- 3. 搜尋：只給品牌；只回傳已審核的創作者。結果含報價，所以不能給品牌以外的人（報價只給品牌看）。
--    多選欄位內是 OR（&&、= any），不同欄位之間是 AND；空陣列或 null 代表不篩選。
--    清單以外的值不報錯，只是比對不到（followups：搜尋必須能容忍清單以外的值）。
--    區間是「下限含、上限不含」：p_follower_min <= 粉絲 < p_follower_max；p_price_min <= 起價 < p_price_max。
--    起價 = 該創作者所有報價的最低價；有起價區間時，沒有報價的人不列出。
--    p_sort 不認得時當成 newest；p_limit 夾在 1..48；排序最後一律以 created_at desc, user_id 決定，分頁穩定。
--    total_count 是符合條件的總數（window 函式，與資料同一次查詢）。
create function public.search_creators(
  p_keyword text default null,
  p_favorites_only boolean default false,
  p_categories text[] default null,
  p_style_tags text[] default null,
  p_follower_min integer default null,
  p_follower_max integer default null,
  p_engagement_min numeric default null,
  p_price_min integer default null,
  p_price_max integer default null,
  p_regions text[] default null,
  p_collab_types text[] default null,
  p_sort text default 'newest',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  handle text,
  display_name text,
  avatar_path text,
  region text,
  categories text[],
  style_tags text[],
  collab_types text[],
  follower_count integer,
  engagement_rate numeric,
  min_price integer,
  post_price integer,
  portfolio_paths text[],
  is_favorite boolean,
  created_at timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_kw text := nullif(left(public.clean_text(p_keyword), 100), '');
  v_pattern text;
  v_sort text := case when p_sort in ('newest', 'followers', 'engagement', 'price') then p_sort else 'newest' end;
  v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 48);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null or public.my_role() is distinct from 'brand' then
    raise exception 'not a brand' using errcode = '42501';
  end if;
  -- 關鍵字照字面比對：先跳脫 \，再跳脫 % 與 _
  if v_kw is not null then
    v_pattern := '%' || replace(replace(replace(v_kw, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  with base as (
    select cp.user_id, cp.handle, p.display_name, cp.avatar_path, cp.region, cp.categories,
           cp.style_tags, cp.collab_types, cp.follower_count, cp.engagement_rate, cp.created_at,
           (select min(r.price_twd) from public.creator_rates r where r.creator_id = cp.user_id) as min_price,
           (select r.price_twd from public.creator_rates r
             where r.creator_id = cp.user_id and r.collab_type = 'IG 貼文') as post_price,
           exists (select 1 from public.creator_favorites f
                    where f.brand_id = v_uid and f.creator_id = cp.user_id) as is_favorite
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
     where cp.status = 'approved'
       and (v_pattern is null
            or p.display_name ilike v_pattern escape '\'
            or cp.handle ilike v_pattern escape '\'
            or cp.ig_username ilike v_pattern escape '\')
       and (coalesce(cardinality(p_categories), 0) = 0 or cp.categories && p_categories)
       and (coalesce(cardinality(p_style_tags), 0) = 0 or cp.style_tags && p_style_tags)
       and (coalesce(cardinality(p_collab_types), 0) = 0 or cp.collab_types && p_collab_types)
       and (coalesce(cardinality(p_regions), 0) = 0 or cp.region = any (p_regions))
       and (p_follower_min is null or cp.follower_count >= p_follower_min)
       and (p_follower_max is null or cp.follower_count < p_follower_max)
       and (p_engagement_min is null or cp.engagement_rate >= p_engagement_min)
  ),
  filtered as (
    select b.* from base b
     where (not coalesce(p_favorites_only, false) or b.is_favorite)
       and (p_price_min is null or b.min_price >= p_price_min)
       and (p_price_max is null or b.min_price < p_price_max)
  ),
  paged as (
    select f.*,
           count(*) over () as total_count,
           row_number() over (
             order by
               case when v_sort = 'followers' then f.follower_count end desc nulls last,
               case when v_sort = 'engagement' then f.engagement_rate end desc nulls last,
               case when v_sort = 'price' then f.min_price end asc nulls last,
               f.created_at desc,
               f.user_id
           ) as rn
      from filtered f
     order by rn
     limit v_limit offset v_offset
  )
  select pg.user_id, pg.handle, pg.display_name, pg.avatar_path, pg.region, pg.categories,
         pg.style_tags, pg.collab_types, pg.follower_count, pg.engagement_rate::numeric,
         pg.min_price, pg.post_price,
         array(select pi.image_path from public.creator_portfolio_items pi
                where pi.creator_id = pg.user_id order by pi.position limit 3),
         pg.is_favorite, pg.created_at, pg.total_count
    from paged pg
   order by pg.rn;
end;
$$;
revoke execute on function public.search_creators(
  text, boolean, text[], text[], integer, integer, numeric, integer, integer, text[], text[], text, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function public.search_creators(
  text, boolean, text[], text[], integer, integer, numeric, integer, integer, text[], text[], text, integer, integer
) to authenticated;

-- 4. 熱門風格標籤：已審核創作者用過的風格標籤與使用次數，最多 20 個（次數多的在前，同次數依標籤排序）
create function public.popular_style_tags()
returns table (tag text, uses bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null or public.my_role() is distinct from 'brand' then
    raise exception 'not a brand' using errcode = '42501';
  end if;
  return query
  select t.tag, count(*) as uses
    from public.creator_profiles cp
    cross join lateral unnest(cp.style_tags) as t(tag)
   where cp.status = 'approved'
   group by t.tag
   order by count(*) desc, t.tag
   limit 20;
end;
$$;
revoke execute on function public.popular_style_tags() from public, anon, authenticated, service_role;
grant execute on function public.popular_style_tags() to authenticated;
```

- [ ] **Step 4: 套用 migration、執行測試**

```bash
npx supabase migration up
npx supabase test db
```
Expected: 全部通過；`10_creator_square.test.sql` 是 `ok 1..96`。

- [ ] **Step 5: 產生型別並確認**

```bash
npm run db:types
grep -n '"search_creators"\|"popular_style_tags"\|creator_favorites:' src/lib/supabase/database.types.ts
npm run typecheck
```
Expected: 三個名稱都找得到；`search_creators` 的 Args 每個參數都是可省略（`?`）；typecheck 通過。

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261124000400_creator_square.sql supabase/tests/10_creator_square.test.sql src/lib/supabase/database.types.ts
git commit -m "計畫 4 Task 1：收藏資料表、search_creators、popular_style_tags 與索引"
```

---

### Task 2: 純函式：網址查詢、廣場資料轉換、顯示模式

**Files:**
- Create: `src/lib/creators/square-query.ts`、`src/lib/creators/square-query.test.ts`、`src/lib/creators/square-view.ts`、`src/lib/creators/square-view.test.ts`、`src/lib/creators/view-mode.ts`、`src/lib/creators/view-mode.test.ts`
- Modify: `src/lib/creators/view.ts`（`toNumberOrNull` 加 `export`）

**Interfaces:**
- Consumes: `cleanText`、`hasBidi`（`src/lib/validation/onboarding.ts`）；`formatTwd`（`src/lib/format.ts`）；`toNumberOrNull`（`src/lib/creators/view.ts`）。
- Produces:
  - `square-query.ts`：`SQUARE_PAGE_SIZE = 24`、`KEYWORD_MAX = 50`、`SQUARE_SORTS`、`type SquareSort = "newest" | "followers" | "engagement" | "price"`、`SORT_LABELS`、`FOLLOWER_RANGES`、`ENGAGEMENT_OPTIONS`、`PRICE_RANGES`、`type FollowerKey`、`type EngagementKey`、`type PriceKey`、`type SquareQuery = { q: string; fav: boolean; categories: string[]; tags: string[]; followers: FollowerKey | null; engagement: EngagementKey | null; price: PriceKey | null; regions: string[]; collabs: string[]; sort: SquareSort }`、`EMPTY_SQUARE_QUERY`、`type ParamsInput = URLSearchParams | Record<string, string | string[] | undefined>`、`parseSquareQuery(input: ParamsInput): SquareQuery`、`serializeSquareQuery(q: SquareQuery): string`、`squareHref(q: SquareQuery): string`、`activeFilterCount(q: SquareQuery): number`、`clearFilters(q: SquareQuery): SquareQuery`、`toggleValue(list: string[], v: string): string[]`、`emptyStateOf(q: SquareQuery): "no-favorites" | "no-results"`、`type SearchArgs`、`toSearchArgs(q: SquareQuery, offset: number, limit?: number): SearchArgs`。
  - `square-view.ts`：`type SquareCreator = { userId; handle; displayName; avatarPath: string | null; region: string | null; categories: string[]; styleTags: string[]; collabTypes: string[]; followerCount: number; engagementRate: number | null; minPrice: number | null; postPrice: number | null; portfolioPaths: string[]; isFavorite: boolean }`、`type SquareCreatorRow`（全部欄位可為 null）、`type SquarePage = { items: SquareCreator[]; total: number; hasMore: boolean }`、`toSquareCreator(r)`、`toSquarePage(rows, offset)`、`cardTags(c, max = 3)`、`startingPriceLabel(minPrice)`、`postPriceLabel(price)`、`appendUnique(current, next)`。
  - `view-mode.ts`：`type ViewMode = "card" | "list"`、`VIEW_MODE_KEY = "kollink:square-view"`、`readViewMode(store)`、`writeViewMode(store, mode)`。
  - `view.ts`：`export function toNumberOrNull(v: number | string | null): number | null`。

- [ ] **Step 1: 寫失敗的測試 `src/lib/creators/square-query.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  EMPTY_SQUARE_QUERY, activeFilterCount, clearFilters, emptyStateOf, parseSquareQuery, serializeSquareQuery,
  squareHref, toSearchArgs, toggleValue, type SquareQuery,
} from "./square-query";

describe("parseSquareQuery", () => {
  it("沒有參數時是預設值", () => {
    expect(parseSquareQuery({})).toEqual(EMPTY_SQUARE_QUERY);
    expect(parseSquareQuery(new URLSearchParams())).toEqual(EMPTY_SQUARE_QUERY);
  });

  it("讀取全部欄位（Next 的 searchParams 物件）", () => {
    expect(parseSquareQuery({
      q: "  小美 ", fav: "1", cat: ["美妝", "旅遊"], tag: "日系", followers: "1k-10k", er: "3",
      price: "lt5k", region: ["台北市"], collab: "Reels", sort: "followers",
    })).toEqual({
      q: "小美", fav: true, categories: ["美妝", "旅遊"], tags: ["日系"], followers: "1k-10k", engagement: "3",
      price: "lt5k", regions: ["台北市"], collabs: ["Reels"], sort: "followers",
    });
  });

  it("讀取 URLSearchParams（Server Action 收到的查詢字串）", () => {
    const q = parseSquareQuery(new URLSearchParams("cat=%E7%BE%8E%E5%A6%9D&cat=3C&sort=price"));
    expect(q).toMatchObject({ categories: ["美妝", "3C"], sort: "price" });
  });

  it("不認得的區間、排序、收藏值當成沒選", () => {
    expect(parseSquareQuery({ followers: "huge", er: "99", price: "free", sort: "drop table", fav: "yes" }))
      .toEqual(EMPTY_SQUARE_QUERY);
  });

  it("清單以外的多選值保留（資料庫比對不到就是沒有結果，不會報錯）", () => {
    expect(parseSquareQuery({ cat: "怪類別", region: "Narnia" })).toMatchObject({ categories: ["怪類別"], regions: ["Narnia"] });
  });

  it("多選值去掉空白、空字串、重複、含雙向控制字元、超過 30 字的；最多 20 個", () => {
    const many = Array.from({ length: 25 }, (_, i) => `t${i}`);
    expect(parseSquareQuery({ tag: [" a ", "", "a", "b‮", "x".repeat(31), ...many] }).tags)
      .toEqual(["a", ...many.slice(0, 19)]);
  });

  it("關鍵字最多 50 字；含雙向控制字元時當成沒填；陣列只取第一個", () => {
    expect(parseSquareQuery({ q: "字".repeat(80) }).q).toBe("字".repeat(50));
    expect(parseSquareQuery({ q: "a‮b" }).q).toBe("");
    expect(parseSquareQuery({ q: ["first", "second"] }).q).toBe("first");
  });
});

describe("serializeSquareQuery / squareHref", () => {
  const full: SquareQuery = {
    q: "小美", fav: true, categories: ["美妝", "旅遊"], tags: ["日系"], followers: "1k-10k", engagement: "3",
    price: "lt5k", regions: ["台北市"], collabs: ["Reels"], sort: "followers",
  };

  it("預設值輸出空字串，網址是 /brand", () => {
    expect(serializeSquareQuery(EMPTY_SQUARE_QUERY)).toBe("");
    expect(squareHref(EMPTY_SQUARE_QUERY)).toBe("/brand");
  });

  it("解析後再輸出會得到相同的查詢（可以分享、重新整理）", () => {
    const s = serializeSquareQuery(full);
    expect(parseSquareQuery(new URLSearchParams(s))).toEqual(full);
    expect(squareHref(full)).toBe(`/brand?${s}`);
  });

  it("排序是 newest 時不寫進網址；收藏寫成 fav=1", () => {
    expect(serializeSquareQuery({ ...EMPTY_SQUARE_QUERY, fav: true })).toBe("fav=1");
    expect(serializeSquareQuery({ ...EMPTY_SQUARE_QUERY, sort: "price" })).toBe("sort=price");
  });
});

describe("activeFilterCount / clearFilters / toggleValue / emptyStateOf", () => {
  it("計算有幾個欄位在篩選（排序不算）", () => {
    expect(activeFilterCount(EMPTY_SQUARE_QUERY)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_SQUARE_QUERY, sort: "price" })).toBe(0);
    expect(activeFilterCount({ ...EMPTY_SQUARE_QUERY, q: "a", fav: true, categories: ["美妝", "旅遊"], price: "lt5k" })).toBe(4);
  });

  it("清除篩選保留排序", () => {
    expect(clearFilters({ ...EMPTY_SQUARE_QUERY, q: "a", regions: ["台北市"], sort: "engagement" }))
      .toEqual({ ...EMPTY_SQUARE_QUERY, sort: "engagement" });
  });

  it("toggleValue 加入或移除", () => {
    expect(toggleValue(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
  });

  it("只開了「只看收藏」時是 no-favorites，其他都是 no-results", () => {
    expect(emptyStateOf({ ...EMPTY_SQUARE_QUERY, fav: true })).toBe("no-favorites");
    expect(emptyStateOf({ ...EMPTY_SQUARE_QUERY, fav: true, sort: "price" })).toBe("no-favorites");
    expect(emptyStateOf({ ...EMPTY_SQUARE_QUERY, fav: true, q: "a" })).toBe("no-results");
    expect(emptyStateOf(EMPTY_SQUARE_QUERY)).toBe("no-results");
  });
});

describe("toSearchArgs", () => {
  it("沒有篩選時只帶排序與分頁", () => {
    expect(toSearchArgs(EMPTY_SQUARE_QUERY, 0)).toEqual({ p_sort: "newest", p_limit: 24, p_offset: 0 });
  });

  it("區間轉成含下限、不含上限的數字", () => {
    expect(toSearchArgs({ ...EMPTY_SQUARE_QUERY, followers: "lt1k", price: "gte20k" }, 24)).toEqual({
      p_sort: "newest", p_limit: 24, p_offset: 24, p_follower_max: 1000, p_price_min: 20000,
    });
    expect(toSearchArgs({ ...EMPTY_SQUARE_QUERY, followers: "10k-100k", price: "5k-20k", engagement: "5" }, 0)).toMatchObject({
      p_follower_min: 10000, p_follower_max: 100000, p_price_min: 5000, p_price_max: 20000, p_engagement_min: 5,
    });
  });

  it("全部欄位", () => {
    expect(toSearchArgs({
      q: "mei", fav: true, categories: ["美妝"], tags: ["日系"], followers: null, engagement: null, price: null,
      regions: ["台北市"], collabs: ["Reels"], sort: "price",
    }, 48, 12)).toEqual({
      p_sort: "price", p_limit: 12, p_offset: 48, p_keyword: "mei", p_favorites_only: true, p_categories: ["美妝"],
      p_style_tags: ["日系"], p_regions: ["台北市"], p_collab_types: ["Reels"],
    });
  });
});
```

- [ ] **Step 2: 寫失敗的測試 `src/lib/creators/square-view.test.ts` 與 `src/lib/creators/view-mode.test.ts`**

`src/lib/creators/square-view.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import {
  appendUnique, cardTags, postPriceLabel, startingPriceLabel, toSquareCreator, toSquarePage,
  type SquareCreator, type SquareCreatorRow,
} from "./square-view";

const row: SquareCreatorRow = {
  user_id: "u1", handle: "mei", display_name: "小美", avatar_path: null, region: "台北市", categories: ["美妝"],
  style_tags: null, collab_types: ["IG 貼文"], follower_count: 12000, engagement_rate: "3.50", min_price: 4500,
  post_price: null, portfolio_paths: null, is_favorite: null, created_at: "2026-11-24T00:00:00Z", total_count: 30,
};

const creator = (over: Partial<SquareCreator> = {}): SquareCreator => ({ ...toSquareCreator(row), ...over });

describe("toSquareCreator", () => {
  it("轉成駝峰欄位；null 陣列變空陣列；numeric 字串轉數字；is_favorite 只有 true 才算", () => {
    expect(toSquareCreator(row)).toEqual({
      userId: "u1", handle: "mei", displayName: "小美", avatarPath: null, region: "台北市", categories: ["美妝"],
      styleTags: [], collabTypes: ["IG 貼文"], followerCount: 12000, engagementRate: 3.5, minPrice: 4500,
      postPrice: null, portfolioPaths: [], isFavorite: false,
    });
  });
  it("粉絲數是 null 時當 0", () => {
    expect(toSquareCreator({ ...row, follower_count: null }).followerCount).toBe(0);
  });
});

describe("toSquarePage", () => {
  it("total 取第一列的 total_count；還有下一批時 hasMore 是 true", () => {
    const page = toSquarePage([row, { ...row, user_id: "u2" }], 0);
    expect(page.total).toBe(30);
    expect(page.items.map((c) => c.userId)).toEqual(["u1", "u2"]);
    expect(page.hasMore).toBe(true);
  });
  it("最後一批 hasMore 是 false", () => {
    expect(toSquarePage([{ ...row, total_count: "26" }, row], 24).hasMore).toBe(false);
  });
  it("沒有資料時 total 是 0、沒有下一批", () => {
    expect(toSquarePage([], 0)).toEqual({ items: [], total: 0, hasMore: false });
  });
});

describe("卡片顯示", () => {
  it("標籤最多 3 個，風格標籤優先，不夠再用合作類型補，不重複", () => {
    expect(cardTags(creator({ styleTags: ["日系"], collabTypes: ["IG 貼文", "Reels", "限時動態"] })))
      .toEqual(["日系", "IG 貼文", "Reels"]);
    expect(cardTags(creator({ styleTags: ["a", "b", "c", "d"], collabTypes: ["IG 貼文"] }))).toEqual(["a", "b", "c"]);
    expect(cardTags(creator({ styleTags: ["Reels"], collabTypes: ["Reels"] }))).toEqual(["Reels"]);
  });
  it("起價：沒有報價顯示「洽談」", () => {
    expect(startingPriceLabel(null)).toBe("洽談");
    expect(startingPriceLabel(4500)).toBe("NT$4,500");
    expect(startingPriceLabel(0)).toBe("NT$0");
  });
  it("貼文報價：沒有顯示「—」", () => {
    expect(postPriceLabel(null)).toBe("—");
    expect(postPriceLabel(12000)).toBe("NT$12,000");
  });
});

describe("appendUnique", () => {
  it("接在後面並去掉已經顯示過的人", () => {
    const a = creator({ userId: "a" });
    const b = creator({ userId: "b" });
    const c = creator({ userId: "c" });
    expect(appendUnique([a, b], [b, c]).map((x) => x.userId)).toEqual(["a", "b", "c"]);
  });
});
```

`src/lib/creators/view-mode.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { VIEW_MODE_KEY, readViewMode, writeViewMode } from "./view-mode";

describe("readViewMode", () => {
  it("存的是 list 才是列表，其他都是卡片", () => {
    expect(readViewMode({ getItem: () => "list" })).toBe("list");
    expect(readViewMode({ getItem: () => "card" })).toBe("card");
    expect(readViewMode({ getItem: () => "weird" })).toBe("card");
    expect(readViewMode({ getItem: () => null })).toBe("card");
    expect(readViewMode(null)).toBe("card");
  });
  it("讀取丟錯時是卡片", () => {
    expect(readViewMode({ getItem: () => { throw new Error("SecurityError"); } })).toBe("card");
  });
});

describe("writeViewMode", () => {
  it("寫入固定的 key", () => {
    const saved: Record<string, string> = {};
    writeViewMode({ setItem: (k, v) => { saved[k] = v; } }, "list");
    expect(saved).toEqual({ [VIEW_MODE_KEY]: "list" });
  });
  it("寫入丟錯或沒有 storage 時不丟出", () => {
    expect(() => writeViewMode({ setItem: () => { throw new Error("QuotaExceededError"); } }, "list")).not.toThrow();
    expect(() => writeViewMode(null, "card")).not.toThrow();
  });
});
```

- [ ] **Step 3: 執行測試，確認失敗**

Run: `npx vitest run src/lib/creators/square-query.test.ts src/lib/creators/square-view.test.ts src/lib/creators/view-mode.test.ts`
Expected: FAIL（找不到模組）。

- [ ] **Step 4: 實作 `src/lib/creators/square-query.ts`**

```ts
import { cleanText, hasBidi } from "@/lib/validation/onboarding";

export const SQUARE_PAGE_SIZE = 24;
export const KEYWORD_MAX = 50;
const VALUE_MAX = 30;
const LIST_MAX = 20;

export const SQUARE_SORTS = ["newest", "followers", "engagement", "price"] as const;
export type SquareSort = (typeof SQUARE_SORTS)[number];
export const SORT_LABELS: Record<SquareSort, string> = {
  newest: "最新加入",
  followers: "粉絲數（高到低）",
  engagement: "互動率（高到低）",
  price: "起價（低到高）",
};

// 區間一律「含下限、不含上限」，與 search_creators 的 p_*_min／p_*_max 相同
export const FOLLOWER_RANGES = [
  { key: "lt1k", label: "1 千以下", min: null, max: 1000 },
  { key: "1k-10k", label: "1 千到 1 萬", min: 1000, max: 10000 },
  { key: "10k-100k", label: "1 萬到 10 萬", min: 10000, max: 100000 },
  { key: "gte100k", label: "10 萬以上", min: 100000, max: null },
] as const;
export const ENGAGEMENT_OPTIONS = [
  { key: "1", label: "≥ 1%", min: 1 },
  { key: "3", label: "≥ 3%", min: 3 },
  { key: "5", label: "≥ 5%", min: 5 },
] as const;
export const PRICE_RANGES = [
  { key: "lt5k", label: "5 千以下", min: null, max: 5000 },
  { key: "5k-20k", label: "5 千到 2 萬", min: 5000, max: 20000 },
  { key: "gte20k", label: "2 萬以上", min: 20000, max: null },
] as const;

export type FollowerKey = (typeof FOLLOWER_RANGES)[number]["key"];
export type EngagementKey = (typeof ENGAGEMENT_OPTIONS)[number]["key"];
export type PriceKey = (typeof PRICE_RANGES)[number]["key"];

export type SquareQuery = {
  q: string;
  fav: boolean;
  categories: string[];
  tags: string[];
  followers: FollowerKey | null;
  engagement: EngagementKey | null;
  price: PriceKey | null;
  regions: string[];
  collabs: string[];
  sort: SquareSort;
};

export const EMPTY_SQUARE_QUERY: SquareQuery = {
  q: "", fav: false, categories: [], tags: [], followers: null, engagement: null, price: null,
  regions: [], collabs: [], sort: "newest",
};

/** 網址參數名稱：分享出去的網址就長這樣，改名會讓舊網址失效。 */
const P = {
  q: "q", fav: "fav", categories: "cat", tags: "tag", followers: "followers", engagement: "er",
  price: "price", regions: "region", collabs: "collab", sort: "sort",
} as const;

export type ParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

function getAll(input: ParamsInput, key: string): string[] {
  if (input instanceof URLSearchParams) return input.getAll(key);
  const v = input[key];
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === "string");
}

/** 多選值：清理後去掉空的、含雙向控制字元的、超過 30 字的、重複的；最多 20 個。清單以外的值保留。 */
function parseList(input: ParamsInput, key: string): string[] {
  const out: string[] = [];
  for (const raw of getAll(input, key)) {
    const v = cleanText(raw);
    if (!v || hasBidi(v) || Array.from(v).length > VALUE_MAX || out.includes(v)) continue;
    out.push(v);
    if (out.length === LIST_MAX) break;
  }
  return out;
}

function parseKey<K extends string>(input: ParamsInput, key: string, options: readonly { key: K }[]): K | null {
  const v = getAll(input, key)[0];
  return options.find((o) => o.key === v)?.key ?? null;
}

/** 網址 → 查詢條件。任何值都不會丟錯：不認得的單選值當成沒選、多選值照上面的規則清理。 */
export function parseSquareQuery(input: ParamsInput): SquareQuery {
  const q = cleanText(getAll(input, P.q)[0] ?? "");
  const sort = getAll(input, P.sort)[0] ?? "";
  return {
    q: hasBidi(q) ? "" : Array.from(q).slice(0, KEYWORD_MAX).join(""),
    fav: getAll(input, P.fav)[0] === "1",
    categories: parseList(input, P.categories),
    tags: parseList(input, P.tags),
    followers: parseKey(input, P.followers, FOLLOWER_RANGES),
    engagement: parseKey(input, P.engagement, ENGAGEMENT_OPTIONS),
    price: parseKey(input, P.price, PRICE_RANGES),
    regions: parseList(input, P.regions),
    collabs: parseList(input, P.collabs),
    sort: (SQUARE_SORTS as readonly string[]).includes(sort) ? (sort as SquareSort) : "newest",
  };
}

/** 查詢條件 → 查詢字串（不含 ?）。預設值不輸出，所以沒有篩選時是空字串。 */
export function serializeSquareQuery(q: SquareQuery): string {
  const sp = new URLSearchParams();
  if (q.q) sp.set(P.q, q.q);
  if (q.fav) sp.set(P.fav, "1");
  for (const v of q.categories) sp.append(P.categories, v);
  for (const v of q.tags) sp.append(P.tags, v);
  if (q.followers) sp.set(P.followers, q.followers);
  if (q.engagement) sp.set(P.engagement, q.engagement);
  if (q.price) sp.set(P.price, q.price);
  for (const v of q.regions) sp.append(P.regions, v);
  for (const v of q.collabs) sp.append(P.collabs, v);
  if (q.sort !== "newest") sp.set(P.sort, q.sort);
  return sp.toString();
}

export function squareHref(q: SquareQuery): string {
  const s = serializeSquareQuery(q);
  return s ? `/brand?${s}` : "/brand";
}

/** 有幾個欄位在篩選（排序不算），手機「篩選（N）」按鈕用。 */
export function activeFilterCount(q: SquareQuery): number {
  return [
    q.q !== "", q.fav, q.categories.length > 0, q.tags.length > 0, q.followers !== null,
    q.engagement !== null, q.price !== null, q.regions.length > 0, q.collabs.length > 0,
  ].filter(Boolean).length;
}

/** 清除篩選：保留排序。 */
export function clearFilters(q: SquareQuery): SquareQuery {
  return { ...EMPTY_SQUARE_QUERY, sort: q.sort };
}

export function toggleValue(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** 沒有結果時顯示哪一種空狀態：只開了「只看收藏」→ 還沒有收藏；其他 → 找不到符合條件。 */
export function emptyStateOf(q: SquareQuery): "no-favorites" | "no-results" {
  return q.fav && activeFilterCount(q) === 1 ? "no-favorites" : "no-results";
}

/** search_creators 的參數；沒有篩選的欄位不帶（用資料庫的預設值）。 */
export type SearchArgs = {
  p_keyword?: string;
  p_favorites_only?: boolean;
  p_categories?: string[];
  p_style_tags?: string[];
  p_follower_min?: number;
  p_follower_max?: number;
  p_engagement_min?: number;
  p_price_min?: number;
  p_price_max?: number;
  p_regions?: string[];
  p_collab_types?: string[];
  p_sort: SquareSort;
  p_limit: number;
  p_offset: number;
};

export function toSearchArgs(q: SquareQuery, offset: number, limit: number = SQUARE_PAGE_SIZE): SearchArgs {
  const args: SearchArgs = { p_sort: q.sort, p_limit: limit, p_offset: offset };
  if (q.q) args.p_keyword = q.q;
  if (q.fav) args.p_favorites_only = true;
  if (q.categories.length) args.p_categories = q.categories;
  if (q.tags.length) args.p_style_tags = q.tags;
  if (q.regions.length) args.p_regions = q.regions;
  if (q.collabs.length) args.p_collab_types = q.collabs;
  const f = FOLLOWER_RANGES.find((r) => r.key === q.followers);
  if (f && f.min !== null) args.p_follower_min = f.min;
  if (f && f.max !== null) args.p_follower_max = f.max;
  const e = ENGAGEMENT_OPTIONS.find((o) => o.key === q.engagement);
  if (e) args.p_engagement_min = e.min;
  const p = PRICE_RANGES.find((r) => r.key === q.price);
  if (p && p.min !== null) args.p_price_min = p.min;
  if (p && p.max !== null) args.p_price_max = p.max;
  return args;
}
```

- [ ] **Step 5: 匯出 `toNumberOrNull`，實作 `src/lib/creators/square-view.ts` 與 `src/lib/creators/view-mode.ts`**

`src/lib/creators/view.ts` 第 65 行：

```ts
function toNumberOrNull(v: number | string | null): number | null {
```
改成
```ts
export function toNumberOrNull(v: number | string | null): number | null {
```

`src/lib/creators/square-view.ts`：

```ts
import { formatTwd } from "@/lib/format";
import { toNumberOrNull } from "./view";

export type SquareCreator = {
  userId: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  region: string | null;
  categories: string[];
  styleTags: string[];
  collabTypes: string[];
  followerCount: number;
  engagementRate: number | null;
  minPrice: number | null;
  postPrice: number | null;
  portfolioPaths: string[];
  isFavorite: boolean;
};

/** search_creators 回傳的一列。產生的型別把 RETURNS TABLE 的欄位都標成非 null，實際上可能是 null，所以自己定義。 */
export type SquareCreatorRow = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_path: string | null;
  region: string | null;
  categories: string[] | null;
  style_tags: string[] | null;
  collab_types: string[] | null;
  follower_count: number | null;
  engagement_rate: number | string | null;
  min_price: number | null;
  post_price: number | null;
  portfolio_paths: string[] | null;
  is_favorite: boolean | null;
  created_at: string | null;
  total_count: number | string | null;
};

export type SquarePage = { items: SquareCreator[]; total: number; hasMore: boolean };

export function toSquareCreator(r: SquareCreatorRow): SquareCreator {
  return {
    userId: r.user_id,
    handle: r.handle,
    displayName: r.display_name,
    avatarPath: r.avatar_path ?? null,
    region: r.region ?? null,
    categories: r.categories ?? [],
    styleTags: r.style_tags ?? [],
    collabTypes: r.collab_types ?? [],
    followerCount: r.follower_count ?? 0,
    engagementRate: toNumberOrNull(r.engagement_rate),
    minPrice: toNumberOrNull(r.min_price),
    postPrice: toNumberOrNull(r.post_price),
    portfolioPaths: r.portfolio_paths ?? [],
    isFavorite: r.is_favorite === true,
  };
}

/** total 來自第一列的 total_count（window 函式，每列都一樣）。 */
export function toSquarePage(rows: SquareCreatorRow[], offset: number): SquarePage {
  const items = rows.map(toSquareCreator);
  const total = rows.length > 0 ? (toNumberOrNull(rows[0].total_count) ?? 0) : 0;
  return { items, total, hasMore: items.length > 0 && offset + items.length < total };
}

/** 卡片上的標籤：最多 max 個，風格標籤優先，不夠再用合作類型補。 */
export function cardTags(c: Pick<SquareCreator, "styleTags" | "collabTypes">, max = 3): string[] {
  const out: string[] = [];
  for (const t of [...c.styleTags, ...c.collabTypes]) {
    if (out.length === max) break;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export function startingPriceLabel(minPrice: number | null): string {
  return minPrice === null ? "洽談" : formatTwd(minPrice);
}

export function postPriceLabel(price: number | null): string {
  return price === null ? "—" : formatTwd(price);
}

/** 「載入更多」：接在後面並去掉已經顯示過的人（翻頁期間有人新加入時 offset 會位移）。 */
export function appendUnique(current: SquareCreator[], next: SquareCreator[]): SquareCreator[] {
  const seen = new Set(current.map((c) => c.userId));
  return [...current, ...next.filter((c) => !seen.has(c.userId))];
}
```

`src/lib/creators/view-mode.ts`：

```ts
export type ViewMode = "card" | "list";
export const VIEW_MODE_KEY = "kollink:square-view";

type ReadStore = { getItem(key: string): string | null };
type WriteStore = { setItem(key: string, value: string): void };

/** 讀不到（沒有 storage、無痕模式丟錯、值不認得）一律是卡片。 */
export function readViewMode(store: ReadStore | null): ViewMode {
  try {
    return store?.getItem(VIEW_MODE_KEY) === "list" ? "list" : "card";
  } catch {
    return "card";
  }
}

export function writeViewMode(store: WriteStore | null, mode: ViewMode): void {
  try {
    store?.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // 無痕模式或停用儲存空間：忽略，這次瀏覽由呼叫端記在記憶體
  }
}
```

- [ ] **Step 6: 執行測試，確認通過**

Run: `npx vitest run src/lib/creators/`
Expected: PASS（含既有的 `view.test.ts`）。

- [ ] **Step 7: 全部檢查並 Commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/lib/creators/square-query.ts src/lib/creators/square-query.test.ts src/lib/creators/square-view.ts src/lib/creators/square-view.test.ts src/lib/creators/view-mode.ts src/lib/creators/view-mode.test.ts src/lib/creators/view.ts
git commit -m "計畫 4 Task 2：廣場網址查詢解析與輸出、資料轉換、顯示模式儲存"
```

---

### Task 3: 伺服器端讀取與 Server Action

**Files:**
- Create: `src/lib/creators/square.ts`、`src/lib/creators/square.test.ts`、`src/app/brand/actions.ts`、`src/app/brand/actions.test.ts`
- Modify: `src/lib/creators/public-profile.ts`、`src/lib/creators/public-profile.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `search_creators`、`popular_style_tags`、`creator_favorites`；Task 2 的 `toSearchArgs`、`parseSquareQuery`、`toSquarePage`、`SquareCreatorRow`、`SquarePage`、`SquareCreator`、`SquareQuery`；`requireRole`（`src/lib/auth/current-user.ts`）；`createClient`（`src/lib/supabase/server.ts`）。
- Produces:
  - `searchSquare(query: SquareQuery, offset?: number): Promise<SquarePage>`（server-only，丟出資料庫錯誤）
  - `loadPopularStyleTags(): Promise<string[]>`（server-only）
  - `loadIsFavorite(creatorId: string): Promise<boolean>`（`public-profile.ts`，server-only）
  - `src/app/brand/actions.ts`（`"use server"`）：
    - `type FavoriteResult = { ok: true } | { ok: false; error: string }`
    - `setFavoriteAction(creatorId: unknown, favorite: unknown): Promise<FavoriteResult>`
    - `type LoadMoreResult = { ok: true; items: SquareCreator[]; hasMore: boolean } | { ok: false; error: string }`
    - `loadMoreCreatorsAction(query: unknown, offset: unknown): Promise<LoadMoreResult>`

- [ ] **Step 1: 寫失敗的測試 `src/lib/creators/square.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { loadPopularStyleTags, searchSquare } from "./square";
import { EMPTY_SQUARE_QUERY } from "./square-query";

const row = {
  user_id: "u1", handle: "mei", display_name: "小美", avatar_path: null, region: "台北市", categories: ["美妝"],
  style_tags: [], collab_types: [], follower_count: 100, engagement_rate: null, min_price: null, post_price: null,
  portfolio_paths: [], is_favorite: true, created_at: "2026-11-24T00:00:00Z", total_count: 1,
};

beforeEach(() => rpc.mockReset());

describe("searchSquare", () => {
  it("把查詢轉成 search_creators 參數並轉換結果", async () => {
    rpc.mockResolvedValue({ data: [row], error: null });
    const page = await searchSquare({ ...EMPTY_SQUARE_QUERY, categories: ["美妝"] }, 24);
    expect(rpc).toHaveBeenCalledWith("search_creators", { p_sort: "newest", p_limit: 24, p_offset: 24, p_categories: ["美妝"] });
    expect(page.items[0]).toMatchObject({ userId: "u1", isFavorite: true });
  });
  it("預設 offset 是 0；沒有資料時是空的", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await searchSquare(EMPTY_SQUARE_QUERY)).toEqual({ items: [], total: 0, hasMore: false });
    expect(rpc).toHaveBeenCalledWith("search_creators", { p_sort: "newest", p_limit: 24, p_offset: 0 });
  });
  it("資料庫錯誤時丟出", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(searchSquare(EMPTY_SQUARE_QUERY)).rejects.toEqual({ message: "boom" });
  });
});

describe("loadPopularStyleTags", () => {
  it("回傳標籤文字，去掉 null", async () => {
    rpc.mockResolvedValue({ data: [{ tag: "日系", uses: 3 }, { tag: null, uses: 1 }], error: null });
    expect(await loadPopularStyleTags()).toEqual(["日系"]);
    expect(rpc).toHaveBeenCalledWith("popular_style_tags");
  });
  it("資料庫錯誤時丟出", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(loadPopularStyleTags()).rejects.toEqual({ message: "boom" });
  });
});
```

- [ ] **Step 2: 在 `src/lib/creators/public-profile.test.ts` 加 `loadIsFavorite` 的測試**

import 那一行改成：

```ts
import { loadApprovedCreatorAsGuest, loadIsFavorite, loadPortfolio, loadPublicCreator, loadRates } from "./public-profile";
```

檔案最後加上：

```ts
describe("loadIsFavorite", () => {
  it("查得到收藏是 true（RLS 只讓品牌看到自己的收藏）", async () => {
    const q = chain({ data: { creator_id: "u1" }, error: null });
    from.mockReturnValue(q);
    expect(await loadIsFavorite("u1")).toBe(true);
    expect(from).toHaveBeenCalledWith("creator_favorites");
    expect(q.eq).toHaveBeenCalledWith("creator_id", "u1");
  });
  it("查不到是 false", async () => {
    from.mockReturnValue(chain({ data: null, error: null }));
    expect(await loadIsFavorite("u1")).toBe(false);
  });
  it("資料庫錯誤時丟出", async () => {
    from.mockReturnValue(chain({ data: null, error: { message: "boom" } }));
    await expect(loadIsFavorite("u1")).rejects.toEqual({ message: "boom" });
  });
});
```

- [ ] **Step 3: 寫失敗的測試 `src/app/brand/actions.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, from, searchSquare } = vi.hoisted(() => ({
  requireRole: vi.fn(), from: vi.fn(), searchSquare: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/current-user", () => ({ requireRole }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from }) }));
vi.mock("@/lib/creators/square", () => ({ searchSquare }));

import { loadMoreCreatorsAction, setFavoriteAction } from "./actions";
import { EMPTY_SQUARE_QUERY } from "@/lib/creators/square-query";

const CREATOR = "00000000-0000-0000-0000-0000000000c1";

/** 模擬 supabase-js 的鏈式查詢：每個方法回傳自己，await 時得到 result。 */
function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["insert", "delete", "eq"]) q[m] = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: "brand-1" });
  from.mockReset();
  searchSquare.mockReset();
});

describe("setFavoriteAction", () => {
  it("一定先檢查是品牌", async () => {
    from.mockReturnValue(chain({ error: null }));
    await setFavoriteAction(CREATOR, true);
    expect(requireRole).toHaveBeenCalledWith("brand");
  });
  it("參數格式不對時不碰資料庫", async () => {
    expect(await setFavoriteAction("not-a-uuid", true)).toEqual({ ok: false, error: "資料格式不正確，請重新整理頁面" });
    expect(await setFavoriteAction(CREATOR, "yes")).toMatchObject({ ok: false });
    expect(await setFavoriteAction(123, true)).toMatchObject({ ok: false });
    expect(from).not.toHaveBeenCalled();
  });
  it("收藏：以自己的身分新增", async () => {
    const q = chain({ error: null });
    from.mockReturnValue(q);
    expect(await setFavoriteAction(CREATOR, true)).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("creator_favorites");
    expect(q.insert).toHaveBeenCalledWith({ brand_id: "brand-1", creator_id: CREATOR });
  });
  it("已經收藏過（23505）視為成功", async () => {
    from.mockReturnValue(chain({ error: { code: "23505", message: "duplicate" } }));
    expect(await setFavoriteAction(CREATOR, true)).toEqual({ ok: true });
  });
  it("其他錯誤回傳錯誤訊息", async () => {
    from.mockReturnValue(chain({ error: { code: "23503", message: "fk" } }));
    expect(await setFavoriteAction(CREATOR, true)).toEqual({ ok: false, error: "收藏失敗，請稍後再試" });
  });
  it("取消收藏：只刪自己的那一筆", async () => {
    const q = chain({ error: null });
    from.mockReturnValue(q);
    expect(await setFavoriteAction(CREATOR, false)).toEqual({ ok: true });
    expect(q.delete).toHaveBeenCalled();
    expect(q.eq).toHaveBeenCalledWith("brand_id", "brand-1");
    expect(q.eq).toHaveBeenCalledWith("creator_id", CREATOR);
  });
  it("取消收藏失敗回傳錯誤訊息", async () => {
    from.mockReturnValue(chain({ error: { code: "XX000", message: "boom" } }));
    expect(await setFavoriteAction(CREATOR, false)).toEqual({ ok: false, error: "取消收藏失敗，請稍後再試" });
  });
});

describe("loadMoreCreatorsAction", () => {
  it("在伺服器重新解析查詢字串，回傳下一批", async () => {
    const item = { userId: "u1" };
    searchSquare.mockResolvedValue({ items: [item], total: 30, hasMore: true });
    expect(await loadMoreCreatorsAction("cat=%E7%BE%8E%E5%A6%9D&sort=price&bogus=1", 24))
      .toEqual({ ok: true, items: [item], hasMore: true });
    expect(requireRole).toHaveBeenCalledWith("brand");
    expect(searchSquare).toHaveBeenCalledWith({ ...EMPTY_SQUARE_QUERY, categories: ["美妝"], sort: "price" }, 24);
  });
  it("參數格式不對時不查詢", async () => {
    for (const [q, o] of [[1, 0], ["", -1], ["", 1.5], ["", "24"], ["", 10001], ["x".repeat(4001), 0]] as const) {
      expect(await loadMoreCreatorsAction(q, o)).toEqual({ ok: false, error: "資料格式不正確，請重新整理頁面" });
    }
    expect(searchSquare).not.toHaveBeenCalled();
  });
  it("查詢失敗回傳錯誤訊息，不丟出", async () => {
    searchSquare.mockRejectedValue(new Error("boom"));
    expect(await loadMoreCreatorsAction("", 24)).toEqual({ ok: false, error: "載入失敗，請稍後再試" });
  });
});
```

- [ ] **Step 4: 執行測試，確認失敗**

Run: `npx vitest run src/lib/creators/square.test.ts src/lib/creators/public-profile.test.ts src/app/brand/actions.test.ts`
Expected: FAIL（找不到 `./square`、`./actions`，`loadIsFavorite` 不是函式）。

- [ ] **Step 5: 實作 `src/lib/creators/square.ts`**

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toSearchArgs, type SquareQuery } from "./square-query";
import { toSquarePage, type SquareCreatorRow, type SquarePage } from "./square-view";

/**
 * 以目前品牌的身分搜尋（search_creators 只給品牌，否則 42501）。
 * 會讀 cookie：只能在 requireRole 之後（頁面的 <Suspense> 內或 Server Action）呼叫。不快取。
 */
export async function searchSquare(query: SquareQuery, offset = 0): Promise<SquarePage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_creators", toSearchArgs(query, offset));
  if (error) throw error;
  // 產生的型別把欄位都標成非 null，實際上可能是 null，所以轉成自己的 Row 型別
  return toSquarePage((data ?? []) as unknown as SquareCreatorRow[], offset);
}

/** 已審核創作者用過的風格標籤（最多 20 個，次數多的在前）。 */
export async function loadPopularStyleTags(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("popular_style_tags");
  if (error) throw error;
  return ((data ?? []) as unknown as { tag: string | null }[])
    .map((r) => r.tag)
    .filter((t): t is string => typeof t === "string" && t.length > 0);
}
```

- [ ] **Step 6: 在 `src/lib/creators/public-profile.ts` 檔案最後加上 `loadIsFavorite`**

```ts
/** 目前的品牌有沒有收藏這位創作者。RLS 只讓品牌看到自己的收藏；不是品牌時永遠是 false。會讀 cookies。 */
export async function loadIsFavorite(creatorId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_favorites").select("creator_id").eq("creator_id", creatorId).maybeSingle();
  if (error) throw error;
  return data !== null;
}
```

- [ ] **Step 7: 實作 `src/app/brand/actions.ts`**

```ts
"use server";

import { requireRole } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { searchSquare } from "@/lib/creators/square";
import { parseSquareQuery } from "@/lib/creators/square-query";
import type { SquareCreator } from "@/lib/creators/square-view";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_OFFSET = 10_000;
const MAX_QUERY_LENGTH = 4000;
const BAD_INPUT = "資料格式不正確，請重新整理頁面";

export type FavoriteResult = { ok: true } | { ok: false; error: string };
export type LoadMoreResult = { ok: true; items: SquareCreator[]; hasMore: boolean } | { ok: false; error: string };

/**
 * 收藏或取消收藏。用品牌自己的 client，RLS 只允許改自己的收藏。
 * 不 revalidate：按 ♡ 不重跑整頁搜尋，畫面由 FavoriteButton 的樂觀更新處理（見計畫 4「設計決定」3）。
 */
export async function setFavoriteAction(creatorId: unknown, favorite: unknown): Promise<FavoriteResult> {
  const me = await requireRole("brand");
  if (typeof creatorId !== "string" || !UUID_RE.test(creatorId) || typeof favorite !== "boolean") {
    return { ok: false, error: BAD_INPUT };
  }
  const supabase = await createClient();
  if (favorite) {
    const { error } = await supabase.from("creator_favorites").insert({ brand_id: me.id, creator_id: creatorId });
    // 已經收藏過（連點、另一個分頁）視為成功
    if (error && error.code !== "23505") return { ok: false, error: "收藏失敗，請稍後再試" };
  } else {
    const { error } = await supabase
      .from("creator_favorites").delete().eq("brand_id", me.id).eq("creator_id", creatorId);
    if (error) return { ok: false, error: "取消收藏失敗，請稍後再試" };
  }
  return { ok: true };
}

/** 「載入更多」：query 是目前網址的查詢字串，在伺服器重新解析，不信任 client 傳來的物件。 */
export async function loadMoreCreatorsAction(query: unknown, offset: unknown): Promise<LoadMoreResult> {
  await requireRole("brand");
  if (
    typeof query !== "string" || query.length > MAX_QUERY_LENGTH
    || typeof offset !== "number" || !Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET
  ) {
    return { ok: false, error: BAD_INPUT };
  }
  try {
    const page = await searchSquare(parseSquareQuery(new URLSearchParams(query)), offset);
    return { ok: true, items: page.items, hasMore: page.hasMore };
  } catch {
    return { ok: false, error: "載入失敗，請稍後再試" };
  }
}
```

- [ ] **Step 8: 執行測試，確認通過**

Run: `npx vitest run src/lib/creators/ src/app/brand/`
Expected: PASS。

- [ ] **Step 9: 全部檢查並 Commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/lib/creators/square.ts src/lib/creators/square.test.ts src/lib/creators/public-profile.ts src/lib/creators/public-profile.test.ts src/app/brand/actions.ts src/app/brand/actions.test.ts
git commit -m "計畫 4 Task 3：廣場搜尋與熱門標籤讀取、收藏與載入更多的 Server Action"
```

---

### Task 4: ♡ 收藏按鈕與公開頁的 ♡

**Files:**
- Create: `src/components/square/FavoriteButton.tsx`
- Modify: `src/app/c/[handle]/ProfileView.tsx`、`src/app/c/[handle]/page.tsx`、`src/app/c/[handle]/profile-view.test.ts`

**Interfaces:**
- Consumes: `setFavoriteAction`、`FavoriteResult`（Task 3）；`loadIsFavorite`（Task 3）。
- Produces: `FavoriteButton({ creatorId: string; name: string; initial: boolean }): JSX.Element`（client component；按鈕 `aria-label="收藏 <name>"`、`aria-pressed`；外層是 `relative z-10 inline-flex`，蓋在卡片的整張連結上面也點得到）。`ProfileView` 新增 prop `favorite?: boolean`（只有 `viewer === "brand"` 時顯示 ♡）。
- 測試（renderToStaticMarkup）裡凡是會渲染到 `FavoriteButton` 的檔案，都要 `vi.mock("@/app/brand/actions", () => ({ setFavoriteAction: vi.fn() }))`，否則會載入 `server-only`。

- [ ] **Step 1: 在 `src/app/c/[handle]/profile-view.test.ts` 寫失敗的測試**

整個檔案換成：

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/brand/actions", () => ({ setFavoriteAction: vi.fn() }));
import { ProfileView } from "./ProfileView";
import type { PublicCreator, ViewerKind } from "@/lib/creators/view";

const creator = {
  userId: "u1", handle: "mei", displayName: "Mei", igUsername: "mei", followerCount: 1000, engagementRate: null,
  region: null, categories: [], styleTags: [], collabTypes: [], bio: null, avatarPath: null, audienceAge: null,
} as unknown as PublicCreator;

const html = (viewer: ViewerKind, favorite?: boolean) =>
  renderToStaticMarkup(createElement(ProfileView, { creator, portfolio: [], rates: [], viewer, favorite }));

describe("ProfileView 報價區", () => {
  it("訪客看到登入連結", () => {
    expect(html("guest")).toContain("/login?next=%2Fc%2Fmei");
  });
  it("創作者（含本人）只看到說明文字，沒有登入連結", () => {
    const out = html("creator");
    expect(out).toContain("報價只開放給品牌查看");
    expect(out).not.toContain("/login");
  });
});

describe("ProfileView 收藏 ♡", () => {
  it("品牌看到 ♡，狀態反映是否已收藏", () => {
    expect(html("brand", false)).toContain('aria-label="收藏 Mei" aria-pressed="false"');
    expect(html("brand", true)).toContain('aria-label="收藏 Mei" aria-pressed="true"');
  });
  it("訪客與創作者看不到 ♡", () => {
    expect(html("guest", false)).not.toContain("收藏 Mei");
    expect(html("creator", false)).not.toContain("收藏 Mei");
  });
});
```

- [ ] **Step 2: 執行測試，確認失敗**

Run: `npx vitest run "src/app/c/[handle]/profile-view.test.ts"`
Expected: FAIL（「收藏 ♡」兩個測試失敗）。

- [ ] **Step 3: 實作 `src/components/square/FavoriteButton.tsx`**

```tsx
"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { setFavoriteAction, type FavoriteResult } from "@/app/brand/actions";

type Props = { creatorId: string; name: string; initial: boolean };

/**
 * ♡ 收藏。按下後畫面先切換（useOptimistic），失敗時切回並顯示錯誤。
 * 伺服器重新渲染給了不同的 initial 時，用 key 重設內部狀態（例如從公開頁收藏後回到廣場）。
 */
export function FavoriteButton(props: Props) {
  return <FavoriteToggle key={String(props.initial)} {...props} />;
}

async function send(creatorId: string, favorite: boolean): Promise<FavoriteResult> {
  try {
    // 工作階段過期時 action 會 redirect 到登入頁，這裡可能拿到 undefined
    return (await setFavoriteAction(creatorId, favorite)) ?? { ok: false, error: "請重新登入" };
  } catch {
    return { ok: false, error: "網路連線失敗，請稍後再試" };
  }
}

function FavoriteToggle({ creatorId, name, initial }: Props) {
  const [saved, setSaved] = useState(initial);
  const [shown, setShown] = useOptimistic(saved);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    // 卡片整張是連結：不要觸發跳頁
    e.preventDefault();
    e.stopPropagation();
    const next = !shown;
    setError(null);
    startTransition(async () => {
      setShown(next);
      const res = await send(creatorId, next);
      startTransition(() => {
        if (res.ok) setSaved(next);
        else setError(res.error);
      });
    });
  }

  return (
    <span className="relative z-10 inline-flex shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-label={`收藏 ${name}`}
        aria-pressed={shown}
        title={shown ? "取消收藏" : "收藏"}
        className="flex h-10 w-10 items-center justify-center rounded-btn border border-line bg-surface text-ink hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <Heart size={18} strokeWidth={1.5} aria-hidden="true" className={shown ? "fill-current" : ""} />
      </button>
      {error && (
        <span role="alert" className="absolute right-0 top-full mt-1 w-max max-w-48 rounded-input border border-line bg-surface px-2 py-1 text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: `src/app/c/[handle]/ProfileView.tsx` 加上 ♡**

import 區加一行：

```tsx
import { FavoriteButton } from "@/components/square/FavoriteButton";
```

把

```tsx
type Props = { creator: PublicCreator; portfolio: PortfolioItem[]; rates: Rate[]; viewer: ViewerKind };

export function ProfileView({ creator: c, portfolio, rates, viewer }: Props) {
```
換成
```tsx
/** favorite：品牌是否已收藏；只有品牌瀏覽時才有意義（其他身分不顯示 ♡）。 */
type Props = { creator: PublicCreator; portfolio: PortfolioItem[]; rates: Rate[]; viewer: ViewerKind; favorite?: boolean };

export function ProfileView({ creator: c, portfolio, rates, viewer, favorite }: Props) {
```

把

```tsx
          <HeaderCard c={c} />
```
換成
```tsx
          <HeaderCard c={c} favorite={viewer === "brand" ? (favorite ?? false) : undefined} />
```

把 `HeaderCard` 的開頭與名稱標題

```tsx
function HeaderCard({ c }: { c: PublicCreator }) {
```
換成
```tsx
function HeaderCard({ c, favorite }: { c: PublicCreator; favorite?: boolean }) {
```

並把

```tsx
          <h1 className="break-words text-2xl font-bold text-ink md:text-[32px]">{c.displayName}</h1>
```
換成
```tsx
          <div className="flex items-start gap-2">
            <h1 className="min-w-0 break-words text-2xl font-bold text-ink md:text-[32px]">{c.displayName}</h1>
            {favorite !== undefined && <FavoriteButton creatorId={c.userId} name={c.displayName} initial={favorite} />}
          </div>
```

同一個 `HeaderCard` 裡外層 `<div className="min-w-0">` 改成 `<div className="min-w-0 flex-1">`，讓 ♡ 緊貼名稱、長名稱會換行。

- [ ] **Step 5: `src/app/c/[handle]/page.tsx` 讀收藏狀態**

import 那行：

```tsx
import { loadPortfolio, loadPublicCreator, loadRates } from "@/lib/creators/public-profile";
```
換成
```tsx
import { loadIsFavorite, loadPortfolio, loadPublicCreator, loadRates } from "@/lib/creators/public-profile";
```

把 `Profile` 函式最後兩行

```tsx
  const rates = viewer === "brand" ? await loadRates(creator.userId, creator.collabTypes) : [];
  return <ProfileView creator={creator} portfolio={portfolio} rates={rates} viewer={viewer} />;
```
換成
```tsx
  // 報價與收藏狀態只有品牌需要（RLS 也只讓品牌讀到報價與自己的收藏）
  const [rates, favorite] = viewer === "brand"
    ? await Promise.all([loadRates(creator.userId, creator.collabTypes), loadIsFavorite(creator.userId)])
    : [[], undefined];
  return <ProfileView creator={creator} portfolio={portfolio} rates={rates} viewer={viewer} favorite={favorite} />;
```

- [ ] **Step 6: 執行測試，確認通過**

Run: `npx vitest run "src/app/c/[handle]/"`
Expected: PASS。

- [ ] **Step 7: 全部檢查並 Commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/components/square/FavoriteButton.tsx "src/app/c/[handle]/ProfileView.tsx" "src/app/c/[handle]/page.tsx" "src/app/c/[handle]/profile-view.test.ts"
git commit -m "計畫 4 Task 4：收藏 ♡ 按鈕（樂觀更新），公開頁只給品牌顯示"
```

---

### Task 5: 廣場卡片與列表

**Files:**
- Create: `src/components/square/Avatar.tsx`、`src/components/square/CreatorCard.tsx`、`src/components/square/CreatorTable.tsx`、`src/components/square/square-items.test.ts`

**Interfaces:**
- Consumes: `SquareCreator`、`cardTags`、`startingPriceLabel`、`postPriceLabel`（Task 2）；`SquareSort`（Task 2）；`FavoriteButton`（Task 4）；`creatorMediaUrl`（`src/lib/creator-media.ts`）；`formatNumber`、`formatPercent`、`initialOf`（`src/lib/format.ts`）。
- Produces:
  - `Avatar({ path: string | null; name: string; size: "sm" | "md" })`
  - `CreatorCard({ c: SquareCreator })`：整張卡片可點到 `/c/<handle>`（名稱連結用 `after:absolute after:inset-0` 撐滿卡片），♡ 在上層、點了不跳頁。
  - `CreatorTable({ items: SquareCreator[]; sort: SquareSort; onSort: (s: SquareSort) => void })`：可點的排序標題只有粉絲數、互動率、貼文報價；外層 `overflow-x-auto`，表格 `min-w-[640px]`。
  - 這三個檔案不加 `"use client"`：它們只會被 Task 6 的 client component `SquareResults` 引入，所以已經在 client 邊界內。

- [ ] **Step 1: 寫失敗的測試 `src/components/square/square-items.test.ts`**

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/brand/actions", () => ({ setFavoriteAction: vi.fn() }));
import { CreatorCard } from "./CreatorCard";
import { CreatorTable } from "./CreatorTable";
import type { SquareCreator } from "@/lib/creators/square-view";

const base: SquareCreator = {
  userId: "u1", handle: "mei", displayName: "小美", avatarPath: null, region: "台北市", categories: ["美妝", "穿搭"],
  styleTags: ["日系"], collabTypes: ["IG 貼文", "Reels", "限時動態"], followerCount: 12000, engagementRate: 3.5,
  minPrice: 4500, postPrice: null, portfolioPaths: [], isFavorite: false,
};

const card = (c: Partial<SquareCreator> = {}) => renderToStaticMarkup(createElement(CreatorCard, { c: { ...base, ...c } }));
const table = (sort: "newest" | "followers" | "engagement" | "price" = "newest", items = [base]) =>
  renderToStaticMarkup(createElement(CreatorTable, { items, sort, onSort: () => {} }));

describe("CreatorCard", () => {
  it("連到公開頁，顯示名稱、地區、內容領域、數據與起價", () => {
    const out = card();
    expect(out).toContain('href="/c/mei"');
    expect(out).toContain("小美");
    expect(out).toContain("台北市");
    expect(out).toContain("美妝、穿搭");
    expect(out).toContain("12,000");
    expect(out).toContain("3.5%");
    expect(out).toContain("NT$4,500");
  });
  it("沒有報價時起價顯示「洽談」", () => {
    expect(card({ minPrice: null })).toContain("洽談");
  });
  it("標籤最多 3 個，風格標籤優先", () => {
    const out = card();
    expect(out).toContain("日系");
    expect(out).toContain("Reels");
    expect(out).not.toContain("限時動態");
  });
  it("沒有作品時顯示名字首字，不放圖片", () => {
    const out = card();
    expect(out).not.toContain("<img");
    expect(out).toContain(">小</div>");
  });
  it("最多顯示三張作品縮圖", () => {
    // 沒有頭像，所以 <img> 都是作品縮圖
    const out = card({ portfolioPaths: ["u1/portfolio-a.jpg", "u1/portfolio-b.jpg", "u1/portfolio-c.jpg", "u1/portfolio-d.jpg"] });
    expect(out.match(/<img/g)?.length).toBe(3);
  });
  it("有 ♡，反映收藏狀態", () => {
    expect(card({ isFavorite: true })).toContain('aria-label="收藏 小美" aria-pressed="true"');
  });
});

describe("CreatorTable", () => {
  it("一列一位：名稱連結、粉絲數、互動率、貼文報價（沒有顯示 —）、地區、查看", () => {
    const out = table();
    expect(out).toContain('href="/c/mei"');
    expect(out).toContain("12,000");
    expect(out).toContain("3.5%");
    expect(out).toContain("—");
    expect(out).toContain("台北市");
    expect(out).toContain("查看");
    expect(out).toContain('aria-label="收藏 小美"');
  });
  it("貼文報價有值時顯示價格", () => {
    expect(table("newest", [{ ...base, postPrice: 6000 }])).toContain("NT$6,000");
  });
  it("只有三個欄位標題可以點；目前的排序標上 aria-sort", () => {
    const out = table("followers");
    expect(out.match(/<button[^>]*data-sort=/g)?.length).toBe(3);
    expect(out).toContain('aria-sort="descending"');
    expect(table("price")).toContain('aria-sort="ascending"');
    expect(table("newest")).not.toContain("aria-sort");
  });
  it("表格可以左右捲動", () => {
    expect(table()).toContain("overflow-x-auto");
  });
});
```

- [ ] **Step 2: 執行測試，確認失敗**

Run: `npx vitest run src/components/square/square-items.test.ts`
Expected: FAIL（找不到 `./CreatorCard`、`./CreatorTable`）。

- [ ] **Step 3: 實作 `src/components/square/Avatar.tsx`**

```tsx
import { creatorMediaUrl } from "@/lib/creator-media";
import { initialOf } from "@/lib/format";

const SIZE = { sm: "h-9 w-9 text-sm", md: "h-12 w-12 text-lg" } as const;

/** 頭像；沒上傳時顯示名字第一個字。 */
export function Avatar({ path, name, size }: { path: string | null; name: string; size: keyof typeof SIZE }) {
  const url = creatorMediaUrl(path);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${SIZE[size]} shrink-0 rounded-full border border-line object-cover`} />;
  }
  return (
    <div aria-hidden="true" className={`${SIZE[size]} flex shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-on-ink`}>
      {initialOf(name)}
    </div>
  );
}
```

- [ ] **Step 4: 實作 `src/components/square/CreatorCard.tsx`**

```tsx
import Link from "next/link";
import { MapPin } from "lucide-react";
import { creatorMediaUrl } from "@/lib/creator-media";
import { formatNumber, formatPercent, initialOf } from "@/lib/format";
import { cardTags, startingPriceLabel, type SquareCreator } from "@/lib/creators/square-view";
import { Avatar } from "./Avatar";
import { FavoriteButton } from "./FavoriteButton";

const THUMB_COLS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3"] as const;

export function CreatorCard({ c }: { c: SquareCreator }) {
  const thumbs = c.portfolioPaths.slice(0, 3);
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface focus-within:ring-2 focus-within:ring-ink hover:border-ink">
      {thumbs.length > 0 ? (
        <div className={`grid aspect-[3/1] gap-0.5 ${THUMB_COLS[thumbs.length]}`}>
          {thumbs.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p} src={creatorMediaUrl(p) ?? undefined} alt="" loading="lazy" className="h-full w-full bg-primary-soft object-cover" />
          ))}
        </div>
      ) : (
        <div aria-hidden="true" className="flex aspect-[3/1] items-center justify-center bg-primary-soft text-4xl font-semibold text-muted">
          {initialOf(c.displayName)}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <Avatar path={c.avatarPath} name={c.displayName} size="md" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-bold text-ink">
              {/* after: 撐滿整張卡片，讓整張可點；♡ 在上層（z-10）不會觸發跳頁 */}
              <Link href={`/c/${c.handle}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                {c.displayName}
              </Link>
            </h3>
            {c.region && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
                <MapPin size={12} strokeWidth={1.5} aria-hidden="true" />{c.region}
              </p>
            )}
            {c.categories.length > 0 && <p className="mt-0.5 truncate text-xs text-muted">{c.categories.join("、")}</p>}
          </div>
          <FavoriteButton creatorId={c.userId} name={c.displayName} initial={c.isFavorite} />
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="text-xs text-muted">粉絲</dt>
            <dd className="mt-0.5 font-semibold text-ink">{formatNumber(c.followerCount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">互動率</dt>
            <dd className="mt-0.5 font-semibold text-ink">{formatPercent(c.engagementRate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">起價</dt>
            <dd className="mt-0.5 font-bold text-primary">{startingPriceLabel(c.minPrice)}</dd>
          </div>
        </dl>
        {cardTags(c).length > 0 && (
          <ul aria-label="標籤" className="mt-auto flex flex-wrap gap-1.5">
            {cardTags(c).map((t) => (
              <li key={t} className="rounded-btn bg-primary-soft px-2.5 py-0.5 text-xs text-ink">{t}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 5: 實作 `src/components/square/CreatorTable.tsx`**

```tsx
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { formatNumber, formatPercent } from "@/lib/format";
import { postPriceLabel, type SquareCreator } from "@/lib/creators/square-view";
import type { SquareSort } from "@/lib/creators/square-query";
import { Avatar } from "./Avatar";
import { FavoriteButton } from "./FavoriteButton";

type SortableColumn = { label: string; sort: Exclude<SquareSort, "newest">; dir: "descending" | "ascending"; hint: string };

// 只有這三欄可排序，分別對應 spec 的排序；再點一次目前的欄位回到「最新加入」
const SORTABLE: SortableColumn[] = [
  { label: "粉絲數", sort: "followers", dir: "descending", hint: "依粉絲數由高到低排序" },
  { label: "互動率", sort: "engagement", dir: "descending", hint: "依互動率由高到低排序" },
  { label: "貼文報價", sort: "price", dir: "ascending", hint: "依起價（所有報價中的最低價）由低到高排序" },
];

const th = "whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-muted";
const td = "whitespace-nowrap px-4 py-3";

type Props = { items: SquareCreator[]; sort: SquareSort; onSort: (s: SquareSort) => void };

export function CreatorTable({ items, sort, onSort }: Props) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={th}>創作者</th>
            {SORTABLE.map((col) => {
              const active = sort === col.sort;
              return (
                <th key={col.sort} scope="col" aria-sort={active ? col.dir : undefined} className={th}>
                  <button
                    type="button"
                    data-sort={col.sort}
                    onClick={() => onSort(active ? "newest" : col.sort)}
                    title={active ? "改回最新加入" : col.hint}
                    className={`inline-flex items-center gap-1 rounded-btn hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${active ? "font-semibold text-ink" : ""}`}
                  >
                    {col.label}
                    {active && (col.dir === "descending"
                      ? <ArrowDown size={12} strokeWidth={1.5} aria-hidden="true" />
                      : <ArrowUp size={12} strokeWidth={1.5} aria-hidden="true" />)}
                  </button>
                </th>
              );
            })}
            <th scope="col" className={th}>地區</th>
            <th scope="col" className={th}><span className="sr-only">查看</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((c) => (
            <tr key={c.userId}>
              <td className={td}>
                <div className="flex items-center gap-3">
                  <Avatar path={c.avatarPath} name={c.displayName} size="sm" />
                  <div className="min-w-0">
                    <Link href={`/c/${c.handle}`} className="font-semibold text-ink hover:underline">{c.displayName}</Link>
                    <p className="text-xs text-muted">@{c.handle}</p>
                  </div>
                </div>
              </td>
              <td className={td}>{formatNumber(c.followerCount)}</td>
              <td className={td}>{formatPercent(c.engagementRate)}</td>
              <td className={`${td} font-semibold`}>{postPriceLabel(c.postPrice)}</td>
              <td className={`${td} text-muted`}>{c.region ?? "—"}</td>
              <td className={td}>
                <div className="flex items-center justify-end gap-2">
                  <FavoriteButton creatorId={c.userId} name={c.displayName} initial={c.isFavorite} />
                  <Link
                    href={`/c/${c.handle}`}
                    className="inline-flex h-9 items-center rounded-btn border border-line px-3 text-xs font-semibold text-ink hover:bg-primary-soft"
                  >
                    查看<span className="sr-only"> {c.displayName}</span>
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: 執行測試，確認通過**

Run: `npx vitest run src/components/square/`
Expected: PASS。

- [ ] **Step 7: 全部檢查並 Commit**

```bash
npm run lint && npm run typecheck && npm test
git add src/components/square/Avatar.tsx src/components/square/CreatorCard.tsx src/components/square/CreatorTable.tsx src/components/square/square-items.test.ts
git commit -m "計畫 4 Task 5：廣場卡片與列表（排序標題、可左右捲動、♡）"
```

---

### Task 6: 廣場頁：篩選欄、抽屜、排序、模式切換、載入更多、空狀態

**Files:**
- Create: `src/components/square/useViewMode.ts`、`src/components/square/FilterPanel.tsx`、`src/components/square/FilterDrawer.tsx`、`src/components/square/SquareResults.tsx`、`src/components/square/SquareView.tsx`
- Modify: `src/app/brand/page.tsx`

**Interfaces:**
- Consumes: Task 2 全部（`parseSquareQuery`、`serializeSquareQuery`、`squareHref`、`activeFilterCount`、`clearFilters`、`toggleValue`、`emptyStateOf`、選項常數、`appendUnique`、`readViewMode`、`writeViewMode`）；Task 3 的 `searchSquare`、`loadPopularStyleTags`、`loadMoreCreatorsAction`、`LoadMoreResult`；Task 5 的 `CreatorCard`、`CreatorTable`；`CATEGORIES`、`REGIONS`、`COLLAB_TYPES`（`src/lib/options.ts`）；`requireRole`。
- Produces: `/brand` 廣場頁。純函式都已在 Task 2 測過；這個 task 的元件都依賴 `useRouter`／瀏覽器 API，由 Task 7 的 E2E 驗收，這裡用 lint、typecheck、build 把關。

- [ ] **Step 1: 實作 `src/components/square/useViewMode.ts`**

```ts
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
```

- [ ] **Step 2: 實作 `src/components/square/FilterPanel.tsx`**

```tsx
"use client";

import { CATEGORIES, COLLAB_TYPES, REGIONS } from "@/lib/options";
import {
  ENGAGEMENT_OPTIONS, FOLLOWER_RANGES, KEYWORD_MAX, PRICE_RANGES, activeFilterCount, clearFilters, toggleValue,
  type SquareQuery,
} from "@/lib/creators/square-query";

type Props = {
  /** 桌面側欄與手機抽屜同時存在 DOM 裡，id 與 radio name 要用前綴區分 */
  idPrefix: string;
  query: SquareQuery;
  popularTags: string[];
  onChange: (next: SquareQuery) => void;
};

const legendCls = "text-sm font-semibold text-ink";

export function FilterPanel({ idPrefix, query, popularTags, onChange }: Props) {
  const set = (patch: Partial<SquareQuery>) => onChange({ ...query, ...patch });
  return (
    <div className="space-y-6">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const v = new FormData(e.currentTarget).get("q");
          set({ q: typeof v === "string" ? v.trim() : "" });
        }}
      >
        <label htmlFor={`${idPrefix}-q`} className={legendCls}>關鍵字</label>
        <div className="mt-2 flex gap-2">
          {/* key：網址的關鍵字改變（例如清除篩選）時，輸入框跟著重設 */}
          <input
            key={query.q}
            id={`${idPrefix}-q`}
            name="q"
            type="search"
            defaultValue={query.q}
            maxLength={KEYWORD_MAX}
            placeholder="名稱、網址代稱、IG 帳號"
            className="h-10 min-w-0 flex-1 rounded-input border border-line bg-surface px-3 text-sm text-ink"
          />
          <button type="submit" className="h-10 shrink-0 rounded-btn bg-ink px-4 text-sm font-semibold text-on-ink">搜尋</button>
        </div>
      </form>

      <label className="flex items-center justify-between gap-3 text-sm font-semibold text-ink">
        只看收藏
        <input
          type="checkbox"
          role="switch"
          checked={query.fav}
          onChange={(e) => set({ fav: e.target.checked })}
          className="h-5 w-5 accent-ink"
        />
      </label>

      <ChipGroup legend="內容領域" options={CATEGORIES} selected={query.categories}
        onToggle={(v) => set({ categories: toggleValue(query.categories, v) })} />
      <ChipGroup legend="風格標籤" options={popularTags} selected={query.tags}
        onToggle={(v) => set({ tags: toggleValue(query.tags, v) })} />
      <RadioGroup legend="粉絲數" name={`${idPrefix}-followers`} options={FOLLOWER_RANGES} value={query.followers}
        onChange={(followers) => set({ followers })} />
      <RadioGroup legend="互動率" name={`${idPrefix}-er`} options={ENGAGEMENT_OPTIONS} value={query.engagement}
        onChange={(engagement) => set({ engagement })} />
      <RadioGroup legend="起價" name={`${idPrefix}-price`} options={PRICE_RANGES} value={query.price}
        onChange={(price) => set({ price })} />
      <ChipGroup legend="地區" options={REGIONS} selected={query.regions}
        onToggle={(v) => set({ regions: toggleValue(query.regions, v) })} />
      <ChipGroup legend="合作類型" options={COLLAB_TYPES} selected={query.collabs}
        onToggle={(v) => set({ collabs: toggleValue(query.collabs, v) })} />

      <button
        type="button"
        onClick={() => onChange(clearFilters(query))}
        disabled={activeFilterCount(query) === 0}
        className="h-10 w-full rounded-btn border border-line bg-surface text-sm font-semibold text-ink hover:bg-primary-soft disabled:opacity-50"
      >
        清除篩選
      </button>
    </div>
  );
}

function ChipGroup({ legend, options, selected, onToggle }: {
  legend: string; options: readonly string[]; selected: string[]; onToggle: (v: string) => void;
}) {
  // 網址裡有清單以外的值（舊資料或手改網址）時也顯示出來，才能取消
  const all = [...options, ...selected.filter((s) => !options.includes(s))];
  if (all.length === 0) return null;
  return (
    <fieldset>
      <legend className={legendCls}>{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {all.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o} type="button" aria-pressed={on} onClick={() => onToggle(o)}
              className={`min-h-9 rounded-btn border px-3 py-1 text-sm ${on ? "border-ink bg-ink font-medium text-on-ink" : "border-line bg-surface text-ink hover:bg-primary-soft"}`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function RadioGroup<K extends string>({ legend, name, options, value, onChange }: {
  legend: string; name: string; options: readonly { key: K; label: string }[]; value: K | null; onChange: (v: K | null) => void;
}) {
  const item = "flex min-h-9 items-center gap-2 text-sm text-ink";
  return (
    <fieldset>
      <legend className={legendCls}>{legend}</legend>
      <div className="mt-1">
        <label className={item}>
          <input type="radio" name={name} checked={value === null} onChange={() => onChange(null)} className="accent-ink" />不限
        </label>
        {options.map((o) => (
          <label key={o.key} className={item}>
            <input type="radio" name={name} checked={value === o.key} onChange={() => onChange(o.key)} className="accent-ink" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 3: 實作 `src/components/square/FilterDrawer.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { formatNumber } from "@/lib/format";

type Props = { count: number; total: number; children: React.ReactNode };

/** 手機與平板（lg 以下）的篩選抽屜：原生 <dialog>，focus trap 與 Esc 關閉由瀏覽器處理。 */
export function FilterDrawer({ count, total, children }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    // 切到別頁時 <Activity> 會隱藏這頁並執行 cleanup：關掉對話框，onClose 會把 open 設回 false
    // （node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md「Dialog and initialization logic」）
    return () => {
      if (d.open) d.close();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-btn border border-line bg-surface px-4 text-sm font-semibold text-ink lg:hidden"
      >
        <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
        篩選{count > 0 ? `（${count}）` : ""}
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-labelledby="filter-drawer-title"
        className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-sm bg-surface p-0 text-ink backdrop:bg-ink/40 lg:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 id="filter-drawer-title" className="font-bold">篩選</h2>
            <button
              type="button" onClick={() => setOpen(false)} aria-label="關閉篩選"
              className="flex h-10 w-10 items-center justify-center rounded-btn hover:bg-primary-soft"
            >
              <X size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
          <div className="border-t border-line p-4">
            <button type="button" onClick={() => setOpen(false)} className="h-11 w-full rounded-btn bg-ink font-semibold text-on-ink">
              查看 {formatNumber(total)} 位創作者
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
```

- [ ] **Step 4: 實作 `src/components/square/SquareResults.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { loadMoreCreatorsAction, type LoadMoreResult } from "@/app/brand/actions";
import { emptyStateOf, type SquareQuery, type SquareSort } from "@/lib/creators/square-query";
import { appendUnique, type SquareCreator, type SquarePage } from "@/lib/creators/square-view";
import type { ViewMode } from "@/lib/creators/view-mode";
import { CreatorCard } from "./CreatorCard";
import { CreatorTable } from "./CreatorTable";

type Props = {
  initial: SquarePage;
  query: SquareQuery;
  /** 目前網址的查詢字串，載入更多時原樣送給伺服器重新解析 */
  queryKey: string;
  view: ViewMode;
  onSort: (sort: SquareSort) => void;
  onClear: () => void;
};

async function fetchMore(queryKey: string, offset: number): Promise<LoadMoreResult> {
  try {
    return (await loadMoreCreatorsAction(queryKey, offset)) ?? { ok: false, error: "請重新登入" };
  } catch {
    return { ok: false, error: "載入失敗，請稍後再試" };
  }
}

/**
 * 結果區。父層用 key={`${bfcacheId}|${queryKey}`} 重設：換篩選或重新進入頁面時從第一批開始。
 * 載入更多的結果存在這裡（見計畫 4「設計決定」2）。
 */
export function SquareResults({ initial, query, queryKey, view, onSort, onClear }: Props) {
  const [extra, setExtra] = useState<SquareCreator[]>([]);
  // 伺服器已回傳的筆數（含去重掉的），用來算下一次的 offset
  const [fetched, setFetched] = useState(0);
  const [moreAfterLoad, setMoreAfterLoad] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const items = appendUnique(initial.items, extra);
  const hasMore = moreAfterLoad ?? initial.hasMore;

  function loadMore() {
    setError(null);
    startLoading(async () => {
      const res = await fetchMore(queryKey, initial.items.length + fetched);
      startLoading(() => {
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setExtra((prev) => appendUnique(prev, res.items));
        setFetched((n) => n + res.items.length);
        setMoreAfterLoad(res.hasMore);
      });
    });
  }

  if (items.length === 0) {
    const noFavorites = emptyStateOf(query) === "no-favorites";
    return (
      <div className="rounded-card border border-line bg-surface p-8 text-center">
        <p className="font-semibold text-ink">{noFavorites ? "還沒有收藏的創作者" : "找不到符合條件的創作者"}</p>
        {noFavorites ? (
          <p className="mt-2 text-sm text-muted">在卡片、列表或創作者頁按 ♡，就會出現在這裡。</p>
        ) : (
          <button
            type="button" onClick={onClear}
            className="mt-4 h-10 rounded-btn border border-line px-4 text-sm font-semibold text-ink hover:bg-primary-soft"
          >
            清除篩選
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {view === "card" ? (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => <li key={c.userId}><CreatorCard c={c} /></li>)}
        </ul>
      ) : (
        <CreatorTable items={items} sort={query.sort} onSort={onSort} />
      )}
      {error && <p role="alert" className="mt-4 text-center text-sm text-danger">{error}</p>}
      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button" onClick={loadMore} disabled={loading}
            className="h-11 rounded-btn border border-line bg-surface px-6 text-sm font-semibold text-ink hover:bg-primary-soft disabled:opacity-60"
          >
            {loading ? "載入中…" : "載入更多"}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: 實作 `src/components/square/SquareView.tsx`**

```tsx
"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { formatNumber } from "@/lib/format";
import {
  SORT_LABELS, SQUARE_SORTS, activeFilterCount, clearFilters, serializeSquareQuery, squareHref,
  type SquareQuery, type SquareSort,
} from "@/lib/creators/square-query";
import type { SquarePage } from "@/lib/creators/square-view";
import type { ViewMode } from "@/lib/creators/view-mode";
import { FilterDrawer } from "./FilterDrawer";
import { FilterPanel } from "./FilterPanel";
import { SquareResults } from "./SquareResults";
import { useViewMode } from "./useViewMode";

type Props = { query: SquareQuery; initial: SquarePage; popularTags: string[] };

/**
 * 廣場外框。篩選與排序只存在網址：改變時 router.replace 讓伺服器重新渲染（見計畫 4「設計決定」1）。
 * 篩選 UI 用 useOptimistic 立刻反映；結果在轉換期間保留舊的並降低透明度。
 */
export function SquareView({ query, initial, popularTags }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(query);
  const [view, setView] = useViewMode();
  const queryKey = serializeSquareQuery(query);

  function navigate(next: SquareQuery) {
    startTransition(() => {
      setShown(next);
      router.replace(squareHref(next), { scroll: false });
    });
  }

  const panel = (idPrefix: string) => (
    <FilterPanel idPrefix={idPrefix} query={shown} popularTags={popularTags} onChange={navigate} />
  );

  return (
    <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
      <aside aria-label="篩選" className="hidden lg:block">{panel("side")}</aside>
      <section aria-label="搜尋結果" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <FilterDrawer count={activeFilterCount(shown)} total={initial.total}>{panel("drawer")}</FilterDrawer>
          <p className="text-sm text-muted" aria-live="polite">共 {formatNumber(initial.total)} 位創作者</p>
          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="square-sort" className="sr-only">排序</label>
            <select
              id="square-sort"
              value={shown.sort}
              onChange={(e) => navigate({ ...shown, sort: e.target.value as SquareSort })}
              className="h-10 rounded-input border border-line bg-surface px-3 text-sm text-ink"
            >
              {SQUARE_SORTS.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
            </select>
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>
        <div aria-busy={pending} className={`transition-opacity ${pending ? "opacity-60" : ""}`}>
          <SquareResults
            key={`${router.bfcacheId}|${queryKey}`}
            initial={initial}
            query={query}
            queryKey={queryKey}
            view={view}
            onSort={(sort) => navigate({ ...shown, sort })}
            onClear={() => navigate(clearFilters(shown))}
          />
        </div>
      </section>
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const btn = (on: boolean) =>
    `flex h-9 w-9 items-center justify-center rounded-btn ${on ? "bg-ink text-on-ink" : "text-ink hover:bg-primary-soft"}`;
  return (
    <div role="group" aria-label="顯示方式" className="flex gap-0.5 rounded-btn border border-line bg-surface p-0.5">
      <button type="button" aria-pressed={view === "card"} onClick={() => onChange("card")} className={btn(view === "card")}>
        <LayoutGrid size={16} strokeWidth={1.5} aria-hidden="true" /><span className="sr-only">卡片</span>
      </button>
      <button type="button" aria-pressed={view === "list"} onClick={() => onChange("list")} className={btn(view === "list")}>
        <List size={16} strokeWidth={1.5} aria-hidden="true" /><span className="sr-only">列表</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 6: 把 `src/app/brand/page.tsx` 整個換成**

```tsx
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { loadPopularStyleTags, searchSquare } from "@/lib/creators/square";
import { parseSquareQuery } from "@/lib/creators/square-query";
import { SquareView } from "@/components/square/SquareView";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// 頁面殼（標題、骨架）是靜態的；searchParams 與 session 都在 <Suspense> 內讀（cacheComponents）
export default function BrandSquarePage({ searchParams }: Props) {
  return (
    <div>
      <h1 className="text-[32px] font-bold text-ink">創作者廣場</h1>
      <div className="mt-6">
        <Suspense fallback={<SquareSkeleton />}>
          <Square searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Square({ searchParams }: Props) {
  // layout 的 Gate 在用戶端換頁時不會重跑，頁面自己也要檢查
  await requireRole("brand");
  const query = parseSquareQuery(await searchParams);
  const [initial, popularTags] = await Promise.all([searchSquare(query, 0), loadPopularStyleTags()]);
  return <SquareView query={query} initial={initial} popularTags={popularTags} />;
}

function SquareSkeleton() {
  return (
    <div aria-busy="true" className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
      <p className="sr-only">載入中…</p>
      <div className="hidden h-96 rounded-card border border-line bg-surface lg:block" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-72 rounded-card border border-line bg-surface" />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: 全部檢查（含 build）**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: 全部通過；build 沒有「Uncached data was accessed outside of `<Suspense>`」或「Missing Suspense boundary」錯誤，路由表裡有 `/brand`。build 跑完前不要啟動任何 dev server。

- [ ] **Step 8: Commit**

```bash
git add src/components/square/useViewMode.ts src/components/square/FilterPanel.tsx src/components/square/FilterDrawer.tsx src/components/square/SquareResults.tsx src/components/square/SquareView.tsx src/app/brand/page.tsx
git commit -m "計畫 4 Task 6：創作者廣場頁（篩選欄與抽屜、排序、卡片列表切換、載入更多、空狀態）"
```

---

### Task 7: 清理、文件同步與本機端對端驗收

**Files:**
- Delete: `public/file.svg`、`public/globe.svg`、`public/next.svg`、`public/vercel.svg`、`public/window.svg`
- Modify: `README.md`、`docs/superpowers/plans/2026-11-22-foundation-followups.md`

**Interfaces:**
- Consumes: Task 1–6 的全部成果。
- Produces: 乾淨的 `public/`；README 的部署順序；followups 的完成標記、決定與新的後續事項；E2E 截圖（存在本機暫存資料夾，不 commit）。

- [ ] **Step 1: 刪除 scaffold 圖檔**

```bash
grep -rn "file.svg\|globe.svg\|next.svg\|vercel.svg\|window.svg" src README.md || echo "沒有引用"
git rm public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
```
Expected: 「沒有引用」；五個檔案從 git 移除。

- [ ] **Step 2: README**

在「## 正式環境（Hosted Supabase）設定」底下、`創作者頭像與作品的 Storage bucket creator-media …` 那一段**之後**加上：

```markdown
**部署順序：先推資料庫，再合併 PR。** Vercel 在 `main` 合併後立刻部署；新版程式會呼叫新 migration 建立的函式（例如計畫 4 的 `search_creators`、`popular_style_tags` 與 `creator_favorites` 資料表，`20261124000400_creator_square.sql`），資料庫還沒更新時 `/brand` 會出錯。所以每次 PR 有新 migration 時，先執行上面的 `npx supabase db push --remote`，確認成功後再合併。
```

- [ ] **Step 3: followups**

`docs/superpowers/plans/2026-11-22-foundation-followups.md`：

在「## 執行中做出的決定」的表格最後加四列：

```markdown
| 收藏直接寫資料表 | `creator_favorites` 由品牌自己的 client 直接 insert／delete（RLS：只能讀、增、刪自己的，新增時必須是品牌；不開放 UPDATE）；重複收藏的 `23505` 視為成功。資料庫允許收藏未審核的創作者，廣場只列出已審核的。 |
| 廣場搜尋只給品牌 | `search_creators`、`popular_style_tags` 是 definer 函式，非品牌一律 `42501`（結果含起價與貼文報價，延續「報價只給品牌看」）。總數用 window 函式放在 `total_count`。 |
| 廣場分頁 | 篩選、排序、關鍵字在網址；「載入更多」是 Server Action 回傳下一批（一次 24 位），頁數不在網址，分享或重新整理回到第一批。 |
| 廣場區間 | 粉絲與起價區間一律含下限、不含上限（例如「1 千到 1 萬」是 1,000–9,999）。 |
```

把「### 4. 創作者廣場、5. 招募與機會頁」底下這三行：

```markdown
- 索引：`creator_profiles(status)`、`categories` / `style_tags` 的 GIN 索引、`briefs(status, deadline)`、`briefs(brand_id)`、`brief_applications(creator_id)`、`conversations(creator_id)`、`collaborations(conversation_id)`、`collaborations(brief_id)`。
```
```markdown
- 刪除 `public/*.svg` 這些 scaffold 留下的圖檔。
```
```markdown
- 搜尋與篩選必須能容忍清單以外的值；若需要嚴格清單，要在資料庫端強制。
```
分別換成：

```markdown
- 索引：`creator_profiles(status, created_at desc)`、`categories`／`style_tags`／`collab_types` 的 GIN、`creator_rates(creator_id, price_twd)`、`creator_favorites(brand_id, created_at desc)` → 已完成（計畫 4）。還沒做：`briefs(status, deadline)`、`briefs(brand_id)`、`brief_applications(creator_id)`（計畫 5）、`conversations(creator_id)`、`collaborations(conversation_id)`、`collaborations(brief_id)`（計畫 6、7）。
```
```markdown
- 刪除 `public/*.svg` 這些 scaffold 留下的圖檔 → 已完成（計畫 4）。
```
```markdown
- 搜尋與篩選必須能容忍清單以外的值 → 廣場已做到（計畫 4：網址值清理後照常比對，比對不到就是沒有結果）；計畫 5 的招募篩選比照辦理。若需要嚴格清單，要在資料庫端強制。
- 計畫 4 新增的後續事項：
  - 從公開頁按 ♡ 後用瀏覽器「上一頁」回到廣場，畫面是快取的舊狀態（重新整理或從導覽列進入就正確）；♡ 刻意不 revalidate，避免每按一次重跑整頁搜尋。
  - 在「只看收藏」裡取消收藏，卡片留到下次篩選或重新整理才消失。
  - 列表模式的使用者進入廣場時，會先看到一瞬間卡片（server snapshot 固定是卡片）。
  - 列表的「貼文報價」欄顯示 IG 貼文價，但點標題是依起價排序（spec 只有四種排序）。
  - 關鍵字是 `ilike '%…%'`，用不到索引；創作者到數千位時評估 `pg_trgm` GIN 索引。
  - 風格標籤選項只列最熱門的 20 個；冷門標籤只能用網址 `?tag=` 篩選。
  - 收藏數沒有上限、也沒有收藏清單頁（spec 決定用「只看收藏」開關）。
```

- [ ] **Step 4: Commit 清理與文件**

```bash
git add README.md docs/superpowers/plans/2026-11-22-foundation-followups.md
git commit -m "計畫 4 Task 7：刪除 scaffold 圖檔、README 部署順序與待辦同步"
```

- [ ] **Step 5: 準備本機種子資料（只用本機 Supabase，不碰正式環境）**

先確認沒有其他 `next build`／`next dev`／`next start` 在跑（`lsof -iTCP:3000 -sTCP:LISTEN` 沒有輸出）。

建立 30 位已審核創作者（8 位資料各不相同 + 22 位填充，讓總數超過 24、看得到「載入更多」）。id 前綴 `00000000-0000-0000-0000-0000e2e4`，方便最後清掉：

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000e2e4' || lpad(i::text, 4, '0'))::uuid, format('p4-seed-%s@test.local', i)
  from generate_series(1, 30) as i;

with seed(i, handle, name, ig, followers, er, region, cats, tags, collabs) as (values
  (1, 'p4mei',   '小美 Mei',     'p4mei',      12000,  3.5,  '台北市', array['美妝','保養'], array['日系','簡約'], array['IG 貼文','Reels']),
  (2, 'p4hua',   '小華旅行',     'hua_travel', 85000,  5.2,  '台中市', array['旅遊'],        array['戶外','自然'], array['Reels','限時動態']),
  (3, 'p4food',  '吃貨阿明',     'p4food',     3500,   6.1,  '台南市', array['美食'],        array['可愛'],        array['IG 貼文']),
  (4, 'p4tech',  '3C 小王',      'p4tech',     150000, 1.2,  '新北市', array['3C'],          array['專業'],        array['IG 貼文','Reels']),
  (5, 'p4pet',   '毛孩日記',     'p4pet',      800,    8.0,  '高雄市', array['寵物'],        array['可愛','自然'], array['產品互惠']),
  (6, 'p4fit',   '運動 Amy',     'amy_fit',    25000,  2.8,  '台北市', array['運動','生活'], array['活力'],        array['Reels']),
  (7, 'p4mom',   '親子 Lin',     'p4mom',      9999,   4.4,  '新竹市', array['親子'],        array['溫馨'],        array['IG 貼文']),
  (8, 'p4style', '穿搭 50%off',  'p4style',    60000,  3.0,  '海外',   array['穿搭'],        array['日系'],        array['IG 貼文','限時動態'])
), filler as (
  select i, 'p4filler' || i, '填充創作者 ' || i, 'p4filler' || i, 1000 + i * 100, null::numeric, '台北市',
         array['生活'], '{}'::text[], array['IG 貼文']
    from generate_series(9, 30) as i
), all_rows as (select * from seed union all select * from filler),
p as (
  insert into public.profiles (id, role, display_name)
  select ('00000000-0000-0000-0000-0000e2e4' || lpad(i::text, 4, '0'))::uuid, 'creator', name from all_rows
  returning id
)
insert into public.creator_profiles
  (user_id, handle, ig_username, follower_count, engagement_rate, region, categories, style_tags, collab_types, status, created_at)
select ('00000000-0000-0000-0000-0000e2e4' || lpad(i::text, 4, '0'))::uuid, handle, ig, followers, er, region, cats, tags, collabs,
       'approved', now() - make_interval(mins => i)
  from all_rows;

insert into public.creator_rates (creator_id, collab_type, price_twd)
select ('00000000-0000-0000-0000-0000e2e4' || lpad(i::text, 4, '0'))::uuid, t, p
  from (values (1, 'IG 貼文', 4500), (1, 'Reels', 8000), (2, 'Reels', 22000), (3, 'IG 貼文', 2000),
               (4, 'IG 貼文', 30000), (4, 'Reels', 45000), (5, '產品互惠', 0), (7, 'IG 貼文', 6000),
               (8, 'IG 貼文', 18000)) as r(i, t, p)
union all
select ('00000000-0000-0000-0000-0000e2e4' || lpad(i::text, 4, '0'))::uuid, 'IG 貼文', 3000 + i * 100
  from generate_series(9, 30) as i;
SQL
```
Expected：`INSERT 0 30`、`INSERT 0 30`、`INSERT 0 31`（`p4fit` 刻意沒有報價）。

上傳作品與頭像圖（讓卡片的縮圖看得到）。在專案根目錄執行：

```bash
E2E=$(mktemp -d)/kollink-p4-e2e && mkdir -p "$E2E"
for n in 1 2 3; do sips -s format jpeg -Z 600 /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns --out "$E2E/work$n.jpg" >/dev/null; done
sips -s format png -Z 256 /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns --out "$E2E/avatar.png" >/dev/null
set -a; source .env.local; set +a
MEI=00000000-0000-0000-0000-0000e2e40001
HUA=00000000-0000-0000-0000-0000e2e40002
up() { curl -s -o /dev/null -w "%{http_code} $1\n" -X POST "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/creator-media/$1" \
  -H "apikey: $SUPABASE_SECRET_KEY" -H "Content-Type: $3" --data-binary @"$2"; }
up "$MEI/avatar-e2e.png" "$E2E/avatar.png" image/png
up "$MEI/portfolio-e2e1.jpg" "$E2E/work1.jpg" image/jpeg
up "$MEI/portfolio-e2e2.jpg" "$E2E/work2.jpg" image/jpeg
up "$MEI/portfolio-e2e3.jpg" "$E2E/work3.jpg" image/jpeg
up "$HUA/portfolio-e2e1.jpg" "$E2E/work1.jpg" image/jpeg
echo "$E2E"
```
Expected：五行都是 `200`。若是 `400`／`401`／`403`，把 `up` 裡的 header 加上 `-H "Authorization: Bearer $(npx supabase status -o env | sed -n 's/^SERVICE_ROLE_KEY=\"\(.*\)\"$/\1/p')"` 再試一次；還是失敗就跳過上傳與下一段 SQL（卡片會顯示名字首字，驗收照做），並在回報中註明。

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 <<'SQL'
update public.creator_profiles set avatar_path = user_id::text || '/avatar-e2e.png'
 where user_id = '00000000-0000-0000-0000-0000e2e40001';
insert into public.creator_portfolio_items (creator_id, image_path, position) values
  ('00000000-0000-0000-0000-0000e2e40001', '00000000-0000-0000-0000-0000e2e40001/portfolio-e2e1.jpg', 0),
  ('00000000-0000-0000-0000-0000e2e40001', '00000000-0000-0000-0000-0000e2e40001/portfolio-e2e2.jpg', 1),
  ('00000000-0000-0000-0000-0000e2e40001', '00000000-0000-0000-0000-0000e2e40001/portfolio-e2e3.jpg', 2),
  ('00000000-0000-0000-0000-0000e2e40002', '00000000-0000-0000-0000-0000e2e40002/portfolio-e2e1.jpg', 0);
SQL
```
Expected：`UPDATE 1`、`INSERT 0 4`。

- [ ] **Step 6: 啟動 dev server（唯一的一個）**

測試快速登入只在 `next dev` 有效（README「測試快速登入」），所以 E2E 用 dev server，不用 `next start`：

```bash
npm run dev -- -H 127.0.0.1 -p 3000
```
用背景執行，記下 PID，E2E 結束後關掉。不要在這期間執行 `npm run build`。若 `next dev` 改了 `AGENTS.md`，照 `AGENTS.md` 的說明把它一起 commit。

- [ ] **Step 7: 以品牌身分操作（瀏覽器自動化，例如 chrome-devtools MCP）**

不用 email 驗證碼（本機每小時只能寄 2 封）：開 http://127.0.0.1:3000/login ，按「測試快速登入」的「測試品牌」，會直接進到 `/brand`。

每個標「截圖」的步驟，在寬度 390（手機）與 1280（桌面）各截一張，存到 Step 5 印出的資料夾。每次截圖前在頁面執行 `document.documentElement.scrollWidth <= window.innerWidth`，必須是 `true`（整頁沒有水平捲軸）。

本機若已有其他已審核的創作者（例如測試快速登入建立的 `devcreator`：美妝、基隆市、粉絲 1,000、沒有報價），符合條件時會一起出現，這是正確的；下面寫「只剩」的地方，指的是種子資料裡只剩這些人。

1. **預設畫面**：標題「創作者廣場」、「共 N 位創作者」（N ≥ 30）、排序「最新加入」、卡片模式；第一張卡片是 `小美 Mei`（有頭像、三張縮圖、起價 NT$4,500、標籤「日系」「簡約」「IG 貼文」）；`運動 Amy` 的起價是「洽談」；1280 寬時一排 3 張、篩選欄在左側；390 寬時一排 1 張、只有「篩選」按鈕。底部有「載入更多」。截圖：`/brand`。
2. **篩選、關鍵字、排序**：
   - 1280：在左側篩選欄點內容領域「美妝」→ 網址變成 `/brand?cat=美妝`（編碼後）、只剩 `小美 Mei`。再點「旅遊」→ 多了 `小華旅行`（同欄位 OR）。地區再點「台北市」→ 只剩 `小美 Mei`（不同欄位 AND）。按「清除篩選」→ 回到全部。
   - 關鍵字輸入 `50%` 按「搜尋」→ 只有 `穿搭 50%off`（% 照字面）；輸入 `HUA_` →只有 `小華旅行`（比對 IG 帳號、不分大小寫、_ 照字面）。清除。
   - 起價選「2 萬以上」→ `小華旅行`、`3C 小王`（`運動 Amy` 沒有報價不列出）；互動率選「≥ 5%」→ 只剩 `小華旅行`。清除。
   - 排序選「粉絲數（高到低）」→ 第一張是 `3C 小王`；「起價（低到高）」→ 第一張是 `毛孩日記`（NT$0）；「互動率（高到低）」→ 第一張是 `毛孩日記`（8%）。
   - 390：按「篩選」打開抽屜 → 選粉絲數「1 萬到 10 萬」→ 底部按鈕顯示「查看 N 位創作者」→ 關閉後結果只剩粉絲 10,000–99,999 的人（`小美 Mei`、`小華旅行`、`運動 Amy`、`穿搭 50%off`）。截圖：抽屜打開時、套用後的結果。
   - 手改網址 http://127.0.0.1:3000/brand?cat=%E4%B8%8D%E5%AD%98%E5%9C%A8&followers=huge&sort=drop → 頁面正常、顯示「找不到符合條件的創作者」與「清除篩選」、篩選欄多出一個已選的「不存在」可以取消。截圖：空狀態。
3. **卡片／列表**：按「列表」→ 表格欄位是創作者、粉絲數、互動率、貼文報價、地區、查看；`小華旅行` 的貼文報價是「—」。點「粉絲數」標題 → 網址 `sort=followers`、第一列 `3C 小王`；再點一次 → 回到最新加入。390 寬時表格可以左右捲動，但整頁沒有水平捲軸。重新整理 → 仍是列表模式。截圖：列表（1280、390）。切回卡片。
4. **載入更多**：清除篩選、排序最新加入 → 畫面上 24 張卡片 → 按「載入更多」→ 卡片數等於「共 N 位」、沒有重複的名字（在頁面執行 `[...document.querySelectorAll('article h3')].map(e => e.textContent)`，長度等於 N、`new Set(...)` 大小也等於 N）、「載入更多」消失。截圖：載入更多之後的底部。
5. **收藏與只看收藏**：在 `小美 Mei` 與 `吃貨阿明` 的卡片按 ♡ → 立刻變實心、沒有跳頁。打開「只看收藏」→ 網址有 `fav=1`、只剩這兩位。切到列表模式，按 `吃貨阿明` 那一列的 ♡ 取消 → 立刻變空心（那一列留著）。重新整理 → 只剩 `小美 Mei`。用 SQL 確認：
   ```bash
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select cp.handle from public.creator_favorites f join public.creator_profiles cp on cp.user_id = f.creator_id join auth.users u on u.id = f.brand_id where u.email = 'dev-brand@kollink.test';"
   ```
   Expected：只有 `p4mei`。截圖：只看收藏。
6. **公開頁 ♡**：開 http://127.0.0.1:3000/c/p4hua → 名稱旁邊有 ♡（空心）→ 按下變實心 → 點導覽列「創作者廣場」回到廣場 → 打開「只看收藏」→ `小美 Mei`、`小華旅行` 都在、♡ 都是實心。再回 `/c/p4hua` 取消 ♡ → 從導覽列回廣場 → `小華旅行` 不在只看收藏裡。截圖：`/c/p4hua`（品牌、已收藏）。用無痕視窗開 `/c/p4hua` → 沒有 ♡。
7. **分享網址**：設定「內容領域：美妝、穿搭」「排序：粉絲數」→ 複製網址 → 開新分頁貼上 → 結果與排序完全相同、篩選欄勾選狀態相同。
8. **只看收藏的空狀態**：取消 `小美 Mei` 的 ♡、重新整理（仍開著只看收藏）→ 顯示「還沒有收藏的創作者」。截圖。

- [ ] **Step 8: 關閉 server、全部檢查、清理種子資料**

```bash
kill <Step 6 的 PID>
lsof -iTCP:3000 -sTCP:LISTEN || echo "已關閉"
set -a; source .env.local; set +a
curl -s -X DELETE "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/creator-media" -H "apikey: $SUPABASE_SECRET_KEY" -H "Content-Type: application/json" \
  -d '{"prefixes":["00000000-0000-0000-0000-0000e2e40001/avatar-e2e.png","00000000-0000-0000-0000-0000e2e40001/portfolio-e2e1.jpg","00000000-0000-0000-0000-0000e2e40001/portfolio-e2e2.jpg","00000000-0000-0000-0000-0000e2e40001/portfolio-e2e3.jpg","00000000-0000-0000-0000-0000e2e40002/portfolio-e2e1.jpg"]}'
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "delete from auth.users where id::text like '00000000-0000-0000-0000-0000e2e4%';"
npm run lint && npm run typecheck && npm test && npm run build && npx supabase test db
git status --short
```
Expected：「已關閉」；DELETE 回傳刪掉的 5 個物件（若 Step 5 跳過上傳，這句回傳空陣列）；`DELETE 30`（連帶刪掉 profiles、創作者資料、報價、作品、收藏）；全部檢查通過；`git status` 乾淨（截圖不在 repo 裡；若 `AGENTS.md` 被 `next dev` 改了就照 Step 6 commit）。把截圖資料夾路徑與每張截圖的檔名回報給 controller。

---

## 完成後（controller 執行，不是 task）

1. **端對端驗收複查**：派一個沒參與實作的 subagent，看 Task 7 Step 7 的截圖，對照 spec「頁面」「收藏」逐項檢查（手機 390、桌面 1280）。
2. **全分支最終審查**：review package 用 `git merge-base main HEAD` 為起點。
3. 開 PR（base 為 `main`），PR 說明寫明：**合併前先執行 `npx supabase db push --remote`**（新 migration `20261124000400_creator_square.sql`；見 README「部署順序」）。
