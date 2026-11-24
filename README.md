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

### 修改已鎖定的網址代稱（handle）

審核通過（或曾離開 pending）後，handle 會被鎖定，創作者自己不能改。管理員要改時，必須以 postgres 身分、在**同一個 transaction** 內先開旗標：
```sql
begin;
set local kollink.allow_handle_change = 'on';
update public.creator_profiles set handle = '新代稱' where handle = '舊代稱';
commit;
```

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
9. 排程清理沒被引用的 `brand-logos` 物件，見 `docs/superpowers/plans/2026-11-22-foundation-followups.md`。

## 部署（Vercel）

Vercel 專案 `kollink` 已建立並連到 GitHub，正式分支是 `main`，正式網址為 https://kollink.vercel.app 。

在 Vercel 專案的 Settings → Environment Variables 設定（值不要寫進 repo）：

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
```

`SUPABASE_SECRET_KEY` 絕對不可加 `NEXT_PUBLIC_` 前綴。綠界相關變數（`ECPAY_*`）等計畫 8 上線付款時再加。
