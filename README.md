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

本機 `npm run dev` 且 `NEXT_PUBLIC_SUPABASE_URL` 指向 `127.0.0.1` 或 `localhost` 時，登入頁下方會出現「測試快速登入」，按「測試品牌」「測試創作者」或「測試管理員」就能直接登入，不用收驗證碼（帳號 `dev-brand@kollink.test`、`dev-creator@kollink.test`、`dev-admin@kollink.test`，第一次按會自動建立；創作者直接是已審核狀態，管理員沒有品牌或創作者資料、登入後到 `/admin`）。正式建置（`NODE_ENV=production`）或連到雲端專案時不會顯示，API 也回 404。需要 `.env.local` 有 `SUPABASE_SECRET_KEY`。

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

## 管理後台（/admin）

審核創作者、合作案總覽、人工標記已付款、撥款、退款、付款異常、違規訊息都在 `/admin` 操作。每個動作都經由資料庫函式並寫 audit log；下面的 SQL 只在後台無法使用時備用。

### 新增管理員（只用 SQL）

1. 請對方先用要當管理員的 Email 登入一次（建議用專用的 Email，不要填品牌或創作者資料；沒有資料的管理員帳號登入後會直接到 `/admin`）。
2. 在 Supabase Studio 的 SQL Editor 執行（只改 `填入…`，直接複製、不要手打）：
```sql
insert into public.admins (user_id)
select id from auth.users where email = lower('填入管理員的 Email')
on conflict (user_id) do nothing
returning user_id;
```
有一列 `user_id` 就完成了。沒有任何列：Email 打錯、對方還沒登入過，或本來就是管理員。

移除管理員：
```sql
delete from public.admins
 where user_id = (select id from auth.users where email = lower('填入管理員的 Email'))
returning user_id;
```

管理員若同時是某個合作案的品牌或創作者，那個合作案只能以參與者身分操作，後台不會顯示管理員動作（請另一位管理員處理）。管理員也不能處理自己（核准、停權自己的創作者資料、標記自己的訊息已檢視會回 `admin is subject`）。

本機開發：登入頁的「測試管理員」（`dev-admin@kollink.test`，見上方「測試快速登入」）。

### 審核創作者

`/admin/creators`：打開 IG，確認自我介紹裡有驗證碼、粉絲數合理，再按「核准」。不通過按「退回」並寫原因（創作者看得到，修正後可以重新送審）。停權（原因必填，創作者看得到）會讓公開頁下架、所有對話暫停；「解除停權」恢復。

**備用 SQL**（後台無法使用時；`填入網址代稱` 從 Studio 的 `creator_profiles` 複製）。動作是 `approve`（核准）、`reject`（退回）、`suspend`（停權）、`unsuspend`（解除停權）；退回與停權要填原因，核准與解除填 `null`：
```sql
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.set_creator_status(
  (select cp.user_id from public.creator_profiles cp where cp.handle = '填入網址代稱'),
  'approve',
  null
) as result;
commit;
```
`result` 是新的狀態就完成了。`creator not found`：網址代稱打錯；`admin is subject`：不能處理自己；`creator status changed`：目前的狀態不能做這個動作（例如已審核的不能退回）。

### 修改已鎖定的網址代稱（handle）

審核通過（或停權）後，handle 會被鎖定，創作者自己不能改（退回不會鎖定）。管理員要改時，必須以 postgres 身分、在**同一個 transaction** 內先開旗標：
```sql
begin;
set local kollink.allow_handle_change = 'on';
update public.creator_profiles set handle = '新代稱' where handle = '舊代稱';
commit;
```

### 查詢後台的操作紀錄

```sql
select l.created_at at time zone 'Asia/Taipei' as 台灣時間, l.actor_kind as 身分, u.email as 管理員,
       l.action as 動作, left(l.collaboration_id::text, 8) as 案號, s.email as 對象, l.note as 說明
  from public.audit_logs l
  left join auth.users u on u.id = l.actor_id
  left join auth.users s on s.id = l.subject_id
 where l.actor_kind in ('admin', 'system')
    or l.action in ('payout_account_updated', 'creator_resubmit')
 order by l.created_at desc
 limit 200;
```

## 合作案的付款與撥款

案號 = 合作案 id 的前 8 碼，顯示在合作案詳情的標題區。

### 線上付款（綠界）

- 品牌在合作案詳情（等待付款）選「信用卡」或「ATM 轉帳」，按「確認並付款」後整頁轉到綠界付款頁。款項全額給創作者，平台不收手續費；不開電子發票。
- 付款狀態只以綠界的伺服器通知為準（`/api/payments/ecpay/notify`）。ATM 的取號結果由 `/api/payments/ecpay/payment-info` 接收，品牌在詳情頁看到銀行代碼、虛擬帳號與期限（3 天，到期日 23:59 截止）；轉帳後才進入交稿。
- 單筆上限 NT$200,000（`src/lib/payments/limits.ts` 與 `create_payment_order`，實際限額以綠界合約為準）。超過上限、或綠界通知遺失（綠界一天最多重送 4 次）時，用下方「人工標記已付款」。
- 環境變數（只在伺服器端，**絕對不要加 `NEXT_PUBLIC_`**）：

| 變數 | 測試環境（現在） | 正式環境（之後） |
|---|---|---|
| `ECPAY_ENV` | `stage` | `prod` |
| `ECPAY_MERCHANT_ID` | `3002607` | 綠界給的特店編號 |
| `ECPAY_HASH_KEY` | `pwFHCqoQZGmho4w6` | 綠界給的 HashKey |
| `ECPAY_HASH_IV` | `EkRm7iFT261dpevs` | 綠界給的 HashIV |
| `SITE_URL` | 本機 `http://localhost:3000` | `https://kollink.vercel.app` |

測試環境的值是綠界公開的（https://developers.ecpay.com.tw/2856/）。**正式環境的值不要寫進 repo、文件或對話。** 少任何一個變數時「確認並付款」會停用並顯示說明；`ECPAY_ENV=prod` 搭配測試商店 3002607 也會停用。

**目前決定：正式站在拿到綠界正式金鑰前不開付款。** Vercel 的 Production 與 Preview 都**不要**設任何 `ECPAY_*`（測試金鑰只在本機驗證）。程式另有一道保險：在 Vercel 的正式環境（`VERCEL_ENV=production`，或在 Vercel 上 `VERCEL=1` 且 `VERCEL_ENV` 為空）上，只要 `ECPAY_ENV` 不是 `prod`、或用到公開的測試商店，一律視為「未設定」（付款按鈕停用、通知 route 不接受測試環境的簽章）。這道保險靠 Vercel 的系統環境變數 `VERCEL_ENV`，所以專案設定的「Enable access to System Environment Variables」必須保持開啟（預設就是開）；即使 `VERCEL_ENV` 讀不到，只要 `VERCEL=1` 也會當成正式環境。

**絕對不要把測試金鑰放在任何連到正式 Supabase 專案的部署上**：測試金鑰是公開的，任何人都能偽造付款通知。

**測試模式**（`ECPAY_ENV=stage`）：不會真的扣款。測試卡 `4311-9522-2222-2222`，有效月年填晚於現在的值，安全碼任意三碼，3D 驗證碼固定 `1234`。測試金鑰是公開的，任何人都能偽造付款通知，所以測試付款在畫面上標「測試付款（未實際收款）」，下方的撥款 SQL 會拒絕。綠界的測試廠商後台（網址與公開帳號見上面的測試介接資訊頁）可以對 ATM 單按「模擬付款」。

本機開發時綠界的伺服器連不到 `localhost`（綠界只會把通知送到 80／443 埠，本機的 http 與 3000 埠收不到），付款後狀態不會自動改變；用「標記已付款（本機）」按鈕，或照計畫 8 的 E2E 用簽好的通知測試。要驗證真實的伺服器通知，之後用通道（tunnel）或預覽部署，並且只連本機或測試用的 Supabase。

**拿到正式金鑰、準備上線時**：向綠界申請正式特店（依公司規定，API 串接申請可以一併跟 Ken 哥說），拿到 MerchantID／HashKey／HashIV 後，**只在 Vercel Production** 設 `ECPAY_ENV=prod`、`ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV` 與 `SITE_URL=https://kollink.vercel.app`，重新部署。上線前向綠界確認單筆限額，必要時一起改 `PAYMENT_MAX_TWD` 與 `create_payment_order`。Preview 不設；測試金鑰永遠不要放到連正式 Supabase 的部署上。

### 人工標記已付款

只在「超過線上付款上限、品牌線下匯款」或「綠界已扣款、但我們沒收到通知」時使用。到 `/admin/collabs/<id>`（或在 `/admin/collabs` 用案號搜尋）的「平台處理」：

- **線下付款**（`awaiting_payment` → `awaiting_submission`）：確認款項入帳後按「標記已付款（線下付款）」，說明寫匯款日期與帳號末五碼（只有管理員看得到）。系統會建一張 `MAN` 開頭的付款單，再走 `record_payment_success`。
- **綠界已扣款但沒收到通知**（綠界一天最多重送 4 次）：先在綠界廠商後台查這張 `KL` 開頭的付款單，確認交易成功；在對應的表單填綠界交易編號與後台顯示的金額。金額與付款單不符時不會標記已付款，而是記成付款異常（來源標為 `admin`）。付款環境用這個部署的 `ECPAY_ENV`（綠界未設定時後台會拒絕，改用下面的備用 SQL）。

**備用 SQL：線下付款**（`填入案號` 是 8 碼案號；找到不只一個合作案時會報錯，整段不會生效）：
```sql
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.admin_record_offline_payment(
  (select c.id from public.collaborations c where c.id::text like lower('填入案號') || '%'),
  '填入說明'
) as result;
commit;
```

**備用 SQL：綠界已扣款但沒收到通知**（環境：正式金鑰的付款填 `prod`，測試環境的付款填 `stage`）：
```sql
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.admin_record_lost_payment(
  '填入KL開頭的付款單號',
  '填入綠界交易編號',
  填入金額,
  'prod',
  '填入說明'
) as result;
commit;
```
`result` 是 `paid` 就完成了；`anomaly`：金額不符，已記成付款異常；`paid_refund_required`：合作案已經不在等待付款，款項標記為需退款。

### 撥款

`/admin/payments` 的「待撥款」列出所有 `awaiting_payout` 的合作案（等最久的在前）。點進合作案：

1. 「平台處理」的撥款區顯示創作者的完整收款帳戶（銀行代碼、分行、帳號、戶名；打開這一頁會記錄查看）。帳戶 7 天內改過會有紅字提醒，轉帳前先跟創作者確認。
2. 在銀行轉帳（金額 = 合作案金額，平台不收手續費）。
3. 按「已轉帳，標記撥款」，寫轉帳說明（日期、轉出帳戶、交易序號；只有管理員看得到）。合作案結案，雙方看到「平台已撥款，合作完成」。

不能撥款的情況（畫面會寫原因，資料庫也會擋）：測試付款（綠界測試環境，沒有實際收款）、有待退款的款項、創作者還沒填收款帳戶（請創作者到「我的 → 收款帳戶」填寫）。

**備用 SQL：查完整帳戶、標記撥款**：
```sql
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select * from public.admin_get_payout_account(
  (select c.id from public.collaborations c where c.id::text like lower('填入案號') || '%'));
commit;
```
轉帳後：
```sql
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.admin_mark_payout(
  (select c.id from public.collaborations c where c.id::text like lower('填入案號') || '%'),
  '填入轉帳說明',
  '填入帳號末四碼'
);
commit;
```
`填入帳號末四碼` 是上一步看到的帳號最後 4 碼（資料庫用它確認撥款前創作者沒改過收款帳戶）。沒有錯誤就結案了。`payout account changed`：帳戶在你查看之後被改過，重新查詢帳戶再撥款。`test payment cannot be paid out`、`payout account missing`、`refund pending`：見上面不能撥款的情況。

### 平台取消（爭議處理）

合作案詳情的「平台取消」：任何還沒結束的合作案都可以取消，原因必填（雙方在事件裡看得到「平台取消合作：原因」）。已付款的款項會自動標記為需退款，之後照下面「退款」處理。只做全額退款。

### 退款（實際退款在綠界後台）

合作案取消後才到款、同一個合作案付了兩次、或平台取消已付款的合作案時，款項會標記「需退款」。`/admin/payments` 的「需退款」列出這些款項：在綠界廠商後台用付款單號辦理退款（信用卡可以刷退；ATM 無法原路退回，要向品牌取得帳號另外轉帳），完成後按「已退款」寫說明（方式與日期）。雙方的事件會多一筆「平台已退回一筆額外的付款」。

**備用 SQL**（`填入付款單` 是 `payments.id`）：
```sql
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.resolve_payment_refund('填入付款單'::uuid, '填入說明');
commit;
```

### 付款異常

金額不符、找不到付款單等異常不會讓綠界一直重送，而是記下來（Vercel log 也有 `ecpay notify: payment anomaly recorded`）。合作案的事件顯示「平台正在確認一筆付款」。`/admin/payments` 的「付款異常」列出未處理的異常：在綠界後台確認實際情況並處理（例如退款，或確認款項無誤後用上面的「綠界已扣款但沒收到通知」），再按「已處理」寫說明。

**備用 SQL**（`填入異常` 是 `payment_anomalies.id` 數字）：
```sql
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.resolve_payment_anomaly(填入異常, '填入說明');
commit;
```

本機開發另有「標記已付款（本機）」按鈕（開關與測試快速登入相同，正式環境不會出現、`/api/dev/mark-paid` 回 404），走的也是 `record_payment_success`。

## 站內訊息

- 品牌在創作者公開頁按「傳訊息」開啟對話；創作者不能主動開啟，只能在已有的對話裡回覆（由品牌傳訊息、錄取或邀請建立）。
- 訊息含電話、Email、LINE ID 或外部連結時，送出前會提醒；仍可送出，資料庫會自動標記 `flagged_contact`。管理員在 `/admin/messages` 看未檢視的訊息、按「標記已檢視」；需要處理時到「創作者審核」停權，或到合作案「平台取消」。
- 創作者停權（`creator_profiles.status = 'suspended'`）時，他的所有對話自動暫停：雙方都看得到歷史訊息，但不能再送。解除停權就恢復。
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

**部署順序：先推資料庫，再合併 PR。** Vercel 在 `main` 合併後立刻部署；新版程式會呼叫新 migration 建立的函式（例如計畫 4 的 `search_creators`、計畫 5 的 `save_brief`、`list_opportunities`，`20261124000500_briefs.sql`、`20261124000600_brief_covers.sql`，計畫 6 的 `20261125000100_collab_create.sql`、`20261125000200_deliverables.sql`、`20261125000300_collab_reads.sql`、`20261125000400_collab_review_fixes.sql`，計畫 7 的 `20261126000100_messaging_write.sql`、`20261126000200_messaging_reads.sql`、`20261126000300_messaging_review_fixes.sql`、`20261126000400_messaging_creator_first_message.sql`，計畫 8 的 `20261127000100_payment_orders.sql`、`20261127000200_payment_review_fixes.sql`），資料庫還沒更新時 `/brand`、`/brand/briefs`、`/creator` 會出錯。所以每次 PR 有新 migration 時，先執行上面的 `npx supabase db push --remote`，確認成功後再合併。計畫 6 起還要在合併前把 CRON_SECRET 加到 Vercel（見「部署（Vercel）」）。計畫 8 的付款在拿到綠界正式金鑰前不在正式站開啟：Vercel 不設 `ECPAY_*`，付款按鈕會停用（見「合作案的付款與撥款」）。

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

計畫 8 推資料庫前的檢查（只讀，在正式資料庫的 SQL Editor 執行）：

```sql
select count(*) as blank_trade_no from public.payments
 where provider_trade_no is not null and btrim(provider_trade_no) = '';                           -- 必須是 0
select count(*) as refund_required from public.payments where refund_required;                    -- 只是看看
```

第一個必須是 0（`20261127000100_payment_orders.sql` 新增「交易編號不能只有空白」的限制）。第二個不是 0 代表之前就有需退款的款項，上線後用 README「退款」的 SQL 處理。

計畫 8 合併後的煙霧測試（正式站；Vercel 沒有 `ECPAY_*`）：用測試品牌帳號開一個「等待付款」的合作案，詳情頁的「確認並付款」應該是停用狀態並顯示付款尚未開放的說明；`/api/payments/ecpay/notify` 收到任何請求都不會改變合作案狀態。完整的付款流程（測試卡、ATM 模擬付款）只在本機用測試環境驗證，等正式金鑰設好後再用小額真實付款做一次煙霧測試。

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

`SUPABASE_SECRET_KEY`、`ECPAY_*` 絕對不可加 `NEXT_PUBLIC_` 前綴。

綠界變數（`ECPAY_ENV`、`ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`）與 `SITE_URL` **目前不要設**（正式站在拿到綠界正式金鑰前不開付款，Preview 也不設；測試金鑰只在本機使用）。上線時只加到 **Production**，值見「合作案的付款與撥款」，改了要重新部署。程式在 `VERCEL_ENV=production` 上會拒絕測試環境與公開測試商店，這需要 Vercel 的「Enable access to System Environment Variables」保持開啟。

`CRON_SECRET`：審核逾期自動通過的 Vercel Cron（`vercel.json`：每天 UTC 01:00 = 台灣 09:00 呼叫 `/api/cron/auto-approve`）。值用一串夠長的亂數（例如 `openssl rand -hex 32` 的結果），加到 **Production** 環境。Vercel 會自動在 cron 請求帶 `Authorization: Bearer <CRON_SECRET>`；沒設定時 route 一律回 500，不會自動通過任何合作案。Hobby 方案的 Cron 一天只跑一次、而且可能在該小時內任何時間觸發（UTC 01:00–01:59，台灣 09:00–09:59），所以實際是「審核期限到了之後最晚隔天自動通過」。本機在 `.env.local` 隨便設一個值即可，手動測試：

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/auto-approve
```

### 計畫 9（管理後台）上線

1. 合併前：`npx supabase db push --remote`（`20261128000100_admin_core.sql`、`20261128000200_admin_money.sql`、`20261128000300_admin_review_fixes.sql`、`20261128000400_admin_refund_participant_guard.sql`，依序）。migration 會改 `transition_collaboration`：之後撥款只能經由後台或 `admin_mark_payout`（舊的撥款 SQL 會報 `invalid transition`）；`admin_mark_payout` 現在要帶帳號末四碼。
2. 合併後：照「管理後台 → 新增管理員」把營運人員的帳號加進 `admins`，用該帳號登入確認進得了 `/admin`。
3. 通知所有已審核的創作者到「我的 → 收款帳戶」填寫（沒有帳戶時不能撥款）。目前 `awaiting_payout` 的合作案在創作者填好前會顯示「創作者還沒填收款帳戶」。
