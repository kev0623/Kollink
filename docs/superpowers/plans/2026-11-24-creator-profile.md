# Kollink 創作者公開檔案頁 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立創作者公開檔案頁 `/c/[handle]`（含 SEO 與 OG 圖片），以及創作者後台編輯公開頁資料（頭像、自我介紹、風格標籤、想接的合作、互動率、受眾年齡、作品、報價）的功能。

**Architecture:** 資料層新增 `creator_portfolio_items` 表、`creator-media` 公開 bucket，以及 4 個 SECURITY DEFINER 函式（公開讀取 `get_public_creator`；寫入 `update_creator_public_profile`、`set_creator_portfolio`、`set_creator_rates`），報價收回直接寫入。公開頁以使用者自己的 client 在 `<Suspense>` 內逐次請求讀取（不快取，理由見「快取決定」）；OG 圖片以不帶 session 的訪客 client 讀取，只有已審核的創作者才有圖。後台新增子頁 `/creator/me/profile`，分三張表單，各自呼叫一個函式（每次儲存都是單一 transaction）。

**Tech Stack:** Next.js 16.4.6（App Router、`cacheComponents`、`next/og`）、React 19.3、TypeScript、Tailwind v4、Supabase CLI 3.2（Postgres、Storage）、pgTAP、Vitest、lucide-react。

**Spec:** `docs/superpowers/specs/2026-11-24-creator-profile-design.md`（視覺沿用 `docs/superpowers/specs/2026-11-24-ui-refresh-design.md`；延後事項與既有決定見 `docs/superpowers/plans/2026-11-22-foundation-followups.md`）

## Global Constraints

- Next.js 16 與訓練資料不同：寫程式前先讀 `node_modules/next/dist/docs/` 對應文件。`middleware.ts` 已改名為 `proxy.ts`（匯出 `proxy` 函式）。
- `cacheComponents` 已開啟：讀 `cookies()`、`headers()`、`searchParams`、`params` 的元件必須在 `<Suspense>` 內；不要在 layout 最外層 await session（見 `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`）。不可使用 `export const runtime`、`export const dynamic`。
- 金鑰：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（瀏覽器可見）、`SUPABASE_SECRET_KEY`（只能出現在 import `server-only` 的檔案，絕不加 `NEXT_PUBLIC_` 前綴）。
- 讀取與編輯一律用**使用者自己的** client（`src/lib/supabase/server.ts` 或 `client.ts`），不可使用 `createAdminClient()`。唯一例外是 OG 圖片：用本計畫新增的 `createAnonClient()`（publishable key、不帶 session，等同訪客），也不是 admin。
- SQL 函式一律 `set search_path = ''`，物件名稱寫完整 schema。
- 資料表與函式權限寫在 migration：新資料表先 `revoke all ... from anon, authenticated, service_role` 再明確 `grant`（本機預設權限會自動授權全部，雲端不會；見 followups「資料表權限寫在 migration」）。新函式先 `revoke execute ... from public, anon, authenticated, service_role` 再 `grant` 給需要的角色。
- 寫入只能經由 SECURITY DEFINER 函式（比照 `update_creator_account`）：檢查 `auth.uid()`、身分、格式與長度；錯誤用 `raise exception 'invalid <欄位>' using errcode = '22023'`、`'not a creator'`／`'not authenticated'` 用 `42501`。
- 文字清理：資料庫用 `public.clean_text()`、`public.has_bidi()`；前端用 `src/lib/validation/onboarding.ts` 的 `cleanText()`、`hasBidi()`（兩邊集合完全相同，不可另寫一套）。
- 每個讀取使用者資料的後台頁面與 server action 都要呼叫 `requireRole`。公開頁 `/c/*` 是公開的，不呼叫 `requireRole`（`src/lib/auth/routes.ts` 不保護 `/c`，已有測試）。
- 介面文字為繁體中文；產品名稱只從 `src/lib/site.ts` 的 `SITE_NAME` 取得。
- 顏色只用 `src/app/globals.css` 的 token class：`bg-bg`、`bg-panel`、`bg-surface`、`border-line`、`divide-line`、`text-ink`、`bg-ink`、`text-muted`、`text-on-ink`、`bg-primary`、`bg-primary-soft`、`text-success`、`bg-success-soft`、`text-danger`、`ring-ink`、`accent-ink`；圓角 `rounded-card`、`rounded-btn`、`rounded-nav`、`rounded-input`。不可用 `text-white` 或其他色碼。唯一例外是 OG 圖片（`ImageResponse` 不吃 Tailwind）：用 `opengraph-image.tsx` 內的 `OG_COLORS` 常數，值與 token 相同。
- 不新增 npm 套件。圖示用已安裝的 `lucide-react`，`strokeWidth={1.5}`、`aria-hidden="true"`。
- 只動**本機** Supabase：不可執行 `supabase link`、`db push --remote`、`supabase config push`，也不可連到正式專案。
- 每個 task 結束時：`npm run lint && npm run typecheck && npm test` 全過；有動到 SQL 的 task 另跑 `npx supabase test db` 全過。
- Commit 訊息用中文寫「計畫 3 Task N：重點」，結尾加你所在環境指定的 Co-Authored-By 歸屬行（寫實際執行的模型）。
- 前置：Docker Desktop 已啟動，`npx supabase start` 已執行，`.env.local` 已設定（見 README「本機開發」）。

## 快取決定：公開頁不快取，逐次請求讀取

讀過的文件：
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md`（快取內不能讀 cookie；預設 in-memory 快取在 serverless 不跨請求保存）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md`、`revalidateTag.md`、`updateTag.md`（`updateTag` 只能在 Server Action 呼叫；`revalidateTag` 要在 Server Function 或 Route Handler 呼叫）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`（「With Cache Components」：metadata 讀 runtime 資料時會在請求時串流）
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md`、`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`、`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`（「Status codes」）
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`、`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/image-response.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`（「With Cache Components」：GET handler 讀未快取資料時在請求時執行）

決定：`/c/[handle]` 的頁面殼（頂列、骨架）是靜態的；創作者資料、作品、報價、訪客身分都在 `<Suspense>` 內、每次請求以使用者自己的 client 讀取，不用 `"use cache"`。理由：
1. **審核狀態目前在 Supabase Studio 用 SQL 改**（README「審核創作者」），App 沒有任何程式路徑可以在核准或停權時呼叫 `revalidateTag`／`updateTag`。若用 tag 快取，停權後公開頁還會繼續顯示，違反「審核狀態一改就要能看到」。
2. 同一個查詢（`get_public_creator`）要判斷「是不是本人」才能讓 pending 本人預覽，這需要 session；把公開資料與本人判斷拆成兩份快取只為了省一次 RPC，不划算。
3. 部署在 Vercel（serverless）時，`"use cache"` 預設的 in-memory 快取不跨請求保存（`use-cache.md`「Runtime caching considerations」），實際省不到多少。
4. 成本：每次瀏覽一次 `get_public_creator` RPC + 一次作品查詢（品牌再加一次報價查詢），MVP 流量可以接受。

日後計畫 9 加入 `set_creator_status()` 與管理後台的核准 Server Action 時，再評估改成 `cacheTag('creator:<handle>')` 的公開資料快取，並在核准、停權與創作者儲存時 `updateTag`（寫進 followups）。

連帶結果（已寫進 followups）：因為 `notFound()` 發生在 `<Suspense>` 內、頁面殼已開始串流，找不到或未審核的 handle 回應碼會是 **200**，Next 會自動插入 `<meta name="robots" content="noindex">`（`03-file-conventions/not-found.md`、`loading.md`「Status codes」）。這是 soft 404；不在 proxy 查資料庫。

## File Structure

| 檔案 | 責任 |
|---|---|
| `supabase/migrations/20261124000200_creator_public_profile.sql` | 新欄位、作品表、報價收回直接寫入、公開讀取與寫入函式、權限 |
| `supabase/migrations/20261124000300_creator_media.sql` | `creator-media` bucket 與 policy |
| `supabase/tests/08_creator_public_profile.test.sql`、`09_creator_media.test.sql` | pgTAP |
| `src/lib/supabase/database.types.ts` | `npm run db:types` 產生（不手改） |
| `src/lib/options.ts` | 新增 `COLLAB_TYPES`、`AUDIENCE_AGES` |
| `src/lib/storage-url.ts` | `publicObjectUrl(bucket, path)`：Storage 路徑 → 公開網址 |
| `src/lib/brand-logo.ts` | 改用 `publicObjectUrl` |
| `src/lib/creator-media.ts` | `creatorMediaUrl()`、`planMediaUpload()`（上傳前檢查與產生路徑） |
| `src/lib/format.ts` | 千分位、NT$、百分比、名字首字 |
| `src/lib/validation/creator-profile.ts` | 公開頁表單驗證（IG 連結、標籤、作品、報價） |
| `src/lib/validation/form-data.ts` | 新增三個表單的 FormData 解析 |
| `src/lib/auth/account-errors.ts` | 新函式的錯誤 → 表單欄位 |
| `src/lib/auth/post-login.ts` | 登入後可以回到 `/c/<handle>` |
| `src/lib/creators/view.ts` | 公開頁的型別與純函式（資料列轉換、瀏覽者身分、報價排序） |
| `src/lib/supabase/anon.ts` | `createAnonClient()`：不帶 session 的訪客 client（server-only） |
| `src/lib/creators/public-profile.ts` | 公開頁讀取（server-only） |
| `src/lib/creators/own-profile.ts` | 創作者後台讀自己的公開頁資料（server-only） |
| `src/lib/creators/metadata.ts` | `profileMetadata()`：title、description、robots |
| `src/lib/creators/og-avatar.ts` | `avatarDataUri()`：OG 圖片用的頭像 data URI |
| `src/app/c/layout.tsx` | 公開頁外框（頂列，不套登入後的側邊導覽） |
| `src/app/c/[handle]/page.tsx` | 公開頁（`generateMetadata`、`<Suspense>`、`notFound()`） |
| `src/app/c/[handle]/ProfileView.tsx` | 公開頁版面（server component） |
| `src/app/c/[handle]/not-found.tsx` | 找不到創作者 |
| `src/app/c/[handle]/opengraph-image.tsx` | OG 圖片 |
| `src/components/forms/AvatarField.tsx` | 頭像上傳欄位 |
| `src/app/creator/me/page.tsx` | 加「編輯公開頁」「查看我的公開頁」連結 |
| `src/app/creator/me/profile/page.tsx` | 後台「公開頁」子頁 |
| `src/app/creator/me/profile/actions.ts` | 三個 server action |
| `src/app/creator/me/profile/PublicProfileForm.tsx`、`PortfolioForm.tsx`、`RatesForm.tsx` | 三張表單 |
| `README.md`、`docs/superpowers/plans/2026-11-22-foundation-followups.md` | 文件同步 |

---

### Task 1: 資料庫：公開頁欄位、作品表、報價改走函式、公開讀取函式

**Files:**
- Create: `supabase/migrations/20261124000200_creator_public_profile.sql`、`supabase/tests/08_creator_public_profile.test.sql`
- Modify: `src/lib/supabase/database.types.ts`（產生）

**Interfaces:**
- Consumes: `public.clean_text(text)`、`public.has_bidi(text)`、`public.is_admin()`（`20261123000100_accounts.sql`、`20261122000100_profiles.sql`）。
- Produces:
  - `creator_profiles.avatar_path text`（null 或 `<user_id>/avatar-<檔名>`）、`creator_profiles.audience_age text`（≤ 10 字）。
  - 資料表 `creator_portfolio_items(id, creator_id, image_path, link_url, position, created_at)`：anon / authenticated / service_role 只有 SELECT。
  - `get_public_creator(p_handle text)` → 0 或 1 列 `(user_id uuid, handle, display_name, avatar_path, region, categories text[], follower_count int, engagement_rate numeric, audience_age, style_tags text[], collab_types text[], bio, status, is_self boolean)`；anon、authenticated 可呼叫。
  - `update_creator_public_profile(p_bio text, p_style_tags text[], p_collab_types text[], p_engagement_rate numeric, p_audience_age text, p_avatar_path text) returns void`；錯誤訊息 `invalid bio|style_tags|collab_types|engagement_rate|audience_age|avatar_path`。從 `collab_types` 移除的合作形式，報價一併刪除。
  - `set_creator_portfolio(p_items jsonb) returns void`：`[{image_path, link_url}]`，最多 6 項；錯誤 `invalid portfolio|image_path|link_url`。
  - `set_creator_rates(p_rates jsonb) returns void`：`[{collab_type, price_twd}]`；錯誤 `invalid rates|collab_type|price_twd`。
  - 三個寫入函式只開放給 authenticated；非創作者呼叫得到 `42501 not a creator`。
  - `creator_rates`：authenticated／anon 不能 INSERT、UPDATE、DELETE（`creator_rates_write_own` policy 移除）。

- [ ] **Step 1: 寫失敗的測試 `supabase/tests/08_creator_public_profile.test.sql`**

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(83);

-- f1 品牌、f2 已審核創作者（mei）、f3 待審核創作者（ming）、f4 另一位已審核創作者（hua）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'f1@test.local'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@test.local'),
  ('00000000-0000-0000-0000-0000000000f3', 'f3@test.local'),
  ('00000000-0000-0000-0000-0000000000f4', 'f4@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000f1', 'brand', '品牌F'),
  ('00000000-0000-0000-0000-0000000000f2', 'creator', '小美'),
  ('00000000-0000-0000-0000-0000000000f3', 'creator', '阿明'),
  ('00000000-0000-0000-0000-0000000000f4', 'creator', '小華');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000000f1', '品牌F');
insert into public.creator_profiles (user_id, handle, ig_username, status, collab_types) values
  ('00000000-0000-0000-0000-0000000000f2', 'mei', 'mei.ig', 'approved', array['IG 貼文']),
  ('00000000-0000-0000-0000-0000000000f3', 'ming', 'ming.ig', 'pending', array['IG 貼文']),
  ('00000000-0000-0000-0000-0000000000f4', 'hua', 'hua.ig', 'approved', '{}');
insert into public.creator_rates (creator_id, collab_type, price_twd) values
  ('00000000-0000-0000-0000-0000000000f2', 'IG 貼文', 4500),
  ('00000000-0000-0000-0000-0000000000f3', 'IG 貼文', 3000);
insert into public.creator_portfolio_items (creator_id, image_path, position) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f2/portfolio-a.jpg', 0),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f2/portfolio-b.jpg', 1),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f3/portfolio-a.jpg', 0);

-- 結構與權限
select has_column('public', 'creator_profiles', 'avatar_path', '有 avatar_path 欄位');
select has_column('public', 'creator_profiles', 'audience_age', '有 audience_age 欄位');
select ok(not has_table_privilege('authenticated', 'public.creator_rates', 'INSERT'), 'authenticated 沒有 creator_rates INSERT');
select ok(not has_table_privilege('authenticated', 'public.creator_rates', 'UPDATE'), 'authenticated 沒有 creator_rates UPDATE');
select ok(not has_table_privilege('authenticated', 'public.creator_rates', 'DELETE'), 'authenticated 沒有 creator_rates DELETE');
select ok(has_table_privilege('anon', 'public.creator_portfolio_items', 'SELECT'), 'anon 可以讀作品（受 RLS 限制）');
select ok(not has_table_privilege('authenticated', 'public.creator_portfolio_items', 'INSERT'), 'authenticated 沒有作品 INSERT');
select ok(not has_table_privilege('service_role', 'public.creator_portfolio_items', 'INSERT'), 'service_role 沒有作品 INSERT');
select ok(has_function_privilege('anon', 'public.get_public_creator(text)', 'EXECUTE'), 'anon 可以呼叫 get_public_creator');
select ok(not has_function_privilege('anon', 'public.set_creator_rates(jsonb)', 'EXECUTE'), 'anon 不能呼叫 set_creator_rates');
select ok(not has_function_privilege('authenticated', 'public.check_text_list(text[], text, integer, integer)', 'EXECUTE'),
  '內部檢查函式不開放');

-- 訪客
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select display_name from public.get_public_creator('mei')), '小美', '訪客讀得到已審核創作者的名稱');
select is((select is_self from public.get_public_creator('mei')), false, '訪客的 is_self 是 false');
select is((select count(*)::int from public.get_public_creator('ming')), 0, '訪客讀不到待審核的創作者');
select is((select count(*)::int from public.get_public_creator('nobody')), 0, '不存在的 handle 沒有資料');
select is((select count(*)::int from public.creator_portfolio_items), 2, '訪客只看得到已審核創作者的作品');
select is((select count(*)::int from public.creator_rates), 0, '訪客看不到報價');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', null, null, null)$$,
  '42501', null, '訪客不能修改公開頁');
select throws_ok(
  $$insert into public.creator_portfolio_items (creator_id, image_path, position)
    values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f2/portfolio-x.jpg', 2)$$,
  '42501', null, '訪客不能直接新增作品');

-- 品牌
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select is((select count(*)::int from public.creator_rates where creator_id = '00000000-0000-0000-0000-0000000000f2'), 1,
  '品牌看得到已審核創作者的報價');
select is((select count(*)::int from public.creator_rates where creator_id = '00000000-0000-0000-0000-0000000000f3'), 0,
  '品牌看不到待審核創作者的報價');
select is((select count(*)::int from public.get_public_creator('ming')), 0, '品牌讀不到待審核的創作者');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', null, null, null)$$,
  '42501', 'not a creator', '品牌不能修改創作者公開頁');
select throws_ok($$select public.set_creator_portfolio('[]'::jsonb)$$,
  '42501', 'not a creator', '品牌不能設定作品');
select throws_ok($$select public.set_creator_rates('[]'::jsonb)$$,
  '42501', 'not a creator', '品牌不能設定報價');

-- 待審核創作者 f3（本人）
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);
select is((select is_self from public.get_public_creator('ming')), true, '本人讀得到自己待審核的資料');
select is((select status from public.get_public_creator('ming')), 'pending', '回傳審核狀態');
select is((select count(*)::int from public.creator_portfolio_items where creator_id = auth.uid()), 1,
  '本人看得到自己待審核的作品');
select throws_ok(
  $$insert into public.creator_rates (creator_id, collab_type, price_twd) values (auth.uid(), 'Reels', 1)$$,
  '42501', null, '不能直接新增報價');
select throws_ok($$update public.creator_rates set price_twd = 1 where creator_id = auth.uid()$$,
  '42501', null, '不能直接修改報價');
select throws_ok($$delete from public.creator_rates where creator_id = auth.uid()$$,
  '42501', null, '不能直接刪除報價');
select throws_ok(
  $$insert into public.creator_portfolio_items (creator_id, image_path, position)
    values (auth.uid(), '00000000-0000-0000-0000-0000000000f3/portfolio-x.jpg', 3)$$,
  '42501', null, '不能直接新增作品');
select throws_ok($$update public.creator_portfolio_items set link_url = null where creator_id = auth.uid()$$,
  '42501', null, '不能直接修改作品');
select throws_ok($$delete from public.creator_portfolio_items where creator_id = auth.uid()$$,
  '42501', null, '不能直接刪除作品');

-- update_creator_public_profile 驗證
select lives_ok(
  $$select public.update_creator_public_profile(
      E'　日常穿搭分享 ', array[' 日系 ', '簡約'], array['IG 貼文', 'Reels'], 3.5, '18-24',
      '00000000-0000-0000-0000-0000000000f3/avatar-1.png')$$,
  '創作者可以修改公開頁資料');
select is((select bio from public.creator_profiles where user_id = auth.uid()), '日常穿搭分享', 'bio 去掉前後空白');
select is((select style_tags from public.creator_profiles where user_id = auth.uid()), array['日系', '簡約'],
  '風格標籤逐項清理');
select is((select collab_types from public.creator_profiles where user_id = auth.uid()), array['IG 貼文', 'Reels'],
  '想接的合作已存下');
select is((select engagement_rate from public.creator_profiles where user_id = auth.uid()), 3.50::numeric, '互動率已存下');
select is((select audience_age from public.creator_profiles where user_id = auth.uid()), '18-24', '受眾年齡已存下');
select is((select avatar_path from public.creator_profiles where user_id = auth.uid()),
  '00000000-0000-0000-0000-0000000000f3/avatar-1.png', '頭像路徑已存下');
select is((select status from public.creator_profiles where user_id = auth.uid()), 'pending', '狀態沒有被改動');
select is((select handle from public.creator_profiles where user_id = auth.uid()), 'ming', 'handle 沒有被改動');
select throws_ok($$select public.update_creator_public_profile(repeat('長', 301), '{}', '{}', null, null, null)$$,
  '22023', 'invalid bio', 'bio 最多 300 字');
select throws_ok($$select public.update_creator_public_profile(E'小‮美', '{}', '{}', null, null, null)$$,
  '22023', 'invalid bio', 'bio 不可含雙向控制字元');
select throws_ok($$select public.update_creator_public_profile(null, array['a','b','c','d','e','f','g','h','i'], '{}', null, null, null)$$,
  '22023', 'invalid style_tags', '風格標籤最多 8 個');
select throws_ok($$select public.update_creator_public_profile(null, array[repeat('長', 13)], '{}', null, null, null)$$,
  '22023', 'invalid style_tags', '每個風格標籤最多 12 字');
select throws_ok($$select public.update_creator_public_profile(null, array['日系', ' 日系'], '{}', null, null, null)$$,
  '22023', 'invalid style_tags', '風格標籤不可重複');
select throws_ok($$select public.update_creator_public_profile(null, array[E'​'], '{}', null, null, null)$$,
  '22023', 'invalid style_tags', '只有零寬空白的標籤視為空白');
select throws_ok($$select public.update_creator_public_profile(null, '{}', array['a','b','c','d','e','f','g'], null, null, null)$$,
  '22023', 'invalid collab_types', '想接的合作最多 6 個');
select throws_ok($$select public.update_creator_public_profile(null, '{}', array[repeat('長', 21)], null, null, null)$$,
  '22023', 'invalid collab_types', '每個合作形式最多 20 字');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', 100.5, null, null)$$,
  '22023', 'invalid engagement_rate', '互動率不可超過 100');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', -1, null, null)$$,
  '22023', 'invalid engagement_rate', '互動率不可為負數');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', null, repeat('1', 11), null)$$,
  '22023', 'invalid audience_age', '受眾年齡最多 10 字');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', null, null, '00000000-0000-0000-0000-0000000000f2/avatar-1.png')$$,
  '22023', 'invalid avatar_path', '頭像不能指到別人的資料夾');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', null, null, '00000000-0000-0000-0000-0000000000f3/portfolio-1.png')$$,
  '22023', 'invalid avatar_path', '頭像檔名必須以 avatar- 開頭');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', null, null, '00000000-0000-0000-0000-0000000000f3/avatar-..png')$$,
  '22023', 'invalid avatar_path', '頭像路徑不可含 ..');

-- set_creator_portfolio
select lives_ok(
  $$select public.set_creator_portfolio('[
      {"image_path": "00000000-0000-0000-0000-0000000000f3/portfolio-2.jpg", "link_url": "https://www.instagram.com/p/ABC123/"},
      {"image_path": "00000000-0000-0000-0000-0000000000f3/portfolio-1.jpg", "link_url": null}
    ]'::jsonb)$$,
  '創作者可以整批設定作品');
select is(
  (select array_agg(image_path order by position) from public.creator_portfolio_items where creator_id = auth.uid()),
  array['00000000-0000-0000-0000-0000000000f3/portfolio-2.jpg', '00000000-0000-0000-0000-0000000000f3/portfolio-1.jpg'],
  '作品依陣列順序排列，舊的被取代');
select is((select link_url from public.creator_portfolio_items where creator_id = auth.uid() and position = 0),
  'https://www.instagram.com/p/ABC123/', 'IG 連結已存下');
select throws_ok(
  $$select public.set_creator_portfolio((select jsonb_agg(jsonb_build_object('image_path',
      '00000000-0000-0000-0000-0000000000f3/portfolio-' || i || '.jpg')) from generate_series(1, 7) as i))$$,
  '22023', 'invalid portfolio', '作品最多 6 張');
select throws_ok($$select public.set_creator_portfolio('{}'::jsonb)$$,
  '22023', 'invalid portfolio', '作品必須是陣列');
select throws_ok($$select public.set_creator_portfolio('[{"image_path": "00000000-0000-0000-0000-0000000000f2/portfolio-a.jpg"}]'::jsonb)$$,
  '22023', 'invalid image_path', '作品不能指到別人的資料夾');
select throws_ok($$select public.set_creator_portfolio('[{"image_path": "00000000-0000-0000-0000-0000000000f3/avatar-1.png"}]'::jsonb)$$,
  '22023', 'invalid image_path', '作品檔名必須以 portfolio- 開頭');
select throws_ok($$select public.set_creator_portfolio('[{"image_path": "00000000-0000-0000-0000-0000000000f3/portfolio-1.jpg", "link_url": "https://evil.com/p/1"}]'::jsonb)$$,
  '22023', 'invalid link_url', '連結必須是 instagram.com');
select throws_ok($$select public.set_creator_portfolio('[{"image_path": "00000000-0000-0000-0000-0000000000f3/portfolio-1.jpg", "link_url": "http://instagram.com/p/1"}]'::jsonb)$$,
  '22023', 'invalid link_url', '連結必須是 https');
select throws_ok($$select public.set_creator_portfolio('[{"image_path": "00000000-0000-0000-0000-0000000000f3/portfolio-1.jpg", "link_url": "https://instagram.com.evil.com/p/1"}]'::jsonb)$$,
  '22023', 'invalid link_url', '不接受假冒的 instagram 網域');
select is((select count(*)::int from public.creator_portfolio_items where creator_id = auth.uid()), 2,
  '失敗的呼叫不會清掉原本的作品');

-- set_creator_rates（目前 collab_types = IG 貼文、Reels）
select lives_ok(
  $$select public.set_creator_rates('[{"collab_type": "IG 貼文", "price_twd": 4500}, {"collab_type": "Reels", "price_twd": 8000}]'::jsonb)$$,
  '創作者可以整批設定報價');
select is((select count(*)::int from public.creator_rates where creator_id = auth.uid()), 2, '報價已取代為 2 筆');
select throws_ok($$select public.set_creator_rates('[{"collab_type": "限時動態", "price_twd": 1000}]'::jsonb)$$,
  '22023', 'invalid collab_type', '合作形式必須在自己的想接合作裡');
select throws_ok($$select public.set_creator_rates('[{"collab_type": "Reels", "price_twd": 1}, {"collab_type": "Reels", "price_twd": 2}]'::jsonb)$$,
  '22023', 'invalid collab_type', '合作形式不可重複');
select throws_ok($$select public.set_creator_rates('[{"collab_type": "Reels", "price_twd": -1}]'::jsonb)$$,
  '22023', 'invalid price_twd', '價格不可為負數');
select throws_ok($$select public.set_creator_rates('[{"collab_type": "Reels", "price_twd": 10000001}]'::jsonb)$$,
  '22023', 'invalid price_twd', '價格上限 10,000,000');
select throws_ok($$select public.set_creator_rates('[{"collab_type": "Reels", "price_twd": 1.5}]'::jsonb)$$,
  '22023', 'invalid price_twd', '價格必須是整數');
select throws_ok($$select public.set_creator_rates('[{"collab_type": "Reels", "price_twd": "100"}]'::jsonb)$$,
  '22023', 'invalid price_twd', '價格必須是數字');
select lives_ok($$select public.update_creator_public_profile(null, '{}', array['IG 貼文'], null, null, null)$$,
  '取消勾選 Reels');
select is((select array_agg(collab_type) from public.creator_rates where creator_id = auth.uid()), array['IG 貼文'],
  '取消勾選的合作形式，報價一併刪除');

-- 另一位已審核創作者 f4
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f4","role":"authenticated"}', true);
select is((select count(*)::int from public.get_public_creator('ming')), 0, '其他創作者讀不到待審核的創作者');
select is((select count(*)::int from public.creator_portfolio_items where creator_id = '00000000-0000-0000-0000-0000000000f3'), 0,
  '其他創作者看不到待審核創作者的作品');
select lives_ok($$select public.set_creator_portfolio('[]'::jsonb)$$, '清空自己的作品');
select throws_ok($$delete from public.creator_rates where creator_id = '00000000-0000-0000-0000-0000000000f2'$$,
  '42501', null, '不能刪除別人的報價');

reset role;
select is((select count(*)::int from public.creator_portfolio_items where creator_id = '00000000-0000-0000-0000-0000000000f2'), 2,
  '別人的作品沒有被動到');

select * from finish();
rollback;
```

- [ ] **Step 2: 確認失敗**

```bash
npx supabase test db
```
Expected: `08_creator_public_profile.test.sql` 失敗（種資料時就報 `relation "public.creator_portfolio_items" does not exist`），01–07 仍然通過。

- [ ] **Step 3: 寫 migration `supabase/migrations/20261124000200_creator_public_profile.sql`**

```sql
-- 創作者公開檔案頁（計畫 3）：頭像、受眾年齡、作品、報價改走函式、公開讀取函式
-- 權限一律在這裡明確寫出（雲端新專案不會自動授權，本機會；見 20261124000100_explicit_api_grants.sql）。

-- 1. creator_profiles 新欄位與限制
alter table public.creator_profiles
  add column avatar_path text,
  add column audience_age text;

alter table public.creator_profiles
  add constraint creator_profiles_avatar_path_check check (
    avatar_path is null
    or (
      avatar_path ~ ('^' || user_id::text || '/avatar-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
      and avatar_path !~ '\.\.'
    )
  ),
  add constraint creator_profiles_audience_age_len
    check (audience_age is null or char_length(audience_age) between 1 and 10),
  add constraint creator_profiles_bio_len
    check (bio is null or char_length(bio) between 1 and 300),
  add constraint creator_profiles_style_tags_max check (cardinality(style_tags) <= 8),
  add constraint creator_profiles_collab_types_max check (cardinality(collab_types) <= 6);

-- 2. 報價：價格上限、合作形式長度；收回直接寫入（只能經由 set_creator_rates）
alter table public.creator_rates
  add constraint creator_rates_price_max check (price_twd <= 10000000),
  add constraint creator_rates_collab_type_len check (char_length(collab_type) between 1 and 20);
drop policy creator_rates_write_own on public.creator_rates;
revoke insert, update, delete on public.creator_rates from anon, authenticated;

-- 3. 作品
create table public.creator_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (user_id) on delete cascade,
  image_path text not null,
  link_url text,
  position smallint not null check (position between 0 and 5),
  created_at timestamptz not null default now(),
  unique (creator_id, position),
  constraint creator_portfolio_items_image_path_check check (
    image_path ~ ('^' || creator_id::text || '/portfolio-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and image_path !~ '\.\.'
  ),
  constraint creator_portfolio_items_link_url_len
    check (link_url is null or char_length(link_url) between 1 and 300)
);
alter table public.creator_portfolio_items enable row level security;

-- 與 creator_profiles_select 相同：已審核的公開給所有人；本人與管理員看得到全部
create policy creator_portfolio_items_select on public.creator_portfolio_items
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.creator_profiles cp
      where cp.user_id = creator_portfolio_items.creator_id
        and (cp.status = 'approved' or cp.user_id = auth.uid() or public.is_admin())
    )
  );

-- 本機的預設權限會自動授權全部，先全部收回再明確授權
revoke all on public.creator_portfolio_items from anon, authenticated, service_role;
grant select on public.creator_portfolio_items to anon, authenticated, service_role;

-- 4. 內部共用檢查（只給 definer 函式呼叫）
-- 文字清單：每項 clean_text 後不可為空、不可含雙向控制字元、長度 1..p_max_len、不可重複、最多 p_max_count 項
create function public.check_text_list(p text[], p_field text, p_max_count integer, p_max_len integer)
returns text[]
language plpgsql immutable set search_path = '' as $$
declare
  v text[];
begin
  select coalesce(array_agg(public.clean_text(c) order by ord), '{}')
    into v
    from unnest(coalesce(p, '{}'::text[])) with ordinality as t(c, ord);
  if cardinality(v) > p_max_count
     or exists (select 1 from unnest(v) as c
                where c is null or public.has_bidi(c) or char_length(c) not between 1 and p_max_len)
     or (select count(distinct c) from unnest(v) as c) <> cardinality(v) then
    raise exception 'invalid %', p_field using errcode = '22023';
  end if;
  return v;
end;
$$;

-- creator-media 路徑：<uid>/<kind>-<檔名>；空字串視為 null
create function public.check_media_path(p_uid uuid, p_path text, p_kind text, p_field text)
returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := nullif(public.clean_text(p_path), '');
begin
  if v is not null and (
    v !~ ('^' || p_uid::text || '/' || p_kind || '-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$') or v ~ '\.\.'
  ) then
    raise exception 'invalid %', p_field using errcode = '22023';
  end if;
  return v;
end;
$$;

-- IG 連結：https://instagram.com/... 或 https://www.instagram.com/...（前端 isInstagramUrl 用同一條規則）
create function public.check_instagram_url(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := nullif(public.clean_text(p), '');
begin
  if v is not null and (
    public.has_bidi(v)
    or char_length(v) > 300
    or v !~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._~%/?=&+-]+$'
  ) then
    raise exception 'invalid link_url' using errcode = '22023';
  end if;
  return v;
end;
$$;

revoke execute on function public.check_text_list(text[], text, integer, integer)
  from public, anon, authenticated, service_role;
revoke execute on function public.check_media_path(uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.check_instagram_url(text)
  from public, anon, authenticated, service_role;

-- 5. 公開讀取：anon 讀不到 profiles.display_name，所以用 definer 函式只回傳公開欄位。
--    已審核的給所有人；未審核的只有本人讀得到；其他情況不回傳任何列。
--    user_id 用來查作品與報價（頭像的公開網址本來就含 user_id，不算新洩漏）。
create function public.get_public_creator(p_handle text)
returns table (
  user_id uuid,
  handle text,
  display_name text,
  avatar_path text,
  region text,
  categories text[],
  follower_count integer,
  engagement_rate numeric,
  audience_age text,
  style_tags text[],
  collab_types text[],
  bio text,
  status text,
  is_self boolean
)
language sql stable security definer set search_path = '' as $$
  select cp.user_id, cp.handle, p.display_name, cp.avatar_path, cp.region, cp.categories,
         cp.follower_count, cp.engagement_rate, cp.audience_age, cp.style_tags, cp.collab_types,
         cp.bio, cp.status, coalesce(cp.user_id = auth.uid(), false)
    from public.creator_profiles cp
    join public.profiles p on p.id = cp.user_id
   where cp.handle = p_handle
     and (cp.status = 'approved' or cp.user_id = auth.uid());
$$;
revoke execute on function public.get_public_creator(text) from public, anon, authenticated, service_role;
grant execute on function public.get_public_creator(text) to anon, authenticated;

-- 6. 修改公開頁資料（不會改到 status、handle）
--    p_avatar_path 傳 null 或空字串代表移除頭像。
--    從 collab_types 移除的合作形式，對應的報價一併刪除。
create function public.update_creator_public_profile(
  p_bio text,
  p_style_tags text[],
  p_collab_types text[],
  p_engagement_rate numeric,
  p_audience_age text,
  p_avatar_path text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_bio text := nullif(public.clean_text(p_bio), '');
  v_age text := nullif(public.clean_text(p_audience_age), '');
  v_tags text[];
  v_types text[];
  v_avatar text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform 1 from public.creator_profiles where user_id = v_uid for update;
  if not found then
    raise exception 'not a creator' using errcode = '42501';
  end if;
  if v_bio is not null and (public.has_bidi(v_bio) or char_length(v_bio) > 300) then
    raise exception 'invalid bio' using errcode = '22023';
  end if;
  v_tags := public.check_text_list(p_style_tags, 'style_tags', 8, 12);
  v_types := public.check_text_list(p_collab_types, 'collab_types', 6, 20);
  if p_engagement_rate is not null and p_engagement_rate not between 0 and 100 then
    raise exception 'invalid engagement_rate' using errcode = '22023';
  end if;
  if v_age is not null and (public.has_bidi(v_age) or char_length(v_age) > 10) then
    raise exception 'invalid audience_age' using errcode = '22023';
  end if;
  v_avatar := public.check_media_path(v_uid, p_avatar_path, 'avatar', 'avatar_path');

  update public.creator_profiles
     set bio = v_bio, style_tags = v_tags, collab_types = v_types,
         engagement_rate = p_engagement_rate, audience_age = v_age, avatar_path = v_avatar
   where user_id = v_uid;
  delete from public.creator_rates
   where creator_id = v_uid and not (collab_type = any (v_types));
end;
$$;
revoke execute on function public.update_creator_public_profile(text, text[], text[], numeric, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_creator_public_profile(text, text[], text[], numeric, text, text)
  to authenticated;

-- 7. 作品整批覆寫：p_items 是陣列，每項 {image_path, link_url}，最多 6 項，position 依陣列順序
create function public.set_creator_portfolio(p_items jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_path text;
  v_link text;
  v_pos smallint := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform 1 from public.creator_profiles where user_id = v_uid for update;
  if not found then
    raise exception 'not a creator' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 6 then
    raise exception 'invalid portfolio' using errcode = '22023';
  end if;

  delete from public.creator_portfolio_items where creator_id = v_uid;
  for v_item in select e from jsonb_array_elements(p_items) with ordinality as t(e, ord) order by ord loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'invalid portfolio' using errcode = '22023';
    end if;
    v_path := public.check_media_path(v_uid, v_item ->> 'image_path', 'portfolio', 'image_path');
    if v_path is null then
      raise exception 'invalid image_path' using errcode = '22023';
    end if;
    v_link := public.check_instagram_url(v_item ->> 'link_url');
    insert into public.creator_portfolio_items (creator_id, image_path, link_url, position)
    values (v_uid, v_path, v_link, v_pos);
    v_pos := v_pos + 1;
  end loop;
end;
$$;
revoke execute on function public.set_creator_portfolio(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.set_creator_portfolio(jsonb) to authenticated;

-- 8. 報價整批覆寫：p_rates 是陣列，每項 {collab_type, price_twd}；
--    collab_type 必須在自己的 collab_types 裡、不可重複；price_twd 是 0..10,000,000 的整數（JSON number）
create function public.set_creator_rates(p_rates jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_types text[];
  v_seen text[] := '{}';
  v_item jsonb;
  v_type text;
  v_price numeric;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select collab_types into v_types from public.creator_profiles where user_id = v_uid for update;
  if not found then
    raise exception 'not a creator' using errcode = '42501';
  end if;
  if p_rates is null or jsonb_typeof(p_rates) <> 'array' or jsonb_array_length(p_rates) > 6 then
    raise exception 'invalid rates' using errcode = '22023';
  end if;

  delete from public.creator_rates where creator_id = v_uid;
  for v_item in select e from jsonb_array_elements(p_rates) with ordinality as t(e, ord) order by ord loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'invalid rates' using errcode = '22023';
    end if;
    v_type := public.clean_text(v_item ->> 'collab_type');
    if v_type is null or not (v_type = any (v_types)) or v_type = any (v_seen) then
      raise exception 'invalid collab_type' using errcode = '22023';
    end if;
    if jsonb_typeof(v_item -> 'price_twd') is distinct from 'number' then
      raise exception 'invalid price_twd' using errcode = '22023';
    end if;
    v_price := (v_item ->> 'price_twd')::numeric;
    if v_price <> trunc(v_price) or v_price not between 0 and 10000000 then
      raise exception 'invalid price_twd' using errcode = '22023';
    end if;
    insert into public.creator_rates (creator_id, collab_type, price_twd)
    values (v_uid, v_type, v_price::integer);
    v_seen := v_seen || v_type;
  end loop;
end;
$$;
revoke execute on function public.set_creator_rates(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.set_creator_rates(jsonb) to authenticated;
```

- [ ] **Step 4: 套用並確認通過**

```bash
npx supabase migration up && npx supabase test db
```
Expected: `Result: PASS`，01–08 全過（240 + 83 = 323 個測試）。用 `migration up` 而不是 `db reset`，以保留本機已建立的帳號資料。

- [ ] **Step 5: 重新產生型別並確認**

```bash
npm run db:types && git diff --stat src/lib/supabase/database.types.ts && npm run typecheck
```
Expected: `database.types.ts` 有變更（新增 `creator_portfolio_items`、`avatar_path`、`audience_age` 與 4 個函式）；typecheck 通過。

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261124000200_creator_public_profile.sql supabase/tests/08_creator_public_profile.test.sql src/lib/supabase/database.types.ts
git commit -m "計畫 3 Task 1：公開頁欄位、作品表、報價改走函式、get_public_creator"
```

---

### Task 2: 創作者圖片儲存空間 `creator-media`

**Files:**
- Create: `supabase/migrations/20261124000300_creator_media.sql`、`supabase/tests/09_creator_media.test.sql`

**Interfaces:**
- Consumes: `public.my_role()`（authenticated 已有 EXECUTE，見 `20261124000100_explicit_api_grants.sql`）。
- Produces: Storage bucket `creator-media`（public、5 MB、`image/jpeg`、`image/png`、`image/webp`）。物件路徑 `<user_id>/avatar-<檔名>` 或 `<user_id>/portfolio-<檔名>`（`<檔名>` 為 `[A-Za-z0-9][A-Za-z0-9._-]{0,99}`，不可巢狀、不可含 `..`），與 Task 1 的 CHECK 一致。只有創作者（`my_role() = 'creator'`）能寫入自己的資料夾。

- [ ] **Step 1: 寫失敗的測試 `supabase/tests/09_creator_media.test.sql`**

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1@test.local'),  -- 品牌
  ('00000000-0000-0000-0000-0000000000a2', 'a2@test.local'),  -- 創作者
  ('00000000-0000-0000-0000-0000000000a3', 'a3@test.local');  -- 還沒建立帳號
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'brand', '品牌A'),
  ('00000000-0000-0000-0000-0000000000a2', 'creator', '創作者A');

select is((select public from storage.buckets where id = 'creator-media'), true, 'bucket 是公開的');
select is((select file_size_limit from storage.buckets where id = 'creator-media'), 5242880::bigint, '檔案上限 5MB');
select is((select allowed_mime_types from storage.buckets where id = 'creator-media'),
  array['image/jpeg', 'image/png', 'image/webp'], '只接受 jpeg、png、webp');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a2/avatar-1.png')$$,
  '創作者可以上傳頭像到自己的資料夾');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a2/portfolio-1.jpg')$$,
  '創作者可以上傳作品到自己的資料夾');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a1/avatar-1.png')$$,
  '42501', null, '不能上傳到別人的資料夾');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a2/other-1.png')$$,
  '42501', null, '檔名必須以 avatar- 或 portfolio- 開頭');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a2/x/avatar-1.png')$$,
  '42501', null, '不能上傳到巢狀資料夾');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a2/avatar-..png')$$,
  '42501', null, '路徑不能含 ..');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a1/avatar-1.png')$$,
  '42501', null, '品牌不能上傳到 creator-media');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a3/avatar-1.png')$$,
  '42501', null, '還沒建立帳號的使用者不能上傳');

-- 別人不能刪除創作者的物件（RLS 讓該列不可見，影響 0 列）
select set_config('storage.allow_delete_query', 'true', true);
select lives_ok(
  $$delete from storage.objects where bucket_id = 'creator-media' and name = '00000000-0000-0000-0000-0000000000a2/avatar-1.png'$$,
  '刪除別人的物件不報錯（影響 0 列）');
reset role;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'creator-media' and name = '00000000-0000-0000-0000-0000000000a2/avatar-1.png'),
  1, '別人的物件沒有被刪除');

set local role anon;
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a2/avatar-2.png')$$,
  '42501', null, '未登入不能上傳');

select * from finish();
rollback;
```

- [ ] **Step 2: 確認失敗**

```bash
npx supabase test db
```
Expected: `09_creator_media.test.sql` 失敗（bucket 不存在，`is(null, true)` 不成立）。

- [ ] **Step 3: 寫 migration `supabase/migrations/20261124000300_creator_media.sql`**

```sql
-- 創作者頭像與作品圖片（計畫 3）
-- bucket 是公開的：未審核創作者的圖片網址若被猜到也看得到；路徑含亂數（UUID），這點可以接受（見 README）。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creator-media', 'creator-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 路徑規則與 creator_profiles.avatar_path、creator_portfolio_items.image_path 一致：
-- <uid>/avatar-<檔名> 或 <uid>/portfolio-<檔名>；不可巢狀、不可含 ..
-- 只有創作者可以寫入（my_role() = 'creator'）；品牌與還沒建立帳號的使用者都不行
create policy creator_media_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'creator-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy creator_media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'creator-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() = 'creator'
    and name ~ ('^' || auth.uid()::text || '/(avatar|portfolio)-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and name !~ '\.\.'
  );
create policy creator_media_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'creator-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'creator-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() = 'creator'
    and name ~ ('^' || auth.uid()::text || '/(avatar|portfolio)-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and name !~ '\.\.'
  );
create policy creator_media_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'creator-media' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 4: 套用並確認通過**

```bash
npx supabase migration up && npx supabase test db && npm run db:types && git diff --exit-code src/lib/supabase/database.types.ts
```
Expected: `Result: PASS`，01–09 全過（323 + 14 = 337）；型別沒有變化（只動到 storage schema）。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261124000300_creator_media.sql supabase/tests/09_creator_media.test.sql
git commit -m "計畫 3 Task 2：creator-media bucket，只有創作者能寫入自己的資料夾"
```

---

### Task 3: 純函式：選項、格式化、圖片路徑、表單驗證與解析、錯誤對應、登入後導回公開頁、公開頁型別

**Files:**
- Create: `src/lib/storage-url.ts`、`src/lib/creator-media.ts`、`src/lib/creator-media.test.ts`、`src/lib/format.ts`、`src/lib/format.test.ts`、`src/lib/validation/creator-profile.ts`、`src/lib/validation/creator-profile.test.ts`、`src/lib/creators/view.ts`、`src/lib/creators/view.test.ts`
- Modify: `src/lib/options.ts`、`src/lib/brand-logo.ts`、`src/lib/validation/form-data.ts`、`src/lib/validation/form-data.test.ts`、`src/lib/auth/account-errors.ts`、`src/lib/auth/account-errors.test.ts`、`src/lib/auth/post-login.ts`、`src/lib/auth/post-login.test.ts`

**Interfaces:**
- Consumes: `cleanText`、`hasBidi`、`HANDLE_RE`（`src/lib/validation/onboarding.ts`）；`Role`（`src/lib/auth/post-login.ts`）；`FormValues`、`FormState`（`src/lib/auth/account-errors.ts`）。Task 1 的錯誤訊息名稱。
- Produces:
  - `COLLAB_TYPES`、`AUDIENCE_AGES`（`src/lib/options.ts`）
  - `publicObjectUrl(bucket: string, path: string | null): string | null`
  - `CREATOR_MEDIA_BUCKET = "creator-media"`、`CREATOR_MEDIA_MAX_BYTES`、`type MediaKind = "avatar" | "portfolio"`、`creatorMediaUrl(path: string | null): string | null`、`planMediaUpload(userId: string, kind: MediaKind, file: { type: string; size: number }, id: string): { path: string } | { error: string }`
  - `formatNumber(n: number): string`、`formatTwd(n: number): string`、`formatPercent(n: number | null): string`、`initialOf(name: string): string`
  - `IG_URL_RE`、`isInstagramUrl(v: string): boolean`、`splitTags(raw: string): string[]`、`MAX_PORTFOLIO = 6`、`MAX_PRICE_TWD = 10_000_000`、`type PublicProfileInput`、`validatePublicProfileInput()`、`type PortfolioItemInput = { imagePath: string; linkUrl: string }`、`validatePortfolio()`、`type RateInput = { collabType: string; price: string }`、`validateRates()`（錯誤 key 為 `price:<合作形式>`）
  - `parsePublicProfileForm(fd): PublicProfileInput`、`parsePortfolioForm(fd): PortfolioItemInput[] | null`、`parseRatesForm(fd, collabTypes): RateInput[]`；表單欄位名稱：`avatarPath`、`bio`、`styleTags`、`collabTypes`（多值）、`engagementRate`、`audienceAge`、`items`（JSON）、`price:<合作形式>`
  - `mapAccountError` 新增欄位對應：`bio`、`styleTags`、`collabTypes`、`engagementRate`、`audienceAge`、`avatarPath`、`portfolio`（含 `image_path`、`link_url`）、`rates`（含 `collab_type`、`price_twd`）
  - `resolvePostLoginPath`：任何身分登入後，`next` 是 `/c/<handle>` 時導回該頁
  - `src/lib/creators/view.ts`：`type CreatorStatus`、`type PublicCreator`、`type PublicCreatorRow`、`type PortfolioItem = { imagePath: string; linkUrl: string | null }`、`type Rate = { collabType: string; priceTwd: number }`、`type OwnProfileFields`、`type OwnProfileRow`、`type ViewerKind = "guest" | "brand" | "creator"`、`toPublicCreator()`、`toOwnProfileFields()`、`viewerKindOf()`、`sortRatesByTypes()`

- [ ] **Step 1: 寫失敗的測試**

`src/lib/format.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { formatNumber, formatPercent, formatTwd, initialOf } from "./format";

describe("format", () => {
  it("千分位與新台幣", () => {
    expect(formatNumber(12000)).toBe("12,000");
    expect(formatNumber(0)).toBe("0");
    expect(formatTwd(4500)).toBe("NT$4,500");
    expect(formatTwd(10_000_000)).toBe("NT$10,000,000");
  });
  it("互動率：沒填顯示 —，最多兩位小數", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(3.5)).toBe("3.5%");
    expect(formatPercent(3.456)).toBe("3.46%");
    expect(formatPercent(0)).toBe("0%");
  });
  it("名字第一個字（以 code point 計算）", () => {
    expect(initialOf("小美")).toBe("小");
    expect(initialOf(" Mei")).toBe("M");
    expect(initialOf("😀小美")).toBe("😀");
    expect(initialOf("")).toBe("?");
  });
});
```

`src/lib/creator-media.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { CREATOR_MEDIA_MAX_BYTES, creatorMediaUrl, planMediaUpload } from "./creator-media";

afterEach(() => vi.unstubAllEnvs());

describe("planMediaUpload", () => {
  it("產生 <uid>/<kind>-<id>.<副檔名>", () => {
    expect(planMediaUpload("u1", "avatar", { type: "image/png", size: 10 }, "abc")).toEqual({ path: "u1/avatar-abc.png" });
    expect(planMediaUpload("u1", "portfolio", { type: "image/jpeg", size: 10 }, "abc")).toEqual({ path: "u1/portfolio-abc.jpg" });
    expect(planMediaUpload("u1", "portfolio", { type: "image/webp", size: 10 }, "abc")).toEqual({ path: "u1/portfolio-abc.webp" });
  });
  it("只接受 JPG、PNG、WebP（原型鏈上的名稱也不行）", () => {
    expect(planMediaUpload("u1", "avatar", { type: "image/gif", size: 10 }, "abc")).toEqual({ error: "只接受 JPG、PNG、WebP" });
    expect(planMediaUpload("u1", "avatar", { type: "constructor", size: 10 }, "abc")).toEqual({ error: "只接受 JPG、PNG、WebP" });
  });
  it("檔案上限 5MB", () => {
    expect(planMediaUpload("u1", "avatar", { type: "image/png", size: CREATOR_MEDIA_MAX_BYTES }, "abc")).toEqual({ path: "u1/avatar-abc.png" });
    expect(planMediaUpload("u1", "avatar", { type: "image/png", size: CREATOR_MEDIA_MAX_BYTES + 1 }, "abc")).toEqual({ error: "檔案不能超過 5MB" });
  });
});

describe("creatorMediaUrl", () => {
  it("組出 creator-media 的公開網址", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    expect(creatorMediaUrl("u1/avatar-a.png")).toBe("http://127.0.0.1:54321/storage/v1/object/public/creator-media/u1/avatar-a.png");
    expect(creatorMediaUrl(null)).toBeNull();
  });
});
```

`src/lib/validation/creator-profile.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import {
  isInstagramUrl, splitTags, validatePortfolio, validatePublicProfileInput, validateRates, type PublicProfileInput,
} from "./creator-profile";

const ok: PublicProfileInput = {
  bio: "日常穿搭分享", styleTags: ["日系", "簡約"], collabTypes: ["IG 貼文", "Reels"],
  engagementRate: "3.5", audienceAge: "18-24", avatarPath: null,
};

describe("isInstagramUrl（與資料庫 check_instagram_url 相同規則）", () => {
  it.each([
    "https://www.instagram.com/p/ABC123/",
    "https://instagram.com/reel/xyz?igsh=abc",
  ])("%s 可以", (u) => expect(isInstagramUrl(u)).toBe(true));
  it.each([
    "http://instagram.com/p/1",
    "https://instagram.com.evil.com/p/1",
    "https://evil.com/instagram.com/p/1",
    "https://www.instagram.com/",
    "https://www.instagram.com/p/a b",
    "https://www.instagram.com/p/‮1",
    `https://www.instagram.com/${"a".repeat(300)}`,
  ])("%s 不行", (u) => expect(isInstagramUrl(u)).toBe(false));
});

describe("splitTags", () => {
  it("半形、全形逗號與頓號都可以分隔，空白項目去掉", () => {
    expect(splitTags(" 日系, 簡約，可愛、 ,")).toEqual(["日系", "簡約", "可愛"]);
    expect(splitTags("")).toEqual([]);
  });
});

describe("validatePublicProfileInput", () => {
  it("正確資料沒有錯誤；全部留空也可以", () => {
    expect(validatePublicProfileInput(ok)).toBeNull();
    expect(validatePublicProfileInput({
      bio: "", styleTags: [], collabTypes: [], engagementRate: "", audienceAge: "", avatarPath: null,
    })).toBeNull();
  });
  it("自我介紹最多 300 字、不可含雙向控制字元", () => {
    expect(validatePublicProfileInput({ ...ok, bio: "長".repeat(301) })?.bio).toBe("自我介紹最多 300 字");
    expect(validatePublicProfileInput({ ...ok, bio: "小‮美" })?.bio).toBe("含有不允許的特殊字元");
  });
  it("風格標籤：最多 8 個、每個 12 字、不可重複", () => {
    const msg = "最多 8 個標籤，每個 12 字以內，不可重複";
    expect(validatePublicProfileInput({ ...ok, styleTags: ["a", "b", "c", "d", "e", "f", "g", "h", "i"] })?.styleTags).toBe(msg);
    expect(validatePublicProfileInput({ ...ok, styleTags: ["長".repeat(13)] })?.styleTags).toBe(msg);
    expect(validatePublicProfileInput({ ...ok, styleTags: ["日系", "日系"] })?.styleTags).toBe(msg);
  });
  it("想接的合作：最多 6 個、每個 20 字", () => {
    expect(validatePublicProfileInput({ ...ok, collabTypes: ["a", "b", "c", "d", "e", "f", "g"] })?.collabTypes)
      .toBe("請重新選擇想接的合作");
  });
  it("互動率：0–100，最多兩位小數", () => {
    for (const v of ["0", "3.5", "100", "99.99"]) expect(validatePublicProfileInput({ ...ok, engagementRate: v })).toBeNull();
    for (const v of ["101", "-1", "3.555", "abc", "1e2"]) {
      expect(validatePublicProfileInput({ ...ok, engagementRate: v })?.engagementRate).toBe("請填 0–100 的數字（最多兩位小數）");
    }
  });
  it("受眾年齡最多 10 字", () => {
    expect(validatePublicProfileInput({ ...ok, audienceAge: "1".repeat(11) })?.audienceAge).toBe("請重新選擇受眾年齡");
  });
});

describe("validatePortfolio", () => {
  const item = { imagePath: "u1/portfolio-a.jpg", linkUrl: "" };
  it("正確資料沒有錯誤", () => {
    expect(validatePortfolio([item, { ...item, linkUrl: "https://www.instagram.com/p/1/" }])).toBeNull();
    expect(validatePortfolio([])).toBeNull();
  });
  it("最多 6 張", () => {
    expect(validatePortfolio(Array(7).fill(item))?.portfolio).toBe("最多 6 張作品");
  });
  it("連結錯誤時指出第幾張", () => {
    expect(validatePortfolio([item, { ...item, linkUrl: "https://evil.com/p/1" }])?.portfolio)
      .toBe("第 2 張的連結必須是 https://www.instagram.com/ 開頭的網址");
  });
  it("圖片路徑不可為空", () => {
    expect(validatePortfolio([{ imagePath: "", linkUrl: "" }])?.portfolio).toBe("有作品還沒上傳完成");
  });
});

describe("validateRates", () => {
  it("0 到 10,000,000 的整數", () => {
    expect(validateRates([{ collabType: "IG 貼文", price: "4500" }, { collabType: "Reels", price: "0" }])).toBeNull();
    expect(validateRates([{ collabType: "Reels", price: "10000000" }])).toBeNull();
  });
  it("錯誤以 price:<合作形式> 為 key", () => {
    const msg = "請填 0 到 10,000,000 的整數";
    expect(validateRates([{ collabType: "Reels", price: "-1" }])).toEqual({ "price:Reels": msg });
    expect(validateRates([{ collabType: "Reels", price: "1.5" }])).toEqual({ "price:Reels": msg });
    expect(validateRates([{ collabType: "Reels", price: "10000001" }])).toEqual({ "price:Reels": msg });
  });
});
```

`src/lib/creators/view.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { sortRatesByTypes, toOwnProfileFields, toPublicCreator, viewerKindOf, type PublicCreatorRow } from "./view";

const row: PublicCreatorRow = {
  user_id: "u1", handle: "mei", display_name: "小美", avatar_path: null, region: "台北市",
  categories: ["美妝"], follower_count: 12000, engagement_rate: "3.50", audience_age: null,
  style_tags: null, collab_types: ["IG 貼文"], bio: null, status: "approved", is_self: false,
};

describe("toPublicCreator", () => {
  it("轉成駝峰欄位；numeric 字串轉數字；null 陣列變空陣列", () => {
    expect(toPublicCreator(row)).toEqual({
      userId: "u1", handle: "mei", displayName: "小美", avatarPath: null, region: "台北市",
      categories: ["美妝"], followerCount: 12000, engagementRate: 3.5, audienceAge: null,
      styleTags: [], collabTypes: ["IG 貼文"], bio: null, status: "approved", isSelf: false,
    });
  });
  it("未知的狀態當成 pending；is_self 只有 true 才算本人", () => {
    expect(toPublicCreator({ ...row, status: "weird", is_self: null })).toMatchObject({ status: "pending", isSelf: false });
    expect(toPublicCreator({ ...row, engagement_rate: null }).engagementRate).toBeNull();
  });
});

describe("toOwnProfileFields", () => {
  it("null 變成表單預設值", () => {
    expect(toOwnProfileFields({
      bio: null, style_tags: null, collab_types: ["Reels"], engagement_rate: 2, audience_age: null, avatar_path: null,
    })).toEqual({ bio: "", styleTags: [], collabTypes: ["Reels"], engagementRate: 2, audienceAge: "", avatarPath: null });
  });
});

describe("viewerKindOf", () => {
  it("品牌、創作者，其他都是訪客", () => {
    expect(viewerKindOf("brand")).toBe("brand");
    expect(viewerKindOf("creator")).toBe("creator");
    expect(viewerKindOf(null)).toBe("guest");
    expect(viewerKindOf(undefined)).toBe("guest");
  });
});

describe("sortRatesByTypes", () => {
  it("依想接的合作順序排列，不在清單的排最後", () => {
    const rates = [
      { collabType: "產品互惠", priceTwd: 0 },
      { collabType: "IG 貼文", priceTwd: 4500 },
      { collabType: "Reels", priceTwd: 8000 },
    ];
    expect(sortRatesByTypes(rates, ["Reels", "IG 貼文"]).map((r) => r.collabType)).toEqual(["Reels", "IG 貼文", "產品互惠"]);
  });
});
```

在 `src/lib/validation/form-data.test.ts` 最後加上：

```ts
import { parsePortfolioForm, parsePublicProfileForm, parseRatesForm } from "./form-data";

describe("parsePublicProfileForm", () => {
  it("清理文字、拆標籤、多值合作形式、去掉互動率的 %", () => {
    expect(parsePublicProfileForm(fd([
      ["bio", " 日常穿搭\n分享　"], ["styleTags", "日系，簡約、"], ["collabTypes", "IG 貼文"], ["collabTypes", "Reels"],
      ["engagementRate", " 3.5% "], ["audienceAge", "18-24"], ["avatarPath", " "],
    ]))).toEqual({
      bio: "日常穿搭\n分享", styleTags: ["日系", "簡約"], collabTypes: ["IG 貼文", "Reels"],
      engagementRate: "3.5", audienceAge: "18-24", avatarPath: null,
    });
  });
});

describe("parsePortfolioForm", () => {
  it("解析 items JSON；欄位不是字串時變成空字串", () => {
    expect(parsePortfolioForm(fd([["items", JSON.stringify([
      { imagePath: " u1/portfolio-a.jpg ", linkUrl: "https://www.instagram.com/p/1/" },
      { imagePath: 1, linkUrl: null },
    ])]]))).toEqual([
      { imagePath: "u1/portfolio-a.jpg", linkUrl: "https://www.instagram.com/p/1/" },
      { imagePath: "", linkUrl: "" },
    ]);
  });
  it("不是 JSON 陣列時回傳 null", () => {
    expect(parsePortfolioForm(fd([["items", "{"]]))).toBeNull();
    expect(parsePortfolioForm(fd([["items", "{}"]]))).toBeNull();
    expect(parsePortfolioForm(fd([]))).toBeNull();
  });
});

describe("parseRatesForm", () => {
  it("只讀清單內的合作形式；去掉千分位與空白；空白代表不提供", () => {
    expect(parseRatesForm(fd([
      ["price:IG 貼文", " 4,500 "], ["price:Reels", ""], ["price:限時動態", "100"],
    ]), ["IG 貼文", "Reels"])).toEqual([{ collabType: "IG 貼文", price: "4500" }]);
  });
});
```

（`fd()` 是這個測試檔原本就有的輔助函式；`import` 放到檔案最上方與原本的 import 合併。）

在 `src/lib/auth/account-errors.test.ts` 的 `describe` 內加上：

```ts
  it("公開頁欄位錯誤對應到表單欄位", () => {
    const cases: [string, string][] = [
      ["invalid bio", "bio"], ["invalid style_tags", "styleTags"], ["invalid collab_types", "collabTypes"],
      ["invalid engagement_rate", "engagementRate"], ["invalid audience_age", "audienceAge"],
      ["invalid avatar_path", "avatarPath"], ["invalid portfolio", "portfolio"], ["invalid image_path", "portfolio"],
      ["invalid link_url", "portfolio"], ["invalid rates", "rates"], ["invalid collab_type", "rates"],
      ["invalid price_twd", "rates"],
    ];
    for (const [message, field] of cases) {
      expect(mapAccountError({ code: "22023", message })).toEqual({
        kind: "state", state: { fieldErrors: { [field]: "格式不正確" } },
      });
    }
  });
```

在 `src/lib/auth/post-login.test.ts` 的 `describe("resolvePostLoginPath")` 內加上：

```ts
  it("任何身分登入後都可以回到創作者公開頁", () => {
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: "/c/mei.daily" })).toBe("/c/mei.daily");
    expect(resolvePostLoginPath({ role: "creator", requestedRole: null, next: "/c/mei" })).toBe("/c/mei");
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: "/c/mei/x" })).toBe("/brand");
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: "/c/" })).toBe("/brand");
    expect(resolvePostLoginPath({ role: "brand", requestedRole: null, next: "/c/Bad" })).toBe("/brand");
  });
```

- [ ] **Step 2: 確認失敗**

```bash
npm test
```
Expected: FAIL，新的測試檔找不到 `./format`、`./creator-media`、`./creator-profile`、`./view`；form-data、account-errors、post-login 新測試失敗。

- [ ] **Step 3: 實作**

`src/lib/options.ts` 最後加上：

```ts
// 想接的合作、受眾年齡：白名單只在 UI 端強制（資料庫只檢查數量與長度）
export const COLLAB_TYPES = ["IG 貼文", "Reels", "限時動態", "產品互惠"] as const;
export const AUDIENCE_AGES = ["13-17", "18-24", "25-34", "35-44", "45+"] as const;
```

`src/lib/storage-url.ts`：

```ts
/** 資料庫只存 Storage 路徑（<user_id>/<檔名>）；顯示與預覽時才組成公開 bucket 的網址。 */
export function publicObjectUrl(bucket: string, path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${encoded}`;
}
```

`src/lib/brand-logo.ts` 整個換成：

```ts
import { publicObjectUrl } from "./storage-url";

/** 資料庫只存 Logo 的 Storage 路徑（<user_id>/<檔名>）；顯示與預覽時才組成公開網址。 */
export function brandLogoUrl(path: string | null): string | null {
  return publicObjectUrl("brand-logos", path);
}
```

`src/lib/creator-media.ts`：

```ts
import { publicObjectUrl } from "./storage-url";

export const CREATOR_MEDIA_BUCKET = "creator-media";
export const CREATOR_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type MediaKind = "avatar" | "portfolio";

export function creatorMediaUrl(path: string | null): string | null {
  return publicObjectUrl(CREATOR_MEDIA_BUCKET, path);
}

/**
 * 上傳前檢查檔案並產生路徑 <userId>/<kind>-<id>.<副檔名>。
 * 規則與 storage policy、資料庫的 check_media_path 一致（id 用 crypto.randomUUID()）。
 */
export function planMediaUpload(
  userId: string, kind: MediaKind, file: { type: string; size: number }, id: string,
): { path: string } | { error: string } {
  if (!Object.hasOwn(EXT_BY_TYPE, file.type)) return { error: "只接受 JPG、PNG、WebP" };
  if (file.size > CREATOR_MEDIA_MAX_BYTES) return { error: "檔案不能超過 5MB" };
  return { path: `${userId}/${kind}-${id}.${EXT_BY_TYPE[file.type]}` };
}
```

`src/lib/format.ts`：

```ts
const nf = new Intl.NumberFormat("en-US");

export function formatNumber(n: number): string {
  return nf.format(n);
}

export function formatTwd(n: number): string {
  return `NT$${nf.format(n)}`;
}

/** 互動率；沒填顯示「—」。 */
export function formatPercent(n: number | null): string {
  return n === null ? "—" : `${Number(n.toFixed(2))}%`;
}

/** 頭像沒上傳時顯示名字第一個字（以 code point 計算，避免拆壞 emoji）。 */
export function initialOf(name: string): string {
  return Array.from(name.trim())[0] ?? "?";
}
```

`src/lib/validation/creator-profile.ts`：

```ts
// 規則與 supabase/migrations/20261124000200_creator_public_profile.sql 一致；資料庫是最後防線。
import { cleanText, hasBidi } from "./onboarding";

export const IG_URL_RE = /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._~%/?=&+-]+$/;
export const MAX_PORTFOLIO = 6;
export const MAX_PRICE_TWD = 10_000_000;
const BAD_CHAR_MESSAGE = "含有不允許的特殊字元";

/** 字數（與 Postgres char_length 一致，以 code point 計算）。 */
function len(v: string): number {
  return [...v].length;
}

function hasDuplicates(list: string[]): boolean {
  return new Set(list).size !== list.length;
}

export function isInstagramUrl(v: string): boolean {
  if (len(v) > 300 || hasBidi(v) || !IG_URL_RE.test(v)) return false;
  try {
    return new URL(v).hostname.replace(/^www\./, "") === "instagram.com";
  } catch {
    return false;
  }
}

/** 風格標籤輸入框：用半形逗號、全形逗號或頓號分隔，逐項清理並去掉空白項目。 */
export function splitTags(raw: string): string[] {
  return raw.split(/[,，、]/).map(cleanText).filter((t) => t.length > 0);
}

export type PublicProfileInput = {
  bio: string;
  styleTags: string[];
  collabTypes: string[];
  engagementRate: string;
  audienceAge: string;
  avatarPath: string | null;
};

export function validatePublicProfileInput(i: PublicProfileInput): Record<string, string> | null {
  const e: Record<string, string> = {};
  if (hasBidi(i.bio)) e.bio = BAD_CHAR_MESSAGE;
  else if (len(i.bio) > 300) e.bio = "自我介紹最多 300 字";
  if (i.styleTags.some(hasBidi)) {
    e.styleTags = BAD_CHAR_MESSAGE;
  } else if (
    i.styleTags.length > 8 || i.styleTags.some((t) => len(t) < 1 || len(t) > 12) || hasDuplicates(i.styleTags)
  ) {
    e.styleTags = "最多 8 個標籤，每個 12 字以內，不可重複";
  }
  if (
    i.collabTypes.length > 6 ||
    i.collabTypes.some((t) => hasBidi(t) || len(t) < 1 || len(t) > 20) ||
    hasDuplicates(i.collabTypes)
  ) {
    e.collabTypes = "請重新選擇想接的合作";
  }
  if (i.engagementRate !== "" && !(/^\d{1,3}(\.\d{1,2})?$/.test(i.engagementRate) && Number(i.engagementRate) <= 100)) {
    e.engagementRate = "請填 0–100 的數字（最多兩位小數）";
  }
  if (hasBidi(i.audienceAge) || len(i.audienceAge) > 10) e.audienceAge = "請重新選擇受眾年齡";
  return Object.keys(e).length ? e : null;
}

export type PortfolioItemInput = { imagePath: string; linkUrl: string };

export function validatePortfolio(items: PortfolioItemInput[]): Record<string, string> | null {
  if (items.length > MAX_PORTFOLIO) return { portfolio: `最多 ${MAX_PORTFOLIO} 張作品` };
  if (items.some((it) => it.imagePath === "")) return { portfolio: "有作品還沒上傳完成" };
  const bad = items.findIndex((it) => it.linkUrl !== "" && !isInstagramUrl(it.linkUrl));
  if (bad >= 0) return { portfolio: `第 ${bad + 1} 張的連結必須是 https://www.instagram.com/ 開頭的網址` };
  return null;
}

export type RateInput = { collabType: string; price: string };

/** 錯誤的 key 是 price:<合作形式>，對應表單欄位名稱。 */
export function validateRates(rates: RateInput[]): Record<string, string> | null {
  const e: Record<string, string> = {};
  for (const r of rates) {
    if (!/^\d{1,8}$/.test(r.price) || Number(r.price) > MAX_PRICE_TWD) {
      e[`price:${r.collabType}`] = "請填 0 到 10,000,000 的整數";
    }
  }
  return Object.keys(e).length ? e : null;
}
```

`src/lib/validation/form-data.ts` 最上方的 import 換成下面兩行，並在檔案最後加上三個函式：

```ts
import { cleanText, normalizeIgUsername, type BrandInput, type CreatorInput } from "./onboarding";
import { splitTags, type PortfolioItemInput, type PublicProfileInput, type RateInput } from "./creator-profile";
```

```ts
function strings(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === "string");
}

export function parsePublicProfileForm(fd: FormData): PublicProfileInput {
  const avatar = cleanText(str(fd, "avatarPath"));
  return {
    bio: cleanText(str(fd, "bio")),
    styleTags: splitTags(str(fd, "styleTags")),
    collabTypes: strings(fd, "collabTypes").map(cleanText),
    engagementRate: cleanText(str(fd, "engagementRate")).replace(/%$/, "").trim(),
    audienceAge: cleanText(str(fd, "audienceAge")),
    avatarPath: avatar || null,
  };
}

/** 作品表單把清單序列化成 JSON 放在隱藏欄位 items；格式不對回傳 null。 */
export function parsePortfolioForm(fd: FormData): PortfolioItemInput[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(str(fd, "items"));
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) return null;
  return raw.map((it: unknown) => {
    const o = (typeof it === "object" && it !== null ? it : {}) as Record<string, unknown>;
    return {
      imagePath: typeof o.imagePath === "string" ? cleanText(o.imagePath) : "",
      linkUrl: typeof o.linkUrl === "string" ? cleanText(o.linkUrl) : "",
    };
  });
}

/** 只讀 collabTypes 內的合作形式（price:<合作形式>）；空白代表不提供這項報價。 */
export function parseRatesForm(fd: FormData, collabTypes: string[]): RateInput[] {
  return collabTypes
    .map((t) => ({ collabType: t, price: cleanText(str(fd, `price:${t}`)).replace(/[,，\s]/g, "") }))
    .filter((r) => r.price !== "");
}
```

`src/lib/auth/account-errors.ts` 的 `FIELD_BY_DB` 換成：

```ts
const FIELD_BY_DB: Record<string, string> = {
  brand_name: "brandName",
  industry: "industry",
  logo_path: "logoPath",
  display_name: "displayName",
  handle: "handle",
  ig_username: "igUsername",
  follower_count: "followerCount",
  region: "region",
  categories: "categories",
  // 公開頁（計畫 3）
  bio: "bio",
  style_tags: "styleTags",
  collab_types: "collabTypes",
  engagement_rate: "engagementRate",
  audience_age: "audienceAge",
  avatar_path: "avatarPath",
  portfolio: "portfolio",
  image_path: "portfolio",
  link_url: "portfolio",
  rates: "rates",
  collab_type: "rates",
  price_twd: "rates",
};
```

`src/lib/auth/post-login.ts`：在 `homeFor` 之前加上常數，並把 `resolvePostLoginPath` 換成：

```ts
/** 創作者公開頁：任何身分登入後都可以回到這裡（例如品牌從報價鎖定區塊登入）。 */
const PUBLIC_PROFILE_RE = /^\/c\/[a-z0-9_.]{3,30}$/;
```

```ts
/** 登入後要去哪裡。規則見 docs/superpowers/specs/2026-11-23-auth-design.md 第 1 節；/c/<handle> 見計畫 3。 */
export function resolvePostLoginPath(a: { role: Role | null; requestedRole: string | null; next: string | null }): string {
  if (!a.role) return isRole(a.requestedRole) ? `/onboarding/${a.requestedRole}` : "/onboarding";
  const home = homeFor(a.role);
  const next = safeNextPath(a.next);
  if (next && PUBLIC_PROFILE_RE.test(next)) return next;
  if (next && (next === home || next.startsWith(`${home}/`) || next.startsWith(`${home}?`))) return next;
  return home;
}
```

`src/lib/creators/view.ts`：

```ts
import type { Role } from "@/lib/auth/post-login";

export type CreatorStatus = "pending" | "approved" | "suspended";
const STATUSES: readonly string[] = ["pending", "approved", "suspended"];

export type PublicCreator = {
  userId: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  region: string | null;
  categories: string[];
  followerCount: number;
  engagementRate: number | null;
  audienceAge: string | null;
  styleTags: string[];
  collabTypes: string[];
  bio: string | null;
  status: CreatorStatus;
  isSelf: boolean;
};

/** get_public_creator 回傳的一列。產生的型別把 RETURNS TABLE 的欄位都標成非 null，實際上可能是 null，所以自己定義。 */
export type PublicCreatorRow = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_path: string | null;
  region: string | null;
  categories: string[] | null;
  follower_count: number;
  engagement_rate: number | string | null;
  audience_age: string | null;
  style_tags: string[] | null;
  collab_types: string[] | null;
  bio: string | null;
  status: string;
  is_self: boolean | null;
};

export type PortfolioItem = { imagePath: string; linkUrl: string | null };
export type Rate = { collabType: string; priceTwd: number };

/** 後台公開頁表單的初始值。 */
export type OwnProfileFields = {
  bio: string;
  styleTags: string[];
  collabTypes: string[];
  engagementRate: number | null;
  audienceAge: string;
  avatarPath: string | null;
};

export type OwnProfileRow = {
  bio: string | null;
  style_tags: string[] | null;
  collab_types: string[] | null;
  engagement_rate: number | string | null;
  audience_age: string | null;
  avatar_path: string | null;
};

export type ViewerKind = "guest" | "brand" | "creator";

function toNumberOrNull(v: number | string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toPublicCreator(r: PublicCreatorRow): PublicCreator {
  return {
    userId: r.user_id,
    handle: r.handle,
    displayName: r.display_name,
    avatarPath: r.avatar_path ?? null,
    region: r.region ?? null,
    categories: r.categories ?? [],
    followerCount: r.follower_count,
    engagementRate: toNumberOrNull(r.engagement_rate),
    audienceAge: r.audience_age ?? null,
    styleTags: r.style_tags ?? [],
    collabTypes: r.collab_types ?? [],
    bio: r.bio ?? null,
    status: STATUSES.includes(r.status) ? (r.status as CreatorStatus) : "pending",
    isSelf: r.is_self === true,
  };
}

export function toOwnProfileFields(r: OwnProfileRow): OwnProfileFields {
  return {
    bio: r.bio ?? "",
    styleTags: r.style_tags ?? [],
    collabTypes: r.collab_types ?? [],
    engagementRate: toNumberOrNull(r.engagement_rate),
    audienceAge: r.audience_age ?? "",
    avatarPath: r.avatar_path ?? null,
  };
}

/** 瀏覽公開頁的人：品牌、創作者（含本人），其他（未登入、還沒建立帳號）都是訪客。 */
export function viewerKindOf(role: Role | null | undefined): ViewerKind {
  if (role === "brand") return "brand";
  if (role === "creator") return "creator";
  return "guest";
}

/** 報價依創作者勾選「想接的合作」的順序排列；不在清單內的排最後。 */
export function sortRatesByTypes(rates: Rate[], collabTypes: string[]): Rate[] {
  const order = (t: string) => {
    const i = collabTypes.indexOf(t);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...rates].sort((a, b) => order(a.collabType) - order(b.collabType) || a.collabType.localeCompare(b.collabType));
}
```

- [ ] **Step 4: 確認通過**

```bash
npm run lint && npm run typecheck && npm test
```
Expected: 全部通過（既有的 `brand-logo.test.ts` 也要通過，確認重構沒有改變行為）。

- [ ] **Step 5: Commit**

```bash
git add src/lib
git commit -m "計畫 3 Task 3：公開頁選項、格式化、圖片路徑、表單驗證與解析、錯誤對應、登入後導回公開頁"
```

---

### Task 4: 伺服器端讀取：公開頁、後台自己的資料、訪客 client

**Files:**
- Create: `src/lib/supabase/anon.ts`、`src/lib/creators/public-profile.ts`、`src/lib/creators/public-profile.test.ts`、`src/lib/creators/own-profile.ts`、`src/lib/creators/own-profile.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `get_public_creator`、`creator_portfolio_items`、`creator_rates` RLS；Task 3 的 `toPublicCreator`、`toOwnProfileFields`、`sortRatesByTypes`、型別；`createClient()`（`src/lib/supabase/server.ts`）；`HANDLE_RE`。
- Produces:
  - `createAnonClient()`：不帶 session 的 Supabase client（server-only）
  - `loadPublicCreator(handle: string): Promise<PublicCreator | null>`：以目前使用者身分查詢（本人可以看到自己未審核的資料），以 React `cache` 包起來，同一個請求內 `generateMetadata` 與頁面共用。讀 cookie，只能在 `<Suspense>` 內或 `generateMetadata` 呼叫。
  - `loadApprovedCreatorAsGuest(handle: string): Promise<PublicCreator | null>`：以訪客身分查詢（只會拿到已審核的），OG 圖片用。
  - `loadPortfolio(creatorId: string): Promise<PortfolioItem[]>`（依 position 排序，受 RLS 限制）
  - `loadRates(creatorId: string, collabTypes: string[]): Promise<Rate[]>`（受 RLS 限制：只有品牌與本人看得到）
  - `loadOwnPublicProfile(userId: string): Promise<{ profile: OwnProfileFields; portfolio: PortfolioItem[]; rates: Rate[] }>`

- [ ] **Step 1: 寫失敗的測試**

`src/lib/creators/public-profile.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from, anonRpc } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), anonRpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from }) }));
vi.mock("@/lib/supabase/anon", () => ({ createAnonClient: () => ({ rpc: anonRpc }) }));

import { loadApprovedCreatorAsGuest, loadPortfolio, loadPublicCreator, loadRates } from "./public-profile";

/** 模擬 supabase-js 的鏈式查詢：每個方法回傳自己，await 時得到 result。 */
function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "maybeSingle", "single"]) q[m] = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

const row = {
  user_id: "u1", handle: "mei", display_name: "小美", avatar_path: null, region: "台北市", categories: ["美妝"],
  follower_count: 12000, engagement_rate: 3.5, audience_age: null, style_tags: [], collab_types: ["Reels", "IG 貼文"],
  bio: null, status: "approved", is_self: false,
};

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  anonRpc.mockReset();
});

describe("loadPublicCreator", () => {
  it("handle 格式不對時不查資料庫", async () => {
    expect(await loadPublicCreator("Bad Handle")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("查到時轉成 PublicCreator", async () => {
    rpc.mockReturnValue(chain({ data: row, error: null }));
    expect(await loadPublicCreator("mei")).toMatchObject({ userId: "u1", displayName: "小美", status: "approved", isSelf: false });
    expect(rpc).toHaveBeenCalledWith("get_public_creator", { p_handle: "mei" });
  });
  it("查不到回傳 null", async () => {
    rpc.mockReturnValue(chain({ data: null, error: null }));
    expect(await loadPublicCreator("nobody")).toBeNull();
  });
  it("資料庫錯誤時丟出", async () => {
    rpc.mockReturnValue(chain({ data: null, error: { message: "boom" } }));
    await expect(loadPublicCreator("mei")).rejects.toEqual({ message: "boom" });
  });
});

describe("loadApprovedCreatorAsGuest", () => {
  it("用訪客 client 查詢，不用使用者的 session", async () => {
    anonRpc.mockReturnValue(chain({ data: row, error: null }));
    expect(await loadApprovedCreatorAsGuest("mei")).toMatchObject({ handle: "mei" });
    expect(anonRpc).toHaveBeenCalledWith("get_public_creator", { p_handle: "mei" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("handle 格式不對時不查資料庫", async () => {
    expect(await loadApprovedCreatorAsGuest("../x")).toBeNull();
    expect(anonRpc).not.toHaveBeenCalled();
  });
});

describe("loadPortfolio", () => {
  it("依 position 排序並轉換欄位", async () => {
    const q = chain({ data: [{ image_path: "u1/portfolio-a.jpg", link_url: null }], error: null });
    from.mockReturnValue(q);
    expect(await loadPortfolio("u1")).toEqual([{ imagePath: "u1/portfolio-a.jpg", linkUrl: null }]);
    expect(from).toHaveBeenCalledWith("creator_portfolio_items");
    expect(q.eq).toHaveBeenCalledWith("creator_id", "u1");
    expect(q.order).toHaveBeenCalledWith("position");
  });
});

describe("loadRates", () => {
  it("依想接的合作順序排列", async () => {
    from.mockReturnValue(chain({
      data: [{ collab_type: "IG 貼文", price_twd: 4500 }, { collab_type: "Reels", price_twd: 8000 }], error: null,
    }));
    expect(await loadRates("u1", ["Reels", "IG 貼文"])).toEqual([
      { collabType: "Reels", priceTwd: 8000 }, { collabType: "IG 貼文", priceTwd: 4500 },
    ]);
    expect(from).toHaveBeenCalledWith("creator_rates");
  });
});
```

`src/lib/creators/own-profile.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from }) }));

import { loadOwnPublicProfile } from "./own-profile";

function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "maybeSingle", "single"]) q[m] = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

beforeEach(() => from.mockReset());

describe("loadOwnPublicProfile", () => {
  it("合併檔案、作品與報價", async () => {
    const results: Record<string, unknown> = {
      creator_profiles: { data: {
        bio: null, style_tags: ["日系"], collab_types: ["IG 貼文", "Reels"], engagement_rate: 3.5,
        audience_age: "18-24", avatar_path: null,
      }, error: null },
      creator_portfolio_items: { data: [{ image_path: "u1/portfolio-a.jpg", link_url: "https://www.instagram.com/p/1/" }], error: null },
      creator_rates: { data: [{ collab_type: "Reels", price_twd: 8000 }, { collab_type: "IG 貼文", price_twd: 4500 }], error: null },
    };
    from.mockImplementation((table: string) => chain(results[table]));
    expect(await loadOwnPublicProfile("u1")).toEqual({
      profile: { bio: "", styleTags: ["日系"], collabTypes: ["IG 貼文", "Reels"], engagementRate: 3.5, audienceAge: "18-24", avatarPath: null },
      portfolio: [{ imagePath: "u1/portfolio-a.jpg", linkUrl: "https://www.instagram.com/p/1/" }],
      rates: [{ collabType: "IG 貼文", priceTwd: 4500 }, { collabType: "Reels", priceTwd: 8000 }],
    });
  });
  it("任何一個查詢失敗就丟出", async () => {
    from.mockImplementation((table: string) =>
      chain(table === "creator_rates" ? { data: null, error: { message: "boom" } } : { data: [], error: null }));
    await expect(loadOwnPublicProfile("u1")).rejects.toEqual({ message: "boom" });
  });
});
```

- [ ] **Step 2: 確認失敗**

```bash
npm test -- src/lib/creators
```
Expected: FAIL，找不到 `./public-profile`、`./own-profile`。

- [ ] **Step 3: 實作**

`src/lib/supabase/anon.ts`：

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import type { Database } from "./database.types";

/** 不帶使用者 session 的訪客 client（不讀 cookie）。RLS 與 definer 函式都把它當成 anon。 */
export function createAnonClient() {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
```

`src/lib/creators/public-profile.ts`：

```ts
import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { HANDLE_RE } from "@/lib/validation/onboarding";
import {
  sortRatesByTypes, toPublicCreator, type PortfolioItem, type PublicCreator, type PublicCreatorRow, type Rate,
} from "./view";

/**
 * 以目前使用者身分讀公開頁：已審核的給所有人，未審核的只有本人讀得到。
 * 會讀 cookie，只能在 <Suspense> 內或 generateMetadata 呼叫。不快取（理由見計畫 3「快取決定」）。
 */
export const loadPublicCreator = cache(async (handle: string): Promise<PublicCreator | null> => {
  if (!HANDLE_RE.test(handle)) return null;
  // 結果依每次請求而異：先等請求進來再建立 client（auth-js 會讀 Date.now()）
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_creator", { p_handle: handle }).maybeSingle();
  if (error) throw error;
  return data ? toPublicCreator(data as PublicCreatorRow) : null;
});

/** 以訪客身分讀公開頁（只會拿到已審核的創作者）。OG 圖片用，不讀 cookie。 */
export async function loadApprovedCreatorAsGuest(handle: string): Promise<PublicCreator | null> {
  if (!HANDLE_RE.test(handle)) return null;
  await connection();
  const { data, error } = await createAnonClient().rpc("get_public_creator", { p_handle: handle }).maybeSingle();
  if (error) throw error;
  return data ? toPublicCreator(data as PublicCreatorRow) : null;
}

export async function loadPortfolio(creatorId: string): Promise<PortfolioItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_portfolio_items").select("image_path, link_url").eq("creator_id", creatorId).order("position");
  if (error) throw error;
  return (data ?? []).map((r) => ({ imagePath: r.image_path, linkUrl: r.link_url }));
}

/** 報價受 RLS 限制：只有品牌（已審核的創作者）與本人讀得到，其他人得到空陣列。 */
export async function loadRates(creatorId: string, collabTypes: string[]): Promise<Rate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("creator_rates").select("collab_type, price_twd").eq("creator_id", creatorId);
  if (error) throw error;
  return sortRatesByTypes((data ?? []).map((r) => ({ collabType: r.collab_type, priceTwd: r.price_twd })), collabTypes);
}
```

`src/lib/creators/own-profile.ts`：

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { sortRatesByTypes, toOwnProfileFields, type OwnProfileFields, type PortfolioItem, type Rate } from "./view";

export type OwnPublicProfile = { profile: OwnProfileFields; portfolio: PortfolioItem[]; rates: Rate[] };

/** 創作者後台讀自己的公開頁資料（使用者自己的 client；呼叫前先 requireRole("creator")）。 */
export async function loadOwnPublicProfile(userId: string): Promise<OwnPublicProfile> {
  const supabase = await createClient();
  const [p, items, rates] = await Promise.all([
    supabase.from("creator_profiles")
      .select("bio, style_tags, collab_types, engagement_rate, audience_age, avatar_path")
      .eq("user_id", userId).single(),
    supabase.from("creator_portfolio_items").select("image_path, link_url").eq("creator_id", userId).order("position"),
    supabase.from("creator_rates").select("collab_type, price_twd").eq("creator_id", userId),
  ]);
  if (p.error) throw p.error;
  if (items.error) throw items.error;
  if (rates.error) throw rates.error;
  const profile = toOwnProfileFields(p.data);
  return {
    profile,
    portfolio: (items.data ?? []).map((r) => ({ imagePath: r.image_path, linkUrl: r.link_url })),
    rates: sortRatesByTypes(
      (rates.data ?? []).map((r) => ({ collabType: r.collab_type, priceTwd: r.price_twd })), profile.collabTypes,
    ),
  };
}
```

- [ ] **Step 4: 確認通過**

```bash
npm run lint && npm run typecheck && npm test
```
Expected: 全部通過。

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/anon.ts src/lib/creators
git commit -m "計畫 3 Task 4：公開頁與後台的伺服器端讀取、訪客 client"
```

---

### Task 5: 公開頁 `/c/[handle]`

**Files:**
- Create: `src/app/c/layout.tsx`、`src/app/c/[handle]/page.tsx`、`src/app/c/[handle]/ProfileView.tsx`、`src/app/c/[handle]/not-found.tsx`

**Interfaces:**
- Consumes: Task 4 的 `loadPublicCreator`、`loadPortfolio`、`loadRates`；Task 3 的 `viewerKindOf`、`creatorMediaUrl`、`formatNumber`、`formatPercent`、`formatTwd`、`initialOf`、型別；`getCurrentUser()`、`homeFor()`。
- Produces: 路由 `/c/<handle>`。頁面文字（Task 9 的驗收會找這些字）：「審核通過後才會公開」、「新創作者・尚無評價」、「品牌登入後可查看報價」、「尚未提供報價，可以直接邀請洽談」、「還沒有完成的合作」、「邀請合作」、「邀請合作（即將推出）」、「找不到這位創作者」。報價鎖定區塊連到 `/login?next=%2Fc%2F<handle>`；訪客的邀請按鈕連到 `/signup?role=brand`。

版面規則（spec「頁面內容」）：手機一欄；`md` 以上兩欄，左欄 = 頭像與名稱卡、數據卡、風格標籤；右欄 = 邀請合作（`md:sticky md:top-4`）、作品、想接的合作、報價、合作過的品牌。邀請按鈕在手機固定在底部。風格標籤與作品沒有資料時整個區塊不顯示；想接的合作沒有資料時顯示「尚未設定」。spec 沒指定自我介紹的位置，放在名稱卡最下方。

- [ ] **Step 1: 種一筆本機測試資料（只在本機資料庫，Task 9 結束時清掉）**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres <<'SQL'
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000c0de', 'p3-seed@test.local') on conflict do nothing;
insert into public.profiles (id, role, display_name) values ('00000000-0000-0000-0000-00000000c0de', 'creator', '測試小美') on conflict do nothing;
insert into public.creator_profiles (user_id, handle, ig_username, follower_count, region, categories, status,
  collab_types, style_tags, engagement_rate, audience_age, bio)
values ('00000000-0000-0000-0000-00000000c0de', 'p3seed', 'p3seed', 12000, '台北市', array['美妝', '穿搭'], 'approved',
  array['IG 貼文', 'Reels'], array['日系', '簡約'], 3.5, '18-24', '日常穿搭分享') on conflict do nothing;
insert into public.creator_rates (creator_id, collab_type, price_twd) values
  ('00000000-0000-0000-0000-00000000c0de', 'IG 貼文', 4500),
  ('00000000-0000-0000-0000-00000000c0de', 'Reels', 8000) on conflict do nothing;
SQL
```
Expected: 每行 `INSERT 0 1`（重跑時 `INSERT 0 0`）。

- [ ] **Step 2: 確認目前沒有這個頁面**

```bash
npm run dev
```
另開一個終端機：
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/c/p3seed
```
Expected: `404`（路由還不存在）。

- [ ] **Step 3: 公開頁外框 `src/app/c/layout.tsx`**

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { SITE_NAME } from "@/lib/site";
import { getCurrentUser } from "@/lib/auth/current-user";
import { homeFor } from "@/lib/auth/post-login";

/** 公開頁外框：不套登入後的側邊導覽，只有簡單的頂列。 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-ink">{SITE_NAME}</Link>
        <Suspense fallback={null}>
          <TopBarLink />
        </Suspense>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12">{children}</main>
    </div>
  );
}

/** 會讀 session，所以放在 <Suspense> 內。 */
async function TopBarLink() {
  const me = await getCurrentUser();
  const cls = "inline-flex h-9 items-center rounded-btn border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-primary-soft";
  if (!me) return <Link href="/login" className={cls}>登入</Link>;
  return <Link href={me.profile ? homeFor(me.profile.role) : "/onboarding"} className={cls}>回後台</Link>;
}
```

- [ ] **Step 4: 版面 `src/app/c/[handle]/ProfileView.tsx`**

```tsx
import Link from "next/link";
import { ExternalLink, Lock, MapPin, Star } from "lucide-react";
import { creatorMediaUrl } from "@/lib/creator-media";
import { formatNumber, formatPercent, formatTwd, initialOf } from "@/lib/format";
import type { CreatorStatus, PortfolioItem, PublicCreator, Rate, ViewerKind } from "@/lib/creators/view";

const card = "rounded-card border border-line bg-surface p-5 md:p-8";

type Props = { creator: PublicCreator; portfolio: PortfolioItem[]; rates: Rate[]; viewer: ViewerKind };

export function ProfileView({ creator: c, portfolio, rates, viewer }: Props) {
  return (
    <div className="pt-2 md:pt-6">
      {c.isSelf && c.status !== "approved" && <SelfPreviewBanner status={c.status} />}
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
        <div className="space-y-4 md:space-y-6">
          <HeaderCard c={c} />
          <StatsCard c={c} />
          {c.styleTags.length > 0 && (
            <Section title="風格"><Chips label="風格標籤" items={c.styleTags} /></Section>
          )}
        </div>
        <div className="space-y-4 md:space-y-6">
          <Invite viewer={viewer} />
          {portfolio.length > 0 && <PortfolioGrid name={c.displayName} items={portfolio} />}
          <Section title="想接的合作">
            {c.collabTypes.length > 0
              ? <Chips label="想接的合作" items={c.collabTypes} />
              : <p className="text-sm text-muted">尚未設定</p>}
          </Section>
          <RatesSection viewer={viewer} handle={c.handle} rates={rates} />
          <Section title="合作過的品牌">
            <p className="text-sm text-muted">還沒有完成的合作</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function SelfPreviewBanner({ status }: { status: CreatorStatus }) {
  return (
    <div role="status" className="mb-4 rounded-card border border-line bg-surface p-4 text-sm text-ink md:mb-6">
      <b>{status === "suspended" ? "帳號已暫停，公開頁目前不會顯示給其他人。" : "審核通過後才會公開。"}</b>
      <span className="text-muted"> 這是只有你看得到的預覽。</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={card}>
      <h2 className="text-base font-bold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Chips({ label, items, dark }: { label: string; items: string[]; dark?: boolean }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {items.map((t) => (
        <li key={t} className={`rounded-btn px-3 py-1 text-sm ${dark ? "bg-ink font-medium text-on-ink" : "bg-primary-soft text-ink"}`}>{t}</li>
      ))}
    </ul>
  );
}

function HeaderCard({ c }: { c: PublicCreator }) {
  const avatar = creatorMediaUrl(c.avatarPath);
  return (
    <section className={card}>
      <div className="flex items-center gap-4">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-20 w-20 shrink-0 rounded-full border border-line object-cover" />
        ) : (
          <div aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-ink text-3xl font-semibold text-on-ink">
            {initialOf(c.displayName)}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold text-ink md:text-[32px]">{c.displayName}</h1>
          <p className="text-sm text-muted">@{c.handle}</p>
          {c.region && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted">
              <MapPin size={14} strokeWidth={1.5} aria-hidden="true" />{c.region}
            </p>
          )}
        </div>
      </div>
      {c.categories.length > 0 && <div className="mt-4"><Chips label="內容領域" items={c.categories} dark /></div>}
      <p className="mt-4 flex items-center gap-1 text-sm text-muted">
        <Star size={14} strokeWidth={1.5} aria-hidden="true" />新創作者・尚無評價
      </p>
      {c.bio && <p className="mt-4 whitespace-pre-line break-words text-sm text-ink">{c.bio}</p>}
    </section>
  );
}

function StatsCard({ c }: { c: PublicCreator }) {
  return (
    <section className={card} aria-label="數據">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label="IG 粉絲" value={formatNumber(c.followerCount)} />
        <Stat label="互動率" value={formatPercent(c.engagementRate)} />
        <Stat label="主要受眾" value={c.audienceAge ? `${c.audienceAge} 歲` : "—"} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-bold text-ink">{value}</dd>
    </div>
  );
}

function PortfolioGrid({ name, items }: { name: string; items: PortfolioItem[] }) {
  return (
    <Section title="作品">
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {items.map((it, i) => {
          const img = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creatorMediaUrl(it.imagePath) ?? undefined} alt={`${name} 的作品 ${i + 1}`} loading="lazy"
              className="aspect-square w-full rounded-input bg-primary-soft object-cover"
            />
          );
          return (
            <li key={it.imagePath} className="relative">
              {it.linkUrl ? (
                <a
                  href={it.linkUrl} target="_blank" rel="noopener noreferrer"
                  className="block rounded-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  {img}
                  <span className="absolute right-2 top-2 rounded-btn bg-surface p-1 text-ink">
                    <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span className="sr-only">（在 Instagram 開啟，另開新分頁）</span>
                </a>
              ) : img}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function RatesSection({ viewer, handle, rates }: { viewer: ViewerKind; handle: string; rates: Rate[] }) {
  if (viewer !== "brand") {
    return (
      <Section title="報價方案">
        <Link
          href={`/login?next=${encodeURIComponent(`/c/${handle}`)}`}
          className="flex items-center gap-2 rounded-input bg-primary-soft p-4 text-sm font-semibold text-ink hover:bg-line"
        >
          <Lock size={16} strokeWidth={1.5} aria-hidden="true" />品牌登入後可查看報價
        </Link>
      </Section>
    );
  }
  return (
    <Section title="報價方案">
      {rates.length === 0 ? (
        <p className="text-sm text-muted">尚未提供報價，可以直接邀請洽談</p>
      ) : (
        <ul className="divide-y divide-line">
          {rates.map((r) => (
            <li key={r.collabType} className="flex items-center justify-between py-3 text-sm">
              <span className="text-ink">{r.collabType}</span>
              <span className="font-bold text-ink">{formatTwd(r.priceTwd)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** 邀請合作：訪客 → 註冊品牌；品牌 → 停用（計畫 4/6）；創作者（含本人）→ 不顯示。 */
function Invite({ viewer }: { viewer: ViewerKind }) {
  if (viewer === "creator") return null;
  const btn = "flex h-11 w-full items-center justify-center rounded-btn bg-ink font-semibold text-on-ink";
  const button = viewer === "guest"
    ? <Link href="/signup?role=brand" className={btn}>邀請合作</Link>
    : <button type="button" disabled className={`${btn} opacity-60`}>邀請合作（即將推出）</button>;
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
        {button}
      </div>
      <div className="hidden md:sticky md:top-4 md:z-10 md:block">{button}</div>
    </>
  );
}
```

- [ ] **Step 5: 頁面 `src/app/c/[handle]/page.tsx`**

```tsx
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadPortfolio, loadPublicCreator, loadRates } from "@/lib/creators/public-profile";
import { viewerKindOf } from "@/lib/creators/view";
import { ProfileView } from "./ProfileView";

type Props = { params: Promise<{ handle: string }> };

// 頁面殼是靜態的；資料在 <Suspense> 內逐次請求讀取，不快取（審核狀態在 SQL 改，App 無法觸發 revalidate；見計畫 3「快取決定」）。
export default function CreatorPublicPage({ params }: Props) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: Props) {
  const { handle } = await params;
  const creator = await loadPublicCreator(handle);
  // 不存在或未審核（且不是本人）一律 404，不透露任何資料
  if (!creator) notFound();
  const [me, portfolio] = await Promise.all([getCurrentUser(), loadPortfolio(creator.userId)]);
  const viewer = viewerKindOf(me?.profile?.role);
  // 報價只給品牌看（RLS 也只讓品牌與本人讀得到）；本人以創作者身分看到的是鎖定區塊
  const rates = viewer === "brand" ? await loadRates(creator.userId, creator.collabTypes) : [];
  return <ProfileView creator={creator} portfolio={portfolio} rates={rates} viewer={viewer} />;
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4 pt-2 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6 md:pt-6">
      <p className="sr-only">載入中…</p>
      <div className="h-64 rounded-card border border-line bg-surface" />
      <div className="h-64 rounded-card border border-line bg-surface" />
    </div>
  );
}
```

- [ ] **Step 6: 找不到頁面 `src/app/c/[handle]/not-found.tsx`**

```tsx
import Link from "next/link";

export default function CreatorNotFound() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-card border border-line bg-surface p-8 text-center">
      <h1 className="text-xl font-bold text-ink">找不到這位創作者</h1>
      <p className="mt-2 text-sm text-muted">網址可能有誤，或這個頁面還沒有公開。</p>
      <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-btn bg-ink px-6 font-semibold text-on-ink">回首頁</Link>
    </div>
  );
}
```

- [ ] **Step 7: 確認通過**

dev server 還在跑（會自動重新載入）。另一個終端機：
```bash
curl -s http://127.0.0.1:3000/c/p3seed | grep -o -E '測試小美|新創作者・尚無評價|品牌登入後可查看報價|NT\$4,500|/signup\?role=brand' | sort -u
curl -s http://127.0.0.1:3000/c/nobody123 | grep -o -E '找不到這位創作者|noindex|測試小美' | sort -u
curl -s http://127.0.0.1:3000/c/Bad%20Handle | grep -o '找不到這位創作者' | head -1
```
Expected:
- 第一行：`/signup?role=brand`、`品牌登入後可查看報價`、`新創作者・尚無評價`、`測試小美`（**不能**出現 `NT$4,500`，訪客看不到報價）
- 第二行：`noindex`、`找不到這位創作者`（不能出現 `測試小美`）
- 第三行：`找不到這位創作者`

再跑：
```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: 全部通過；build 輸出中 `/c/[handle]` 標示為部分預渲染或動態（不是完全靜態），沒有 `Uncached data was accessed outside of <Suspense>` 錯誤。

- [ ] **Step 8: Commit**

```bash
git add src/app/c
git commit -m "計畫 3 Task 5：創作者公開頁 /c/[handle]（版面、報價鎖定、邀請按鈕、404）"
```

---

### Task 6: SEO：metadata 與 OG 圖片

**Files:**
- Create: `src/lib/creators/metadata.ts`、`src/lib/creators/metadata.test.ts`、`src/lib/creators/og-avatar.ts`、`src/lib/creators/og-avatar.test.ts`、`src/app/c/[handle]/opengraph-image.tsx`
- Modify: `src/app/c/[handle]/page.tsx`

**Interfaces:**
- Consumes: Task 4 的 `loadPublicCreator`、`loadApprovedCreatorAsGuest`；Task 3 的 `creatorMediaUrl`、`formatNumber`、`initialOf`、`PublicCreator`；`SITE_NAME`。
- Produces:
  - `profileMetadata(c: PublicCreator | null): Metadata`：title「<顯示名稱>（@<handle>）｜Kollink」；description「地區・內容領域（以、分隔）・IG 粉絲 <千分位>」；未審核（本人預覽）加 `robots: { index: false, follow: false }`；`null` 時只回傳「找不到這個頁面｜Kollink」與 noindex，不含任何創作者資料。
  - `avatarDataUri(path: string | null, fetchImpl?: typeof fetch): Promise<string | null>`
  - 路由 `/c/<handle>/opengraph-image`：已審核 → 1200×630 PNG；其他 → 404（用訪客 client，所以本人預覽也拿不到圖，不洩漏未審核資料）。

技術說明（讀過的文件見「快取決定」）：
- `generateMetadata` 讀 cookie（本人判斷）→ 在請求時解析並串流；頁面本身也有請求時的內容，所以不需要額外的 dynamic marker（`generate-metadata.md`「With Cache Components」）。不支援 JS 的爬蟲（例如 `facebookexternalhit`）會等 metadata 解析完才開始回應，所以 `<head>` 裡有完整的 title 與 og 標籤（同文件「Streaming metadata」）。
- `next/og` 遇到中文字會在請求時自動從 Google Fonts 下載 Noto Sans TC 的子集（`node_modules/next/dist/compiled/@vercel/og/index.node.js` 內建的語言對照），不用自己放字型檔。
- `ImageResponse` 會擋 `localhost`、私有 IP 的圖片網址（SSRF 防護；本機 Supabase 是 `127.0.0.1`），而且 webp 不保證能畫，所以頭像由伺服器自己抓、只接受 PNG／JPEG、轉成 data URI；其他情況顯示名字首字。

- [ ] **Step 1: 寫失敗的測試**

`src/lib/creators/metadata.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { profileMetadata } from "./metadata";
import type { PublicCreator } from "./view";

const c: PublicCreator = {
  userId: "u1", handle: "mei", displayName: "小美", avatarPath: null, region: "台北市", categories: ["美妝", "穿搭"],
  followerCount: 12000, engagementRate: 3.5, audienceAge: "18-24", styleTags: [], collabTypes: [], bio: null,
  status: "approved", isSelf: false,
};

describe("profileMetadata", () => {
  it("已審核：title、description、openGraph，沒有 robots", () => {
    const m = profileMetadata(c);
    expect(m.title).toBe("小美（@mei）｜Kollink");
    expect(m.description).toBe("台北市・美妝、穿搭・IG 粉絲 12,000");
    expect(m.openGraph).toMatchObject({ title: "小美（@mei）｜Kollink", type: "profile" });
    expect(m.robots).toBeUndefined();
  });
  it("本人預覽（未審核）加 noindex", () => {
    expect(profileMetadata({ ...c, status: "pending", isSelf: true }).robots).toEqual({ index: false, follow: false });
  });
  it("沒有地區與內容領域時只剩粉絲數", () => {
    expect(profileMetadata({ ...c, region: null, categories: [], followerCount: 0 }).description).toBe("IG 粉絲 0");
  });
  it("找不到時不洩漏任何資料", () => {
    const m = profileMetadata(null);
    expect(m).toEqual({ title: "找不到這個頁面｜Kollink", robots: { index: false, follow: false } });
  });
});
```

`src/lib/creators/og-avatar.test.ts`：

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { avatarDataUri } from "./og-avatar";

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321"));
afterEach(() => vi.unstubAllEnvs());

const png = (body: BodyInit | null, init?: ResponseInit) =>
  new Response(body, { headers: { "content-type": "image/png" }, ...init });

describe("avatarDataUri", () => {
  it("PNG 轉成 data URI", async () => {
    const f = vi.fn(async () => png(new Uint8Array([1, 2, 3])));
    expect(await avatarDataUri("u1/avatar-a.png", f)).toBe("data:image/png;base64,AQID");
    expect(f).toHaveBeenCalledWith(
      "http://127.0.0.1:54321/storage/v1/object/public/creator-media/u1/avatar-a.png", expect.anything());
  });
  it("沒有頭像或是 webp 時不抓", async () => {
    const f = vi.fn();
    expect(await avatarDataUri(null, f)).toBeNull();
    expect(await avatarDataUri("u1/avatar-a.webp", f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("回應不是 200、類型不對、空檔、抓取失敗都回傳 null", async () => {
    expect(await avatarDataUri("u1/avatar-a.png", vi.fn(async () => png(null, { status: 404 })))).toBeNull();
    expect(await avatarDataUri("u1/avatar-a.png", vi.fn(async () =>
      new Response(new Uint8Array([1]), { headers: { "content-type": "text/html" } })))).toBeNull();
    expect(await avatarDataUri("u1/avatar-a.png", vi.fn(async () => png(new Uint8Array([]))))).toBeNull();
    expect(await avatarDataUri("u1/avatar-a.jpg", vi.fn(async () => { throw new Error("down"); }))).toBeNull();
  });
});
```

- [ ] **Step 2: 確認失敗**

```bash
npm test -- src/lib/creators
```
Expected: FAIL，找不到 `./metadata`、`./og-avatar`。

- [ ] **Step 3: 實作純函式**

`src/lib/creators/metadata.ts`：

```ts
import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import { formatNumber } from "@/lib/format";
import type { PublicCreator } from "./view";

const NOINDEX = { index: false, follow: false } as const;

/** 公開頁的 metadata。null（不存在或未公開）時不帶任何創作者資料。 */
export function profileMetadata(c: PublicCreator | null): Metadata {
  if (!c) return { title: `找不到這個頁面｜${SITE_NAME}`, robots: NOINDEX };
  const title = `${c.displayName}（@${c.handle}）｜${SITE_NAME}`;
  const description = [c.region, c.categories.join("、"), `IG 粉絲 ${formatNumber(c.followerCount)}`]
    .filter((s) => s)
    .join("・");
  const base: Metadata = { title, description, openGraph: { title, description, type: "profile" } };
  // 能拿到未審核的資料只有本人預覽一種情況
  return c.status === "approved" ? base : { ...base, robots: NOINDEX };
}
```

`src/lib/creators/og-avatar.ts`：

```ts
import { creatorMediaUrl } from "@/lib/creator-media";

const OG_AVATAR_TYPES = new Set(["image/png", "image/jpeg"]);
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * OG 圖片用的頭像：伺服器自己抓 Storage 的公開檔案，轉成 data URI。
 * ImageResponse 會擋 localhost／私有 IP 的網址，webp 也不保證能畫，所以只接受 PNG／JPEG；失敗一律回傳 null（改顯示名字首字）。
 */
export async function avatarDataUri(path: string | null, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!path || !/\.(png|jpe?g)$/i.test(path)) return null;
  const url = creatorMediaUrl(path);
  if (!url) return null;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(3000) });
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!res.ok || !OG_AVATAR_TYPES.has(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: 確認純函式測試通過**

```bash
npm test -- src/lib/creators
```
Expected: PASS。

- [ ] **Step 5: 頁面加上 `generateMetadata`**

`src/app/c/[handle]/page.tsx` 最上方的 import 換成：

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadPortfolio, loadPublicCreator, loadRates } from "@/lib/creators/public-profile";
import { profileMetadata } from "@/lib/creators/metadata";
import { viewerKindOf } from "@/lib/creators/view";
import { ProfileView } from "./ProfileView";
```

並在 `type Props = ...` 那一行之後加上：

```tsx
// 讀 cookie（本人預覽要加 noindex），在請求時解析；loadPublicCreator 有 React cache，與頁面共用同一次查詢
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  return profileMetadata(await loadPublicCreator(handle));
}
```

- [ ] **Step 6: OG 圖片 `src/app/c/[handle]/opengraph-image.tsx`**

```tsx
import { ImageResponse } from "next/og";
import { loadApprovedCreatorAsGuest } from "@/lib/creators/public-profile";
import { avatarDataUri } from "@/lib/creators/og-avatar";
import { formatNumber, initialOf } from "@/lib/format";
import { SITE_NAME } from "@/lib/site";

export const alt = `${SITE_NAME} 創作者公開頁`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ImageResponse 不吃 Tailwind class；值與 src/app/globals.css 的 token 相同
const OG_COLORS = { bg: "#F3F3F2", surface: "#FFFFFF", line: "#E4E4E7", ink: "#18181B", muted: "#686872", onInk: "#FFFFFF" };

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  // 訪客身分：只有已審核的創作者有 OG 圖片，未審核或不存在一律 404
  const c = await loadApprovedCreatorAsGuest(handle);
  if (!c) return new Response("Not found", { status: 404 });
  const avatar = await avatarDataUri(c.avatarPath);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          background: OG_COLORS.bg, color: OG_COLORS.ink, padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" width={200} height={200} style={{ borderRadius: 100, objectFit: "cover" }} />
          ) : (
            <div
              style={{
                width: 200, height: 200, borderRadius: 100, background: OG_COLORS.ink, color: OG_COLORS.onInk,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 96,
              }}
            >
              {initialOf(c.displayName)}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 72, fontWeight: 700 }}>{c.displayName}</div>
            <div style={{ fontSize: 36, color: OG_COLORS.muted }}>{`@${c.handle}`}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 44 }}>{`IG 粉絲 ${formatNumber(c.followerCount)}`}</div>
          <div style={{ display: "flex", gap: 12 }}>
            {c.categories.map((cat) => (
              <div
                key={cat}
                style={{
                  display: "flex", padding: "8px 24px", borderRadius: 9999, background: OG_COLORS.surface,
                  border: `2px solid ${OG_COLORS.line}`, fontSize: 28,
                }}
              >
                {cat}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{SITE_NAME}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
```

- [ ] **Step 7: 確認通過**

dev server 在跑（Task 5 的種子資料 `p3seed` 還在）：
```bash
OUT=$(mktemp -d)
curl -s -o "$OUT/og.png" -w "%{http_code} %{content_type}\n" http://127.0.0.1:3000/c/p3seed/opengraph-image
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/c/nobody123/opengraph-image
curl -s -A "facebookexternalhit/1.1" http://127.0.0.1:3000/c/p3seed | grep -o -E '<title>[^<]*</title>|<meta property="og:image" content="[^"]*"|<meta name="description" content="[^"]*"'
curl -s -A "facebookexternalhit/1.1" http://127.0.0.1:3000/c/nobody123 | grep -o -E '<title>[^<]*</title>|noindex' | sort -u
echo "$OUT/og.png"
```
Expected:
- `200 image/png`
- `404`
- `<title>測試小美（@p3seed）｜Kollink</title>`、`<meta name="description" content="台北市・美妝、穿搭・IG 粉絲 12,000"`、`og:image` 網址含 `/c/p3seed/opengraph-image`
- `<title>找不到這個頁面｜Kollink</title>` 與 `noindex`

用 Read 工具打開最後印出的 `og.png` 路徑：要看到名字首字「測」的黑色圓形、「測試小美」、「@p3seed」、「IG 粉絲 12,000」、「美妝」「穿搭」兩個膠囊、「Kollink」，中文字不能是方框。

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: 全部通過。

- [ ] **Step 8: Commit**

```bash
git add src/lib/creators src/app/c
git commit -m "計畫 3 Task 6：公開頁 metadata（本人預覽 noindex）與 OG 圖片"
```

---

### Task 7: 創作者後台：公開頁基本資料與頭像

**Files:**
- Create: `src/components/forms/AvatarField.tsx`、`src/app/creator/me/profile/page.tsx`、`src/app/creator/me/profile/actions.ts`、`src/app/creator/me/profile/PublicProfileForm.tsx`
- Modify: `src/app/creator/me/page.tsx`

**Interfaces:**
- Consumes: Task 1 的 `update_creator_public_profile`；Task 2 的 `creator-media` bucket；Task 3 的 `parsePublicProfileForm`、`validatePublicProfileInput`、`planMediaUpload`、`creatorMediaUrl`、`CREATOR_MEDIA_BUCKET`、`initialOf`、`COLLAB_TYPES`、`AUDIENCE_AGES`、`mapAccountError`、`OwnProfileFields`；Task 4 的 `loadOwnPublicProfile`；`requireRole`、`Field`、`inputClass`。
- Produces:
  - 路由 `/creator/me/profile`（標題「公開頁」，有「查看我的公開頁」連結）；`/creator/me` 多了「編輯公開頁」「查看我的公開頁」兩個連結。
  - `updatePublicProfileAction(prev: FormState, fd: FormData): Promise<FormState>`（`src/app/creator/me/profile/actions.ts`；Task 8 會在同一個檔案加兩個 action）
  - `AvatarField`（props：`userId`、`name`、`initialPath`、`error?`、`onBusyChange?`、`disabled?`；隱藏欄位名稱 `avatarPath`）

設計說明：spec 讓實作計畫決定「區塊」或「子頁」。選子頁 `/creator/me/profile`，分三張表單（基本資料、作品、報價），每張表單只呼叫一個函式，每次儲存都是單一 transaction；報價表單列出的是**已儲存**的想接合作（避免與未儲存的勾選不一致）。

- [ ] **Step 1: 頭像欄位 `src/components/forms/AvatarField.tsx`**

規則比照 `LogoField`：只刪除「這個元件本次上傳、尚未儲存」的檔案；`initialPath` 是資料庫還在引用的，永遠不刪。

```tsx
"use client";
import { useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CREATOR_MEDIA_BUCKET, creatorMediaUrl, planMediaUpload } from "@/lib/creator-media";
import { initialOf } from "@/lib/format";

type Props = {
  userId: string;
  /** 沒有頭像時顯示名字第一個字。 */
  name: string;
  initialPath: string | null;
  error?: string;
  /** 上傳中為 true；表單用來停用送出按鈕。 */
  onBusyChange?: (busy: boolean) => void;
  /** 表單儲存中為 true：不能換檔、移除，也不會刪除任何檔案。 */
  disabled?: boolean;
};

export function AvatarField({ userId, name, initialPath, error, onBusyChange, disabled }: Props) {
  const [path, setPath] = useState<string | null>(initialPath);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ownedRef = useRef<string | null>(null);
  const noteId = useId();
  const url = creatorMediaUrl(path);

  function setBusyState(b: boolean) {
    setBusy(b);
    onBusyChange?.(b);
  }

  function discard(p: string | null) {
    if (disabled || !p || p !== ownedRef.current) return;
    ownedRef.current = null;
    // 盡力刪除，失敗就忽略（孤兒檔由排程清理，見 followups）
    void Promise.resolve(createClient().storage.from(CREATOR_MEDIA_BUCKET).remove([p])).catch(() => {});
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    const plan = planMediaUpload(userId, "avatar", file, crypto.randomUUID());
    if ("error" in plan) return setMsg(plan.error);
    setBusyState(true);
    try {
      const { error: e } = await createClient().storage.from(CREATOR_MEDIA_BUCKET)
        .upload(plan.path, file, { contentType: file.type });
      if (e) return setMsg("上傳失敗，請再試一次");
      discard(ownedRef.current);
      ownedRef.current = plan.path;
      setPath(plan.path);
    } catch {
      setMsg("上傳失敗，請再試一次");
    } finally {
      setBusyState(false);
    }
  }

  function remove() {
    if (disabled) return;
    discard(path);
    setPath(null);
    setMsg(null);
  }

  const note = msg ?? error;
  return (
    <div>
      <span className="text-sm font-semibold text-ink">頭像（選填）</span>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="頭像預覽" className="h-16 w-16 rounded-full border border-line object-cover" />
        ) : (
          <div aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-2xl font-semibold text-on-ink">
            {initialOf(name)}
          </div>
        )}
        <input
          type="file" className="min-w-0 flex-1" accept="image/png,image/jpeg,image/webp" disabled={busy || disabled}
          aria-label="上傳頭像" aria-describedby={note ? noteId : undefined} aria-invalid={note ? true : undefined}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // 讓同一個檔案可以再選一次
            void onFile(file);
          }}
        />
        {path && <button type="button" disabled={busy || disabled} className="text-sm text-muted" onClick={remove}>移除頭像</button>}
      </div>
      <input type="hidden" name="avatarPath" value={path ?? ""} />
      {note && <span id={noteId} role={msg ? "status" : undefined} className="mt-1 block text-xs text-danger">{note}</span>}
      <span className="mt-1 block text-xs text-muted">JPG、PNG、WebP，5MB 以內</span>
    </div>
  );
}
```

- [ ] **Step 2: Server action `src/app/creator/me/profile/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { mapAccountError, type FormState, type FormValues } from "@/lib/auth/account-errors";
import { validatePublicProfileInput } from "@/lib/validation/creator-profile";
import { parsePublicProfileForm } from "@/lib/validation/form-data";

function failure(error: { code?: string; message?: string }, values?: FormValues): FormState {
  const mapped = mapAccountError(error);
  return { ...(mapped.kind === "state" ? mapped.state : { formError: "發生錯誤，請稍後再試" }), values };
}

function revalidateProfile(handle: string) {
  revalidatePath("/creator/me/profile");
  revalidatePath(`/c/${handle}`);
}

export async function updatePublicProfileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("creator");
  if (!me.creator) return { formError: "找不到創作者資料，請重新登入" };
  const input = parsePublicProfileForm(fd);
  const values: FormValues = {
    bio: input.bio,
    styleTags: input.styleTags.join("、"),
    collabTypes: input.collabTypes,
    engagementRate: input.engagementRate,
    audienceAge: input.audienceAge,
    avatarPath: input.avatarPath ?? "",
  };
  const fieldErrors = validatePublicProfileInput(input);
  if (fieldErrors) return { fieldErrors, values };

  const supabase = await createClient();
  // 修改只能走 definer 函式；空字串由資料庫轉成 null。
  // p_engagement_rate、p_avatar_path 傳 null 代表不填／移除頭像（產生的型別寫成非 null，所以要轉型）
  const { error } = await supabase.rpc("update_creator_public_profile", {
    p_bio: input.bio,
    p_style_tags: input.styleTags,
    p_collab_types: input.collabTypes,
    p_engagement_rate: (input.engagementRate === "" ? null : Number(input.engagementRate)) as number,
    p_audience_age: input.audienceAge,
    p_avatar_path: input.avatarPath as string,
  });
  if (error) return failure(error, values);
  revalidateProfile(me.creator.handle);
  return { ok: true };
}
```

- [ ] **Step 3: 表單 `src/app/creator/me/profile/PublicProfileForm.tsx`**

```tsx
"use client";
import { useActionState, useState } from "react";
import { Field, inputClass } from "@/components/forms/Field";
import { AvatarField } from "@/components/forms/AvatarField";
import { AUDIENCE_AGES, COLLAB_TYPES } from "@/lib/options";
import type { FormState } from "@/lib/auth/account-errors";
import type { OwnProfileFields } from "@/lib/creators/view";
import { updatePublicProfileAction } from "./actions";

const textareaClass = "w-full rounded-input border border-line bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ink";

export function PublicProfileForm({ userId, displayName, initial }: {
  userId: string; displayName: string; initial: OwnProfileFields;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePublicProfileAction, {});
  const [uploading, setUploading] = useState(false);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const val = (key: string, fallback: string) => (typeof v[key] === "string" ? (v[key] as string) : fallback);
  const checked = Array.isArray(v.collabTypes) ? v.collabTypes : initial.collabTypes;
  // React 送出後會重設表單；失敗時用 values 還原。儲存成功後 props 變了，所以 props 也放進 key 讓欄位重新掛載
  const k = JSON.stringify(state.values ?? initial);
  const avatarInitial = typeof v.avatarPath === "string" ? (v.avatarPath || null) : initial.avatarPath;
  return (
    <form action={action} className="max-w-xl space-y-4 rounded-card border border-line bg-surface p-5 md:p-8">
      <h2 className="text-lg font-bold text-ink">基本資料</h2>
      <AvatarField
        key={`avatar-${k}`} userId={userId} name={displayName} initialPath={avatarInitial}
        error={fe.avatarPath} onBusyChange={setUploading} disabled={pending}
      />
      <Field label="自我介紹（選填）" hint="300 字以內" error={fe.bio}>
        {(c) => <textarea key={k} {...c} name="bio" rows={4} maxLength={300} defaultValue={val("bio", initial.bio)} className={textareaClass} />}
      </Field>
      <Field label="風格標籤（選填）" hint="用逗號或頓號分隔，最多 8 個，每個 12 字以內" error={fe.styleTags}>
        {(c) => (
          <input key={k} {...c} name="styleTags" placeholder="例如：日系、簡約" defaultValue={val("styleTags", initial.styleTags.join("、"))} className={inputClass} />
        )}
      </Field>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">想接的合作</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {COLLAB_TYPES.map((t) => (
            <label key={`${k}-${t}`} className="flex min-h-9 items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="collabTypes" value={t} defaultChecked={checked.includes(t)} className="h-4 w-4 accent-ink" />
              {t}
            </label>
          ))}
        </div>
        {fe.collabTypes && <span className="mt-1 block text-xs text-danger">{fe.collabTypes}</span>}
      </fieldset>
      <Field label="互動率（%，選填）" hint="0–100，最多兩位小數" error={fe.engagementRate}>
        {(c) => (
          <input
            key={k} {...c} name="engagementRate" inputMode="decimal" placeholder="例如 3.5"
            defaultValue={val("engagementRate", initial.engagementRate === null ? "" : String(initial.engagementRate))}
            className={inputClass}
          />
        )}
      </Field>
      <Field label="主要受眾年齡（選填）" error={fe.audienceAge}>
        {(c) => (
          <select key={k} {...c} name="audienceAge" defaultValue={val("audienceAge", initial.audienceAge)} className={inputClass}>
            <option value="">不填</option>
            {AUDIENCE_AGES.map((a) => <option key={a} value={a}>{a} 歲</option>)}
          </select>
        )}
      </Field>
      {state.formError && <p role="alert" className="text-sm text-danger">{state.formError}</p>}
      {state.ok && <p role="status" className="text-sm text-success">已儲存</p>}
      <button disabled={pending || uploading} className="h-11 w-full rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 md:w-auto">
        儲存基本資料
      </button>
    </form>
  );
}
```

- [ ] **Step 4: 子頁 `src/app/creator/me/profile/page.tsx`**

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { loadOwnPublicProfile } from "@/lib/creators/own-profile";
import { PublicProfileForm } from "./PublicProfileForm";

export default function CreatorProfileEditPage() {
  return (
    <>
      <div className="mb-6">
        <Link href="/creator/me" className="text-sm text-muted hover:text-ink">← 我的</Link>
        <h1 className="mt-2 text-[32px] font-bold text-ink">公開頁</h1>
      </div>
      <Suspense fallback={<p className="text-muted">載入中…</p>}>
        <Editor />
      </Suspense>
    </>
  );
}

async function Editor() {
  const me = await requireRole("creator");
  if (!me.creator || !me.profile) return null;
  const own = await loadOwnPublicProfile(me.id);
  return (
    <div className="space-y-6">
      <Link
        href={`/c/${me.creator.handle}`}
        className="inline-flex h-11 items-center rounded-btn border border-line bg-surface px-6 font-semibold text-ink hover:bg-primary-soft"
      >
        查看我的公開頁
      </Link>
      <PublicProfileForm userId={me.id} displayName={me.profile.displayName} initial={own.profile} />
    </div>
  );
}
```

- [ ] **Step 5: `/creator/me` 加連結**

`src/app/creator/me/page.tsx` 整個換成：

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { CreatorSettingsForm } from "./CreatorSettingsForm";

export default function CreatorMePage() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[32px] font-bold text-ink">我的</h1>
        <div className="md:hidden"><SignOutButton /></div>
      </div>
      <Suspense fallback={null}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const me = await requireRole("creator");
  if (!me.creator || !me.profile) return null;
  const c = me.creator;
  return (
    <>
      <div className="mb-6 flex max-w-xl flex-wrap gap-3">
        <Link href="/creator/me/profile" className="inline-flex h-11 items-center rounded-btn bg-ink px-6 font-semibold text-on-ink">
          編輯公開頁
        </Link>
        <Link
          href={`/c/${c.handle}`}
          className="inline-flex h-11 items-center rounded-btn border border-line bg-surface px-6 font-semibold text-ink hover:bg-primary-soft"
        >
          查看我的公開頁
        </Link>
      </div>
      <CreatorSettingsForm
        displayName={me.profile.displayName} handle={c.handle} igUsername={c.igUsername}
        followerCount={c.followerCount} region={c.region} categories={c.categories}
        handleEditable={!c.handleLocked}
      />
    </>
  );
}
```

- [ ] **Step 6: 驗證**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: 全部通過。

手動（`npm run dev`，Mailpit http://127.0.0.1:54324 收驗證碼；測試圖片先產生）：
```bash
IMG=$(mktemp -d)
sips -s format png -Z 512 /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns --out "$IMG/avatar.png"
echo "$IMG/avatar.png"
```
1. 註冊一個創作者（例如 `p3-task7@test.local`）並填完資料 → `/creator/me` 看到「編輯公開頁」「查看我的公開頁」。
2. 「編輯公開頁」→ 上傳 `avatar.png` 看到圓形預覽 → 自我介紹填兩行 → 風格標籤填 `日系、簡約` → 勾選「IG 貼文」「Reels」→ 互動率 `3.5` → 受眾 `18-24 歲` → 「儲存基本資料」→ 顯示「已儲存」，重新整理後值都還在。
3. 互動率改成 `101` 送出 → 欄位下方顯示「請填 0–100 的數字（最多兩位小數）」，其他欄位保留剛填的值。
4. 在 Studio（http://127.0.0.1:54323）執行，確認資料庫：
   ```sql
   select bio, style_tags, collab_types, engagement_rate, audience_age, avatar_path, status from public.creator_profiles where ig_username = '填入剛剛的 IG 帳號';
   ```
   Expected：`avatar_path` 是 `<user_id>/avatar-<uuid>.png`，`status` 仍是 `pending`。
5. 直接開 http://127.0.0.1:3000/creator/me/profile 但以品牌帳號登入 → 被導回 `/brand`（`requireRole`）。

- [ ] **Step 7: Commit**

```bash
git add src/components/forms/AvatarField.tsx src/app/creator/me
git commit -m "計畫 3 Task 7：後台公開頁子頁、基本資料與頭像上傳"
```

---

### Task 8: 創作者後台：作品與報價

**Files:**
- Create: `src/app/creator/me/profile/PortfolioForm.tsx`、`src/app/creator/me/profile/RatesForm.tsx`
- Modify: `src/app/creator/me/profile/actions.ts`、`src/app/creator/me/profile/page.tsx`

**Interfaces:**
- Consumes: Task 1 的 `set_creator_portfolio`、`set_creator_rates`；Task 3 的 `parsePortfolioForm`、`validatePortfolio`、`parseRatesForm`、`validateRates`、`MAX_PORTFOLIO`、`planMediaUpload`、`creatorMediaUrl`、`CREATOR_MEDIA_BUCKET`、`PortfolioItem`、`Rate`；Task 4 的 `loadOwnPublicProfile`；Task 7 的 `actions.ts`（`failure`、`revalidateProfile`）與 `page.tsx`。
- Produces: `updatePortfolioAction(prev, fd)`、`updateRatesAction(prev, fd)`；`PortfolioForm`（props `userId`、`initial: PortfolioItem[]`）、`RatesForm`（props `collabTypes: string[]`、`initial: Rate[]`）。

- [ ] **Step 1: 在 `src/app/creator/me/profile/actions.ts` 加兩個 action**

最上方的 import 換成：

```ts
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { mapAccountError, type FormState, type FormValues } from "@/lib/auth/account-errors";
import { loadOwnPublicProfile } from "@/lib/creators/own-profile";
import { validatePortfolio, validatePublicProfileInput, validateRates } from "@/lib/validation/creator-profile";
import { parsePortfolioForm, parsePublicProfileForm, parseRatesForm } from "@/lib/validation/form-data";
```

（第一行 `"use server";` 保留。）檔案最後加上：

```ts
export async function updatePortfolioAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("creator");
  if (!me.creator) return { formError: "找不到創作者資料，請重新登入" };
  const items = parsePortfolioForm(fd);
  if (!items) return { formError: "資料格式不正確，請重新整理頁面後再試" };
  const fieldErrors = validatePortfolio(items);
  // 作品清單由表單元件自己保存，失敗時不需要回傳 values
  if (fieldErrors) return { fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_creator_portfolio", {
    p_items: items.map((it) => ({ image_path: it.imagePath, link_url: it.linkUrl || null })),
  });
  if (error) return failure(error);
  revalidateProfile(me.creator.handle);
  return { ok: true };
}

export async function updateRatesAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("creator");
  if (!me.creator) return { formError: "找不到創作者資料，請重新登入" };
  // 以資料庫裡已儲存的想接合作為準（表單只列出這些）
  const { profile } = await loadOwnPublicProfile(me.id);
  const rates = parseRatesForm(fd, profile.collabTypes);
  const values: FormValues = Object.fromEntries(
    profile.collabTypes.map((t) => [`price:${t}`, rates.find((r) => r.collabType === t)?.price ?? ""]),
  );
  const fieldErrors = validateRates(rates);
  if (fieldErrors) return { fieldErrors, values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_creator_rates", {
    p_rates: rates.map((r) => ({ collab_type: r.collabType, price_twd: Number(r.price) })),
  });
  if (error) return failure(error, values);
  revalidateProfile(me.creator.handle);
  return { ok: true };
}
```

- [ ] **Step 2: 作品表單 `src/app/creator/me/profile/PortfolioForm.tsx`**

規則：上傳後先出現在清單（還沒存進資料庫）；按「儲存作品」才整批寫入。刪除「本次上傳、尚未儲存」的作品會一併刪掉 Storage 檔案；已儲存過的檔案不刪（孤兒檔由排程清理）。

```tsx
"use client";
import { useActionState, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CREATOR_MEDIA_BUCKET, creatorMediaUrl, planMediaUpload } from "@/lib/creator-media";
import { MAX_PORTFOLIO } from "@/lib/validation/creator-profile";
import { inputClass } from "@/components/forms/Field";
import type { FormState } from "@/lib/auth/account-errors";
import type { PortfolioItem } from "@/lib/creators/view";
import { updatePortfolioAction } from "./actions";

type Row = { imagePath: string; linkUrl: string };

const smallBtn = "rounded-btn border border-line bg-surface px-3 py-1 text-sm text-ink hover:bg-primary-soft disabled:opacity-40";

export function PortfolioForm({ userId, initial }: { userId: string; initial: PortfolioItem[] }) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((it) => ({ imagePath: it.imagePath, linkUrl: it.linkUrl ?? "" })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // 本次上傳、尚未儲存的檔案；儲存成功後清空（之後就是資料庫在引用的檔案，不能刪）
  const owned = useRef(new Set<string>());
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await updatePortfolioAction(prev, fd);
    if (result.ok) owned.current.clear();
    return result;
  }, {});
  const headingId = useId();
  const fileId = useId();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    if (rows.length >= MAX_PORTFOLIO) return setMsg(`最多 ${MAX_PORTFOLIO} 張作品`);
    const plan = planMediaUpload(userId, "portfolio", file, crypto.randomUUID());
    if ("error" in plan) return setMsg(plan.error);
    setBusy(true);
    try {
      const { error } = await createClient().storage.from(CREATOR_MEDIA_BUCKET)
        .upload(plan.path, file, { contentType: file.type });
      if (error) return setMsg("上傳失敗，請再試一次");
      owned.current.add(plan.path);
      setRows((r) => [...r, { imagePath: plan.path, linkUrl: "" }]);
    } catch {
      setMsg("上傳失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  }

  function move(i: number, delta: number) {
    setRows((r) => {
      const j = i + delta;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function removeRow(i: number) {
    const path = rows[i].imagePath;
    if (owned.current.has(path)) {
      owned.current.delete(path);
      void Promise.resolve(createClient().storage.from(CREATOR_MEDIA_BUCKET).remove([path])).catch(() => {});
    }
    setRows((r) => r.filter((_, x) => x !== i));
  }

  function setLink(i: number, linkUrl: string) {
    setRows((r) => r.map((row, x) => (x === i ? { ...row, linkUrl } : row)));
  }

  const error = state.fieldErrors?.portfolio ?? state.formError;
  return (
    <form action={action} className="max-w-xl space-y-4 rounded-card border border-line bg-surface p-5 md:p-8">
      <div>
        <h2 id={headingId} className="text-lg font-bold text-ink">作品（最多 {MAX_PORTFOLIO} 張）</h2>
        <p className="mt-1 text-sm text-muted">第一張排在最前面。每張可以附一個 IG 貼文連結（選填）。沒有作品時公開頁不顯示這個區塊。</p>
      </div>
      {rows.length > 0 && (
        <ol aria-labelledby={headingId} className="space-y-3">
          {rows.map((row, i) => (
            <li key={row.imagePath} className="flex gap-3 rounded-input border border-line p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={creatorMediaUrl(row.imagePath) ?? undefined} alt={`作品 ${i + 1}`} className="h-20 w-20 shrink-0 rounded-input object-cover" />
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  aria-label={`作品 ${i + 1} 的 IG 貼文連結（選填）`} placeholder="https://www.instagram.com/p/..."
                  inputMode="url" value={row.linkUrl} onChange={(e) => setLink(i, e.target.value)} className={inputClass}
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={smallBtn} disabled={i === 0 || pending} onClick={() => move(i, -1)}>上移</button>
                  <button type="button" className={smallBtn} disabled={i === rows.length - 1 || pending} onClick={() => move(i, 1)}>下移</button>
                  <button type="button" className={smallBtn} disabled={pending} onClick={() => removeRow(i)}>刪除</button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div>
        <label htmlFor={fileId} className="text-sm font-semibold text-ink">新增作品</label>
        <input
          id={fileId} type="file" className="mt-1 block w-full" accept="image/png,image/jpeg,image/webp"
          disabled={busy || pending || rows.length >= MAX_PORTFOLIO}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onFile(file);
          }}
        />
        <span className="mt-1 block text-xs text-muted">JPG、PNG、WebP，5MB 以內</span>
      </div>
      <input type="hidden" name="items" value={JSON.stringify(rows)} />
      {msg && <p role="status" className="text-xs text-danger">{msg}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {state.ok && <p role="status" className="text-sm text-success">已儲存</p>}
      <button disabled={pending || busy} className="h-11 w-full rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 md:w-auto">
        儲存作品
      </button>
    </form>
  );
}
```

- [ ] **Step 3: 報價表單 `src/app/creator/me/profile/RatesForm.tsx`**

```tsx
"use client";
import { useActionState } from "react";
import { Field, inputClass } from "@/components/forms/Field";
import type { FormState } from "@/lib/auth/account-errors";
import type { Rate } from "@/lib/creators/view";
import { updateRatesAction } from "./actions";

export function RatesForm({ collabTypes, initial }: { collabTypes: string[]; initial: Rate[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateRatesAction, {});
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const k = JSON.stringify(state.values ?? initial);
  const priceOf = (t: string) => {
    const key = `price:${t}`;
    if (typeof v[key] === "string") return v[key] as string;
    const r = initial.find((x) => x.collabType === t);
    return r ? String(r.priceTwd) : "";
  };
  const error = fe.rates ?? state.formError;
  return (
    <form action={action} className="max-w-xl space-y-4 rounded-card border border-line bg-surface p-5 md:p-8">
      <div>
        <h2 className="text-lg font-bold text-ink">報價</h2>
        <p className="mt-1 text-sm text-muted">只有登入的品牌看得到。留空代表不提供這個合作形式的報價。</p>
      </div>
      {collabTypes.length === 0 ? (
        <p className="text-sm text-muted">先在「基本資料」勾選想接的合作並儲存，才能設定報價。</p>
      ) : (
        <>
          {collabTypes.map((t) => (
            <Field key={t} label={`${t}（NT$）`} error={fe[`price:${t}`]}>
              {(c) => (
                <input key={k} {...c} name={`price:${t}`} inputMode="numeric" placeholder="例如 4500" defaultValue={priceOf(t)} className={inputClass} />
              )}
            </Field>
          ))}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {state.ok && <p role="status" className="text-sm text-success">已儲存</p>}
          <button disabled={pending} className="h-11 w-full rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 md:w-auto">
            儲存報價
          </button>
        </>
      )}
    </form>
  );
}
```

- [ ] **Step 4: 子頁加上兩張表單**

`src/app/creator/me/profile/page.tsx` 整個換成：

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { loadOwnPublicProfile } from "@/lib/creators/own-profile";
import { PublicProfileForm } from "./PublicProfileForm";
import { PortfolioForm } from "./PortfolioForm";
import { RatesForm } from "./RatesForm";

export default function CreatorProfileEditPage() {
  return (
    <>
      <div className="mb-6">
        <Link href="/creator/me" className="text-sm text-muted hover:text-ink">← 我的</Link>
        <h1 className="mt-2 text-[32px] font-bold text-ink">公開頁</h1>
      </div>
      <Suspense fallback={<p className="text-muted">載入中…</p>}>
        <Editor />
      </Suspense>
    </>
  );
}

async function Editor() {
  const me = await requireRole("creator");
  if (!me.creator || !me.profile) return null;
  const own = await loadOwnPublicProfile(me.id);
  return (
    <div className="space-y-6">
      <Link
        href={`/c/${me.creator.handle}`}
        className="inline-flex h-11 items-center rounded-btn border border-line bg-surface px-6 font-semibold text-ink hover:bg-primary-soft"
      >
        查看我的公開頁
      </Link>
      <PublicProfileForm userId={me.id} displayName={me.profile.displayName} initial={own.profile} />
      <PortfolioForm userId={me.id} initial={own.portfolio} />
      <RatesForm collabTypes={own.profile.collabTypes} initial={own.rates} />
    </div>
  );
}
```

- [ ] **Step 5: 驗證**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: 全部通過。

手動（延續 Task 7 的創作者；先產生 3 張測試圖）：
```bash
IMG=$(mktemp -d)
for n in 1 2 3; do sips -s format jpeg -Z 800 /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns --out "$IMG/work$n.jpg" >/dev/null; done
ls "$IMG"
```
1. `/creator/me/profile` 的「作品」上傳 3 張 → 第 1 張連結填 `https://www.instagram.com/p/ABC123/` → 第 3 張按「上移」→ 「儲存作品」→「已儲存」，重新整理後順序與連結都還在。
2. 第 2 張連結填 `https://evil.com/p/1` →「儲存作品」→ 顯示「第 2 張的連結必須是 https://www.instagram.com/ 開頭的網址」，清單不變。
3. 「報價」顯示「IG 貼文（NT$）」「Reels（NT$）」兩欄 → 填 `4,500`、`8000` →「儲存報價」→「已儲存」，重新整理後顯示 `4500`、`8000`。
4. Reels 填 `1.5` → 欄位下方顯示「請填 0 到 10,000,000 的整數」。
5. 回「基本資料」取消勾選 Reels → 儲存 → 「報價」只剩 IG 貼文一欄（Reels 的報價已被函式刪除）。再把 Reels 勾回來並儲存（Task 9 要用）。
6. 上傳第 4 張後馬上按「刪除」→ Studio 的 Storage → `creator-media` → `<user_id>/` 底下沒有那個檔案。

- [ ] **Step 6: Commit**

```bash
git add src/app/creator/me/profile
git commit -m "計畫 3 Task 8：後台作品（上傳、排序、刪除、IG 連結）與報價"
```

---

### Task 9: 文件同步與本機端對端驗收

**Files:**
- Modify: `README.md`、`docs/superpowers/plans/2026-11-22-foundation-followups.md`

**Interfaces:**
- Consumes: Task 1–8 的全部成果。
- Produces: README 的正式環境說明與審核說明；followups 的完成標記與新的後續事項；E2E 截圖（存在本機暫存資料夾，不 commit）。

- [ ] **Step 1: README**

在「## 正式環境（Hosted Supabase）設定」底下、`雲端新專案不會自動把 public 資料表授權給 API 角色…` 那一段**之後**加上一段：

```markdown
創作者頭像與作品的 Storage bucket `creator-media` 由 migration `20261124000300_creator_media.sql` 建立，執行上面的 `npx supabase db push --remote` 就會一起建好，不用在後台手動建立 bucket 或 policy。這個 bucket 是公開的：未審核創作者的圖片網址如果被猜到也看得到（路徑含 UUID，很難猜），這是已接受的取捨。
```

同一節第 9 項換成：

```markdown
9. 排程清理沒被引用的 Storage 物件：`brand-logos`（沒被 `brand_profiles.logo_path` 引用）與 `creator-media`（沒被 `creator_profiles.avatar_path`、`creator_portfolio_items.image_path` 引用），都只刪超過 24 小時的，見 `docs/superpowers/plans/2026-11-22-foundation-followups.md`。
```

在「## 審核創作者（管理後台完成前）」的核准指令說明段落（`結果顯示 UPDATE 0 …` 那段）之後加上：

```markdown
核准後公開頁 `/c/<handle>` 立刻對所有人顯示（公開頁不快取）；把 `status` 改成 `suspended` 也會立刻下架。
```

- [ ] **Step 2: followups**

`docs/superpowers/plans/2026-11-22-foundation-followups.md`：

在「## 執行中做出的決定」的表格最後加兩列：

```markdown
| 報價只能經由函式寫入 | 計畫 3 起 `creator_rates` 收回 anon / authenticated 的 INSERT、UPDATE、DELETE，只能用 `set_creator_rates`；取消勾選的合作形式，報價由 `update_creator_public_profile` 一併刪除。 |
| 公開頁不快取 | `/c/[handle]` 每次請求以使用者自己的 client 讀取，因為審核狀態目前在 Studio 用 SQL 改、App 無法觸發 revalidate。找不到時回應碼是 200 + `noindex`（串流後才 `notFound()`，soft 404）。 |
```

把「### 3. 創作者公開檔案頁」整節換成：

```markdown
### 3. 創作者公開檔案頁
- 訪客（anon）讀不到 `profiles.display_name`；缺少頭像欄位 → 已完成（計畫 3：`get_public_creator` definer 函式、`avatar_path`）。評分、完成案數、準時率與評價資料表 → 移到計畫 6（公開頁目前固定顯示「新創作者・尚無評價」）。
- 收藏 ♡ 需要一張資料表 → 移到計畫 4。
- 計畫 2 Task 3 收回了 bio / style_tags / collab_types / engagement_rate 的直接 UPDATE → 已完成（計畫 3：`update_creator_public_profile`）。
- 計畫 3 新增的後續事項：
  - 計畫 9 加入 `set_creator_status()` 與核准的 Server Action 後，評估公開資料改用 `cacheTag('creator:<handle>')` 快取，並在核准、停權、創作者儲存時 `updateTag`。
  - `creator-media` 孤兒物件清理與 `brand-logos` 共用同一個排程（尚未實作）。
  - OG 圖片的頭像只支援 PNG／JPEG；WebP 頭像在 OG 圖片顯示名字首字。中文字型由 `next/og` 在請求時從 Google Fonts 下載，Google Fonts 連不到時中文會缺字。
  - `get_public_creator` 會回傳 `user_id`（頭像網址本來就含 user_id）。
  - 已登入的創作者點「品牌登入後可查看報價」會停在登入頁（同計畫 2「已登入造訪 /login」那一項）。
  - 公開頁 `metadataBase` 尚未設定：正式環境的 `og:image` 絕對網址依賴 Vercel 的預設網域；綁自訂網域時要在 root layout 設定 `metadataBase`。
```

「### 2. 登入與註冊」底下「品牌 Logo 孤兒物件清理排程尚未實作（見上方 Logo 注意事項）。」那一行改成：

```markdown
  - 品牌 Logo 孤兒物件清理排程尚未實作（見上方 Logo 注意事項）；計畫 3 的 `creator-media` 共用同一項。
```

「之後每個資料頁都必須呼叫 `requireRole`…」那一行後面加「（計畫 3 的 `/creator/me/profile` 與其 server action 已呼叫；公開頁 `/c/*` 刻意不呼叫）」。

- [ ] **Step 3: Commit 文件**

```bash
git add README.md docs/superpowers/plans/2026-11-22-foundation-followups.md
git commit -m "計畫 3 Task 9：README 與待辦同步（creator-media、公開頁不快取）"
```

- [ ] **Step 4: 本機端對端驗收（只用本機 Supabase，不碰正式環境）**

準備：
```bash
npx supabase migration up
npm run build && npx next start -H 127.0.0.1 -p 3000
```
另一個終端機產生測試圖，並建立截圖資料夾（截圖不 commit）：
```bash
E2E=$(mktemp -d)/kollink-p3-e2e && mkdir -p "$E2E"
sips -s format png -Z 512 /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns --out "$E2E/avatar.png" >/dev/null
for n in 1 2 3; do sips -s format jpeg -Z 800 /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns --out "$E2E/work$n.jpg" >/dev/null; done
echo "$E2E"
```

用瀏覽器實際操作（Mailpit http://127.0.0.1:54324 收驗證碼）。每個標「截圖」的步驟，在寬度 390（手機）與 1280（桌面）各截一張，存到上面印出的資料夾：

1. **創作者填資料並上傳**：用 `e2e-p3-creator@test.local` 在 `/signup?role=creator` 註冊 → 填資料（顯示名稱 `測試創作者`、handle `e2ep3creator`、IG `e2ep3creator`、粉絲 `12000`、台北市、美妝＋穿搭）→ `/creator/me` →「編輯公開頁」→ 上傳 `avatar.png`、自我介紹、風格標籤 `日系、簡約`、勾 IG 貼文與 Reels、互動率 `3.5`、受眾 `18-24` → 儲存；作品上傳 `work1.jpg`–`work3.jpg`，第一張連結 `https://www.instagram.com/p/ABC123/` → 儲存；報價 IG 貼文 `4500`、Reels `8000` → 儲存。截圖：`/creator/me/profile`。
2. **本人預覽（pending）**：點「查看我的公開頁」→ 上方顯示「審核通過後才會公開。」、沒有邀請按鈕、報價是鎖定區塊。檢查 `<head>` 有 `<meta name="robots" content="noindex, nofollow">`（開發者工具 Elements 搜尋 `robots`）。截圖：`/c/e2ep3creator`（本人）。
3. **未審核時訪客看不到**：開無痕視窗 http://127.0.0.1:3000/c/e2ep3creator → 顯示「找不到這位創作者」；http://127.0.0.1:3000/c/e2ep3creator/opengraph-image 回 404。
4. **用 SQL 核准**（Studio SQL Editor，直接複製）：
   ```sql
   update public.creator_profiles set status = 'approved'
     where handle = 'e2ep3creator' and ig_username = 'e2ep3creator';
   ```
   Expected：`UPDATE 1`。
5. **訪客看到公開頁與報價鎖定**：無痕視窗重新整理（不用等快取）→ 看到頭像、名稱、地區、內容領域、「新創作者・尚無評價」、粉絲 12,000、互動率 3.5%、受眾 18-24 歲、風格、3 張作品（第一張右上角有外連圖示，點了另開 IG 分頁）、想接的合作、「品牌登入後可查看報價」、「還沒有完成的合作」；手機版底部固定「邀請合作」、桌面版在右欄頂部；點「邀請合作」到 `/signup?role=brand`。手機寬度不能出現水平捲軸。截圖：`/c/e2ep3creator`（訪客）。
6. **品牌看到報價**：無痕視窗點「品牌登入後可查看報價」→ 網址是 `/login?next=%2Fc%2Fe2ep3creator` →「註冊」用 `e2e-p3-brand@test.local` 註冊品牌並填資料 → 再開 `/c/e2ep3creator`（另外用已註冊的品牌登出再從鎖定區塊登入一次，確認登入後直接回到 `/c/e2ep3creator`）→ 報價顯示「IG 貼文 NT$4,500」「Reels NT$8,000」，邀請按鈕是停用的「邀請合作（即將推出）」。截圖：`/c/e2ep3creator`（品牌）。
7. **OG 圖片**：開 http://127.0.0.1:3000/c/e2ep3creator/opengraph-image → 看到頭像、「測試創作者」、`@e2ep3creator`、「IG 粉絲 12,000」、美妝／穿搭膠囊、Kollink，中文不是方框。截圖一張（不分寬度）。再跑：
   ```bash
   curl -s -A "facebookexternalhit/1.1" http://127.0.0.1:3000/c/e2ep3creator | grep -o -E '<title>[^<]*</title>|<meta property="og:image" content="[^"]*"'
   ```
   Expected：`<title>測試創作者（@e2ep3creator）｜Kollink</title>`，`og:image` 含 `/c/e2ep3creator/opengraph-image`。
8. **停權立即下架**：
   ```sql
   update public.creator_profiles set status = 'suspended' where handle = 'e2ep3creator';
   ```
   無痕視窗重新整理 → 「找不到這位創作者」；創作者本人看自己的頁 → 「帳號已暫停，公開頁目前不會顯示給其他人。」。驗完改回：
   ```sql
   update public.creator_profiles set status = 'approved' where handle = 'e2ep3creator';
   ```

- [ ] **Step 5: 全部檢查與清理種子資料**

```bash
npm run lint && npm run typecheck && npm test && npm run build && npx supabase test db
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "delete from auth.users where id = '00000000-0000-0000-0000-00000000c0de';"
git status --short
```
Expected：全部通過（pgTAP 337 個）；`DELETE 1`（Task 5 的 `p3seed` 種子，連帶刪掉檔案與報價）；`git status` 乾淨（截圖不在 repo 裡）。把截圖資料夾路徑與每張截圖的檔名回報給 controller。

---

## 完成後（controller 執行，不是 task）

1. **端對端驗收複查**：派一個沒參與實作的 subagent，看 Task 9 Step 4 的截圖，對照 spec「頁面內容」逐項檢查（手機 390、桌面 1280）。
2. **全分支最終審查**：review package 用 `git merge-base main HEAD` 為起點。
3. 開 PR（base 為 `main`）。
