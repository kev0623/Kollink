# Kollink

台灣品牌 × 創作者合作平台。

## 本機開發

需要：Node 22（見 `.nvmrc`）、Docker Desktop（先啟動）。

```bash
npm install
npx supabase start                 # 第一次會下載 Docker 映像，需要幾分鐘
npx supabase status -o env         # 取得 PUBLISHABLE_KEY、SECRET_KEY
cp .env.example .env.local         # 把上面兩個值填進 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY、SUPABASE_SECRET_KEY
npm run dev                        # http://127.0.0.1:3000
```

`.env.local` 不要 commit，也不要把實際金鑰貼進文件或對話。

| 用途 | 網址 / 指令 |
|---|---|
| 收驗證碼信（本機不會真的寄出） | http://127.0.0.1:54324 （Mailpit） |
| Supabase Studio | http://127.0.0.1:54323 |
| 在本機跑正式版建置 | `npm run build && npx next start` |
| 單元測試 | `npm test` |
| 資料庫測試 | `npm run test:db` |
| 改了 migration 後重新產生型別 | `npm run db:types` |
| 拉到新的 migration 後 | `npx supabase migration up`（或 `npx supabase db reset`）；`supabase stop/start` 會沿用舊的資料庫，不會套用新 migration |

### 測試快速登入（只在本機）

本機 `npm run dev` 且 `NEXT_PUBLIC_SUPABASE_URL` 指向 `127.0.0.1` 或 `localhost` 時，登入頁下方會出現「測試快速登入」，按「測試品牌」或「測試創作者」就能直接登入，不用收驗證碼（帳號 `dev-brand@kollink.test`、`dev-creator@kollink.test`，第一次按會自動建立，創作者直接是已審核狀態）。正式建置（`NODE_ENV=production`）或連到雲端專案時不會顯示，API 也回 404。需要 `.env.local` 有 `SUPABASE_SECRET_KEY`。

## 登入方式

- Email 6 位數驗證碼（OTP），有效 15 分鐘。本機的信在 Mailpit 看。
- Google 登入只在 `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` 時顯示按鈕（設定見下節）。
- 不支援密碼登入：`auth.users` 上的 trigger 會把 `encrypted_password` 清成 null，`password_verification_attempt` hook 在方案允許時再多擋一層。介面上不可以出現「設定密碼」。

## 設定 Google 登入（選擇性）

沒設定時 Email 驗證碼登入照常可用。請在**個人的** GCP 專案操作，不要用公司的專案。

1. 打開 https://console.cloud.google.com/ ，建立新專案（名稱例如 `kollink-dev`）。
2. 「API 和服務」→「OAuth 同意畫面」：User Type 選「外部」，填應用程式名稱 `Kollink`、你的 Email，其他先留空，儲存。
3. 「憑證」→「建立憑證」→「OAuth 用戶端 ID」：應用程式類型選「網頁應用程式」。
4. 「已授權的重新導向 URI」新增下面這一行（直接複製，不要手打）：
   ```
   http://127.0.0.1:54321/auth/v1/callback
   ```
5. 建立後，把「用戶端 ID」和「用戶端密鑰」填進 `.env.local`：
   ```
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=貼上用戶端 ID
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=貼上用戶端密鑰
   NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true
   ```
6. 把 `supabase/config.toml` 裡 `[auth.external.google]` 的 `enabled = false` 改成 `enabled = true`（這個改動不要 commit）。
7. 重新啟動 Supabase（要讀入新的環境變數）：
   ```bash
   npx supabase stop && set -a && source .env.local && set +a && npx supabase start
   ```
   然後重新執行 `npm run dev`。

正式環境的 Google 設定見下面的檢查清單。

## 審核創作者（管理後台完成前）

在 Supabase Studio 的 SQL Editor 執行（直接複製）。本機也可以用 psql 連線：
```
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

先列出待審核的創作者與 IG 驗證碼：
```sql
select cp.handle, cp.ig_username, cp.follower_count, v.code, cp.created_at
from public.creator_profiles cp
join public.creator_verifications v on v.user_id = cp.user_id
where cp.status = 'pending'
order by cp.created_at;
```

打開 `https://www.instagram.com/<ig_username>/`，確認自我介紹裡有驗證碼、粉絲數合理，然後執行下面的核准指令。`handle` 與 `ig_username` 請直接從上面查詢結果複製，不要照創作者填的內容手打，因為 handle 儲存時會被正規化（例如填 `e2e-handle-one` 會存成 `e2ehandleone`）：
```sql
update public.creator_profiles set status = 'approved'
  where handle = '填入網址代稱' and ig_username = '填入你確認過的 IG 帳號';
```
結果顯示 `UPDATE 0` 代表沒有任何列被更新，原因是兩者之一：handle 或 ig_username 打錯（請從查詢結果複製），或創作者在審核期間改了 IG 帳號（改 IG 會退回審核並換新驗證碼），請重新查詢並確認新的 IG 與驗證碼後再核准。

核准後公開頁 `/c/<handle>` 立刻對所有人顯示（公開頁不快取）；把 `status` 改成 `suspended` 也會立刻下架。

### 修改已鎖定的網址代稱（handle）

審核通過（或曾離開 pending）後，handle 會被鎖定，創作者自己不能改。管理員要改時，必須以 postgres 身分、在**同一個 transaction** 內先開旗標：
```sql
begin;
set local kollink.allow_handle_change = 'on';
update public.creator_profiles set handle = '新代稱' where handle = '舊代稱';
commit;
```

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

## 正式環境（Hosted Supabase）設定

正式專案：`Kollink`（東京，project ref `gujmnohzmivnaxdxpdjn`）。

推資料庫結構到正式專案（在自己的終端機視窗執行；`link` 會要資料庫密碼）：

```
npx supabase login
npx supabase link --project-ref gujmnohzmivnaxdxpdjn
npx supabase db push --remote
```

CLI 3.x 的 `db push` 預設推到本機，一定要加 `--remote`。**不要執行 `supabase config push`**：本機 `config.toml` 的網址是 `127.0.0.1`，推上去會把正式環境的登入導向設錯。

雲端新專案不會自動把 public 資料表授權給 API 角色（本機會），所以權限一律寫在 migration 裡（見 `20261124000100_explicit_api_grants.sql`）。之後新增資料表時，要在同一個 migration 寫明 `grant`。

創作者頭像與作品的 Storage bucket `creator-media` 由 migration `20261124000300_creator_media.sql` 建立，執行上面的 `npx supabase db push --remote` 就會一起建好，不用在後台手動建立 bucket 或 policy。這個 bucket 是公開的：未審核創作者的圖片網址如果被猜到也看得到（路徑含 UUID，很難猜），這是已接受的取捨。

招募封面的 Storage bucket `brief-covers` 由 migration `20261124000600_brief_covers.sql` 建立（公開、5 MB、只接受 JPG／PNG／WebP，只有品牌能上傳到自己的資料夾），同樣隨 `db push --remote` 一起建好。

交稿檔案的 Storage bucket `deliverables` 由 migration `20261125000200_deliverables.sql` 建立（**私密**、每個檔案 50 MB、只接受 JPG／PNG／WebP／MP4／MOV／PDF；只有該合作案的品牌、創作者與管理員讀得到，畫面用 1 小時的 signed URL），同樣隨 `db push --remote` 一起建好。Supabase 專案的全域檔案上限（Storage → Settings）必須至少 50 MB，否則大檔案會被擋。

站內訊息的即時更新用 Supabase Realtime：migration `20261126000100_messaging_write.sql` 會把 `messages` 加進 `supabase_realtime` publication，隨 `db push --remote` 一起生效。推完後到 Dashboard → Database → Publications 確認 `supabase_realtime` 包含 `messages`。不需要新的環境變數。

`20261124000500_briefs.sql` 會把 `briefs.cover_url` 改名為 `cover_path`。它開頭有保護檢查：**正式資料庫的 `briefs` 只要有任何一列，migration 就會停下來**（錯誤訊息 `briefs has rows …`）。目前沒有任何程式寫入招募，所以應該是 0 筆；如果真的停下來，先確認資料、手動搬移後再推。

**部署順序：先推資料庫，再合併 PR。** Vercel 在 `main` 合併後立刻部署；新版程式會呼叫新 migration 建立的函式（例如計畫 4 的 `search_creators`、計畫 5 的 `save_brief`、`list_opportunities`，`20261124000500_briefs.sql`、`20261124000600_brief_covers.sql`，計畫 6 的 `20261125000100_collab_create.sql`、`20261125000200_deliverables.sql`、`20261125000300_collab_reads.sql`、`20261125000400_collab_review_fixes.sql`，計畫 7 的 `20261126000100_messaging_write.sql`、`20261126000200_messaging_reads.sql`、`20261126000300_messaging_review_fixes.sql`、`20261126000400_messaging_creator_first_message.sql`），資料庫還沒更新時 `/brand`、`/brand/briefs`、`/creator` 會出錯。所以每次 PR 有新 migration 時，先執行上面的 `npx supabase db push --remote`，確認成功後再合併。計畫 6 起還要在合併前把 CRON_SECRET 加到 Vercel（見「部署（Vercel）」）。

計畫 6 推資料庫前的檢查（只讀，在正式資料庫的 SQL Editor 執行）：

```sql
select count(*) as accepted_without_collab from public.brief_applications a
 where a.status = 'accepted'
   and not exists (select 1 from public.collaborations c where c.brief_id = a.brief_id and c.creator_id = a.creator_id);
select brief_id, creator_id, count(*) from public.collaborations
 where brief_id is not null group by 1, 2 having count(*) > 1;
```

第一個查詢必須是 0：不是 0 代表有「已錄取但沒有合作案」的報名（舊版的錄取按鈕只改報名狀態），這些品牌需要改用「直接邀請」。第二個查詢必須沒有任何列：有列代表同一則招募、同一位創作者有多個合作案，`20261125000100_collab_create.sql` 建立唯一索引時會失敗，需先手動處理重複的合作案再推。

計畫 7 推資料庫前的檢查（只讀，在正式資料庫的 SQL Editor 執行）：

```sql
select count(*) as too_long from public.messages where char_length(body) > 2000;                 -- 必須是 0
select count(*) as has_pub from pg_publication where pubname = 'supabase_realtime';               -- 必須是 1
select count(*) as already_in_pub from pg_publication_tables
 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages';         -- 必須是 0
select count(*) as old_policy from pg_policies
 where schemaname = 'public' and tablename = 'messages' and policyname = 'messages_insert_participant'; -- 必須是 1
```

依序代表：沒有超過 2000 字的舊訊息（新的長度檢查才不會讓 migration 失敗）；`supabase_realtime` publication 存在；`messages` 還沒被加進去（`20261126000100` 會加，重複加會報錯）；舊的 insert policy 還在（`20261126000100` 會 drop，不在會報錯）。

計畫 7 推完並合併後的煙霧測試：Supabase Dashboard → Realtime → Settings 必須允許公開頻道（public channels，不能只開 private-only）；用兩個帳號（品牌與創作者）互傳訊息，確認對方畫面即時出現新訊息、導覽列的未讀徽章也會更新。

本機的 `config.toml` 不會自動套用到正式專案，上線前在 Supabase 後台逐項設定：

1. Authentication → Providers → Email：開啟「Confirm email」（`enable_confirmations`）；Email OTP 長度 6、有效期限 900 秒（`otp_expiry = 900`）。注意後台預設是 8 碼、3600 秒，一定要改。
2. Authentication → Sign In / Providers：關閉匿名登入（anonymous sign-ins）。
3. 密碼登入封鎖：真正的保證是 migration 裡的 `null_encrypted_password` trigger（推送 migration 即生效，不受方案限制）。另外在 Authentication → Hooks 新增 Postgres hook「Password verification attempt」指向 `public.hook_reject_password`，作為第二層防護（方案允許才有）。
4. Authentication → URL Configuration：Site URL 填正式網址；Redirect URLs 加入下面這行（`<site>` 換成正式網址）：
   ```
   https://<site>/auth/callback**
   ```
5. Authentication → Emails：要先完成第 6 項的自訂 SMTP 才能改範本（預設範本寄的是登入連結，不是 6 碼驗證碼，登入頁會無法使用）。「Magic Link」與「Confirm signup」兩個範本都換成 `supabase/templates/otp.html`（主旨分別為 `Kollink 登入驗證碼`、`Kollink 註冊驗證碼`）。
6. Authentication → SMTP Settings：設定自訂 SMTP（例如 Resend）。內建寄信上限約每小時 2 封，不能用於正式環境。
7. Authentication → Attack Protection：建議開啟 CAPTCHA（Turnstile 或 hCaptcha），並在登入頁加上對應元件。
8. Google OAuth：Providers → Google 填入用戶端 ID／密鑰；Google Cloud Console 的重新導向 URI 加上 `https://<專案>.supabase.co/auth/v1/callback`。
9. 排程清理沒被引用的 Storage 物件：`brand-logos`（沒被 `brand_profiles.logo_path` 引用）、`creator-media`（沒被 `creator_profiles.avatar_path`、`creator_portfolio_items.image_path` 引用）`brief-covers`（沒被 `briefs.cover_path` 引用）與 `deliverables`（沒被任何 `collaboration_submissions.file_paths` 引用的，例如上傳後沒有交稿），都只刪超過 24 小時的，見 `docs/superpowers/plans/2026-11-22-foundation-followups.md`。

## 部署（Vercel）

Vercel 專案 `kollink` 已建立並連到 GitHub，正式分支是 `main`，正式網址為 https://kollink.vercel.app 。

在 Vercel 專案的 Settings → Environment Variables 設定（值不要寫進 repo）：

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
CRON_SECRET
```

`SUPABASE_SECRET_KEY` 絕對不可加 `NEXT_PUBLIC_` 前綴。綠界相關變數（`ECPAY_*`）等計畫 8 上線付款時再加。

`CRON_SECRET`：審核逾期自動通過的 Vercel Cron（`vercel.json`：每天 UTC 01:00 = 台灣 09:00 呼叫 `/api/cron/auto-approve`）。值用一串夠長的亂數（例如 `openssl rand -hex 32` 的結果），加到 **Production** 環境。Vercel 會自動在 cron 請求帶 `Authorization: Bearer <CRON_SECRET>`；沒設定時 route 一律回 500，不會自動通過任何合作案。Hobby 方案的 Cron 一天只跑一次、而且可能在該小時內任何時間觸發（UTC 01:00–01:59，台灣 09:00–09:59），所以實際是「審核期限到了之後最晚隔天自動通過」。本機在 `.env.local` 隨便設一個值即可，手動測試：

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/auto-approve
```
