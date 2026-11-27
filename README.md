# Kollink

台灣品牌 × 創作者合作平台。

## 技術

Next.js 16（App Router、`cacheComponents`）、React 19、Tailwind v4、Supabase（Postgres、Auth、Realtime、Storage）、綠界金流。介面主題「紅線」：首頁、登入／註冊、創作者公開頁有一條 3D 紅線（`three`，0.187.0），只在這三類頁面動態載入（`requestIdleCallback` 之後才 import）；品牌後台、創作者後台、管理後台不載入 three。`prefers-reduced-motion: reduce` 時不載入、改用靜態 SVG。

## 設計系統

- **Token**：`src/app/globals.css`。深色是預設；淺色在 `[data-theme="light"]` 與 `@media (prefers-color-scheme: light)` 兩段，兩段必須完全一致（`src/app/theme-tokens.test.ts` 會檢查）。顏色只用 token class，不寫色碼。
- **共用元件**：`src/components/ui/`（`PageHeader`、`EmptyState`、`Notice`、`FilePicker`、`SupportLink`、`Skeleton` 等）與 `src/components/ui/styles.ts`（`btn`、`input`、`textarea`、`chip`、`rows`、`cardPad`、`h1`、`h2`、`textLink`）。
- **按鈕**：主要動作一律 `btn.primary`（紅）；破壞性動作 `btn.danger`，並用 `ConfirmAction`（頁面內確認，不用瀏覽器 `confirm()`；後台用 `NoteAction`）。`bg-ink text-on-ink` 只用在選中的篩選標籤。
- **3D**：`src/components/thread/`；只有 `thread-scene.ts` 可以 import `three`。
- **主題切換**：`ThemeSelect`（跟隨系統／深色／淺色，存在 `localStorage` 的 `kollink-theme`）；`<html data-theme>` 由 `<head>` 內的腳本在第一次繪製前設定，不會閃。
- 設計規格：`docs/superpowers/specs/2026-11-27-ui-upgrade-design.md`。

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
- Google 登入只在 `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` 時顯示按鈕（本機設定見下節，正式環境見「社群登入設定」）。
- LINE 登入只在 `NEXT_PUBLIC_LINE_AUTH_ENABLED=true` 且伺服器有 `LINE_CHANNEL_ID`、`LINE_CHANNEL_SECRET` 時可用（見「社群登入設定 → LINE 登入」）。
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

## 社群登入設定

登入頁的社群登入按鈕（LINE、Google）都由環境變數控制，預設關閉；關閉時只有 Email 驗證碼登入。設定好之後新使用者照樣走「選身分 → 建立資料」的流程，管理員用社群登入後仍然要通過兩步驟驗證（TOTP）才能進 `/admin`。

服務條款 `/terms` 與隱私權政策 `/privacy` 是公開頁，Google 同意畫面與 LINE 的 Email 權限申請都需要這兩個網址。上線前請先完成「上線前檢查」的律師審閱項目。

### Google 登入（正式環境）

以下網址以目前的正式網址 `https://kollink.vercel.app` 為準。每一個值都請直接複製貼上，不要手打。

1. Google Cloud Console（https://console.cloud.google.com/ ，用營運者自己的專案）→「API 和服務」→「OAuth 同意畫面」（新版介面叫「Google Auth Platform」→「品牌」）：
   - 應用程式名稱：
     ```
     Kollink
     ```
   - 使用者支援電子郵件：選營運者的信箱（建議與 `src/lib/site.ts` 的 `SUPPORT_EMAIL` 相同）。
   - 應用程式首頁：
     ```
     https://kollink.vercel.app
     ```
   - 應用程式隱私權政策連結：
     ```
     https://kollink.vercel.app/privacy
     ```
   - 應用程式服務條款連結：
     ```
     https://kollink.vercel.app/terms
     ```
   - 已授權網域：
     ```
     kollink.vercel.app
     ```
   - 「資料存取」範圍只加這三個（都是非敏感範圍，不需要 Google 審查）：
     ```
     openid
     .../auth/userinfo.email
     .../auth/userinfo.profile
     ```
   - 「目標對象」：User Type 選「外部」，發布狀態按「發布應用程式」改成「正式版」（停在「測試」時只有測試使用者能登入）。
2. 「憑證」（新版叫「用戶端」）→「建立憑證」→「OAuth 用戶端 ID」→ 應用程式類型「網頁應用程式」，名稱例如 `Kollink production`：
   - 已授權的 JavaScript 來源：
     ```
     https://kollink.vercel.app
     ```
   - 已授權的重新導向 URI：
     ```
     https://gujmnohzmivnaxdxpdjn.supabase.co/auth/v1/callback
     ```
   建立後畫面會顯示「用戶端 ID」與「用戶端密鑰」。**密鑰只貼到 Supabase 後台，不要貼進程式、文件或對話。**
3. Supabase Dashboard → 專案 `Kollink` → Authentication → Sign In / Providers → Google：開啟，貼上用戶端 ID 與用戶端密鑰，儲存。
4. Supabase Dashboard → Authentication → URL Configuration：
   - Site URL：
     ```
     https://kollink.vercel.app
     ```
   - Redirect URLs 要有下面這一行（已經有就不用再加）：
     ```
     https://kollink.vercel.app/**
     ```
5. Vercel → 專案 → Settings → Environment Variables，新增（只勾 Production）：
   ```
   NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true
   ```
   `NEXT_PUBLIC_` 開頭的變數是建置時寫進程式的，**一定要重新部署**才會生效：Deployments → 最新一筆 Production → ⋯ → Redeploy。
6. 測試：用無痕視窗打開 `https://kollink.vercel.app/login` → 按「用 Google 繼續」→ 選帳號 → 應該回到網站。新帳號會進「選身分」；已用同一個 Gmail 以 Email 驗證碼註冊過的人，會登入原本的帳號（Google 的 Email 是已驗證的，Supabase 會自動連結）。再用管理員帳號試一次，應該停在兩步驟驗證畫面。

**之後加上自訂網域（例如 `kollink.tw`）時：**OAuth 同意畫面的首頁、隱私權政策、服務條款連結與已授權網域改成新網域；OAuth 用戶端的 JavaScript 來源加上 `https://新網域`；Supabase 的 Site URL 改成新網域、Redirect URLs 加上 `https://新網域/**`。重新導向 URI（`…supabase.co/auth/v1/callback`）不用改。Google 登入畫面上的「繼續使用 gujmnohzmivnaxdxpdjn.supabase.co」只有在 Supabase 也設定自訂網域（付費附加功能）時才會改變。

### LINE 登入（網站自己的 LINE 路由）

Supabase 的自訂 OIDC 登入不能用在 LINE 網頁登入（LINE 網頁登入的 ID token 是用 Channel secret 做 HS256 簽章，Supabase 只接受公開金鑰簽章；改用 OAuth2 模式又拿不到 Email），所以 LINE 登入由網站自己處理：

- `GET /auth/line/start`：產生 state、nonce、PKCE，加密存在 10 分鐘的 HttpOnly cookie（只送到 `/auth/line`），導到 LINE。
- `GET /auth/line/callback`：比對 state（只能用一次）→ 伺服器向 LINE 換 token → 用 Channel secret 驗 ID token（只接受 HS256，並檢查 iss、aud、exp、iat、nonce）→ 決定帳號：
  1. 這個 LINE 已經綁定帳號 → 直接登入（伺服器用 Supabase 管理金鑰產生一次性的登入 token，立刻在伺服器換成 session，token 不會出現在網址）。
  2. LINE 沒有提供 Email → 不建立帳號，登入頁顯示「LINE 沒有提供 Email…」。
  3. 其他情況（Email 已有帳號，或是新的 Email，畫面一律相同、不透露帳號是否存在）→ 把 LINE ID 與 Email 加密存進 10 分鐘的 cookie，導到 `/login?line=verify`。這個瀏覽器若已登入別的帳號，先登出（否則 proxy 會把 `/login` 導走，綁定時也無法確認 session 是誰的）。
- `/login?line=verify`：畫面向 `GET /auth/line/pending` 取得這個瀏覽器自己的 LINE Email 與顯示名稱並顯示，使用者按「寄驗證碼到這個信箱」後**在瀏覽器**用 Supabase 寄驗證碼與驗證（跟 Email 登入完全相同，Supabase 的頻率限制算在使用者自己的 IP，不會因為伺服器共用 IP 而互相影響）。
- `POST /auth/line/link`：只負責綁定。必須同源（Origin），目前的 session（剛用驗證碼登入的帳號）Email 必須等於 LINE 的 Email（既有帳號還要是同一個 user id），才寫入綁定；不符就登出並清掉暫存 cookie。
- LINE 不保證 Email 已驗證，所以不能只憑 LINE 給的 Email 就登入既有帳號，也不能先替那個 Email 建帳號（否則別人用填了你 Email 的 LINE 可以先搶註）；一律要先通過寄到該 Email 的驗證碼。
- 綁定存在 `public.line_identities`（一個帳號最多綁一個 LINE、一個 LINE 只能綁一個帳號）。這張表 API 角色完全不能讀寫，只能透過 `line_login_lookup`、`line_link_identity` 兩個函式（只授權給 service_role）。
- 新帳號照樣走「選身分 → 建立資料」；管理員用 LINE 登入後一樣要通過兩步驟驗證（TOTP）。
- 目前沒有「解除綁定」的畫面；要解除時在 SQL Editor 執行 `delete from public.line_identities where user_id = '填入使用者 id';`。刪除帳號時綁定會一起刪除。

**部署順序：** 這次有新的 migration（`20261130000100_line_identities.sql`，只新增資料表與函式，舊版網站不受影響）。先預覽，清單應該**只有** `20261130000100_line_identities.sql`：

```
npx supabase db push --remote --dry-run
```

確認後執行 `npx supabase db push --remote`，成功後再合併。推之前的只讀檢查（必須是 0，代表還沒有同名的表）：

```sql
select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'line_identities';
```

**營運者設定步驟**（每一個值都請直接複製貼上，不要手打）：

> 注意：
> - **一定要先設定自訂 SMTP（Resend）**（「正式環境設定」第 6 項）。LINE 登入第一次要寄驗證碼；Supabase 內建寄信整個專案每小時只有約 2 封。
> - 正式頻道與本機測試**分開兩個 LINE Login 頻道**：正式頻道只登記正式網址；本機用另一個停在 Developing 的頻道。**正式頻道的 Channel secret 不要放進 `.env.local`**。
> - LINE 變數只設在 Vercel 的 **Production**，`LINE_CHANNEL_SECRET` 勾 Sensitive；`NEXT_PUBLIC_` 開頭的變數改了一定要重新部署。

1. LINE Developers Console（https://developers.line.biz/console/ ）→ 建立或選擇 Provider（名稱用營運者名稱）→「Create a new channel」→ **LINE Login**：
   - Region：Taiwan；App types：勾 **Web app**；Channel name 不能包含「LINE」字樣，例如：
     ```
     Kollink
     ```
   - Email address：營運者的信箱；Privacy policy URL 與 Terms of use URL：
     ```
     https://kollink.vercel.app/privacy
     ```
     ```
     https://kollink.vercel.app/terms
     ```
2. 正式頻道的「LINE Login」分頁 → Callback URL 只填這一行：
   ```
   https://kollink.vercel.app/auth/line/callback
   ```
   本機測試用的另一個頻道（同一個 Provider 下再建一個 LINE Login 頻道，保持 Developing）只填：
   ```
   http://localhost:3000/auth/line/callback
   ```
   本機的 `.env.local` 只放這個測試頻道的 Channel ID／secret。
3. 頻道的「Basic settings」→ OpenID Connect →「Email address permission」→ Apply：勾選同意條款，上傳一張截圖，畫面要看得出「會取得使用者的 Email 以及用途」。可以用登入頁（`https://kollink.vercel.app/login`）底下「繼續即表示你同意《服務條款》與《隱私權政策》」那一段，加上 `/privacy` 第二節「帳號資料」寫到 LINE 的那一行一起截圖。核准後狀態會顯示「Applied」。**沒有 Email 權限時 LINE 不會給 Email，所有新使用者都會看到「LINE 沒有提供 Email」。**
4. 頻道建立後是「Developing」，只有在頻道「Roles」加入的 Admin／Tester 能登入。測試完成後點最上方的「Developing」改成「Published」（**改了不能改回**）。
5. 「Basic settings」裡的 **Channel ID** 與 **Channel secret**：只貼到 Vercel，不要貼進程式、文件或對話。
6. Vercel → 專案 → Settings → Environment Variables，新增下面四個（只勾 **Production**；`LINE_CHANNEL_SECRET` 勾「Sensitive」）：
   ```
   NEXT_PUBLIC_LINE_AUTH_ENABLED=true
   LINE_CHANNEL_ID=貼上 Channel ID
   LINE_CHANNEL_SECRET=貼上 Channel secret
   SITE_URL=https://kollink.vercel.app
   ```
   `SITE_URL` 用來組 LINE 的回呼網址（不會看請求的 Host 標頭）；只設 `SITE_URL` 不會開啟綠界付款（付款還需要 `ECPAY_*`）。
7. 重新部署：Deployments → 最新一筆 Production → ⋯ → Redeploy。
8. 測試（用無痕視窗、頻道 Developing 時用已加入 Tester 的 LINE 帳號）：
   - [ ] `/signup` 選「創作者」→「使用 LINE 登入」→ LINE 同意畫面要列出 Email → 回到網站顯示「要綁定的 LINE 帳號：（你的 LINE 名稱）」與 LINE 的 Email → 按「寄驗證碼到這個信箱」→ 收信輸入驗證碼 → 進入填寫創作者資料。
   - [ ] 登出後再用 LINE 登入 → 不需要驗證碼，直接進入。
   - [ ] 用已經以 Email 註冊過的信箱的 LINE 帳號登入 → 同樣的驗證碼畫面 → 輸入驗證碼 → 進到原本的帳號（不會多一個帳號）。
   - [ ] 已經登入的瀏覽器再按「使用 LINE 登入」（未綁定的 LINE）→ 會先登出、出現驗證碼畫面。
   - [ ] 在 LINE 同意畫面取消 Email 權限（或用沒有 Email 的 LINE 帳號）→ 顯示「LINE 沒有提供 Email…」，沒有建立帳號。
   - [ ] 在 LINE 同意畫面按取消 → 顯示「你取消了 LINE 登入…」。
   - [ ] 管理員帳號綁定 LINE 後用 LINE 登入 → 停在兩步驟驗證畫面。
   - [ ] 第一次真的用 LINE 登入成功後再確認一次：程式只接受 LINE 網頁登入目前使用的 HS256 簽章；如果 LINE 之後改用 ES256，登入會安全地失敗（顯示「LINE 登入沒有完成」），需要更新 `src/lib/auth/line/id-token.ts`。

之後加上自訂網域時：LINE Callback URL 加一行 `https://新網域/auth/line/callback`，Vercel 的 `SITE_URL` 改成新網域，重新部署。

**已知限制／之後再做：**
- `/auth/line/start` 沒有每個 IP 的頻率限制（它只設定暫存 cookie，不會寄信或建帳號）；需要時用 Vercel Firewall 對 `/auth/line/` 加規則。
- LINE 綁定到帳號時寄通知信給帳號擁有者（「你的帳號已綁定 LINE」）。
- 設定頁加「LINE 已綁定／解除綁定」；目前解除綁定只能用上面的 SQL。
- 用還沒綁定的 LINE 登入時，這個瀏覽器原本登入的帳號會先被登出（只登出這個裝置）：否則到不了輸入驗證碼的畫面，綁定時也無法確認 session 屬於誰。這是刻意的行為。
- 驗證碼畫面要按「寄驗證碼到這個信箱」才會寄信（不會因為被人導進 LINE 流程就自動寄）；畫面顯示 LINE 的顯示名稱（只放在加密暫存 cookie，不存資料庫），讓使用者確認要綁定的是哪個 LINE。
- 之後改用自訂網域時，如果該網域底下有**不受信任的子網域**（別人能放內容的子網域），子網域可以替主網域設定 cookie（cookie tossing），有機會干擾 LINE 暫存 cookie 或 Supabase session cookie。屆時 LINE 暫存 cookie 改用 `__Host-` 前綴（要搭配 `Path=/`）或不要把不受信任的服務放在同一個網域下。

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

### 管理員兩步驟驗證（TOTP）

資安修正起，管理員除了 Email 驗證碼，還要通過第二步驟（驗證器 App 的 6 位數驗證碼，Supabase 的 aal2）才能操作後台：資料庫的 `is_admin()`／`admin_actor()` 檢查 JWT 的 `aal` 是 `aal2`，直接呼叫 API 也一樣。

- 第一次：登入後會被導到 `/admin/mfa`，用 Google Authenticator、1Password 等掃描 QR Code（或手動輸入密鑰），輸入 6 位數完成綁定，再進後台。
- 之後每次登入：Email 驗證碼通過後，在 `/admin/mfa` 輸入驗證器上的 6 位數。
- 還沒通過第二步驟的管理員帳號，在資料庫裡等於一般帳號（有 profile 的照自己的角色操作）。
- 備用 SQL 用 `service_role`（system 身分），不受第二步驟影響：SQL Editor 本身以 `postgres` 身分執行，備用 SQL 之所以有效，是因為開頭做了 `set local role service_role` 並設定 claims。
- **遺失驗證器**：在 Supabase Studio 的 SQL Editor 刪掉該使用者的 MFA 因子（直接複製，只改 Email）。刪完後對方再次登入會重新綁定：
  ```sql
  delete from auth.mfa_factors
   where user_id = (select id from auth.users where email = lower('填入管理員的 Email'))
  returning id, factor_type, status;
  ```
- 正式環境要先在 Dashboard 開啟 TOTP（見「正式環境設定」第 7a 項）。本機的 `supabase/config.toml` 已開啟（`[auth.mfa.totp]`）；本機不要 `supabase config push`。

本機開發：登入頁的「測試管理員」（`dev-admin@kollink.test`，見上方「測試快速登入」）。測試管理員也要過 TOTP：dev-login 不會偽造第二步驟，第一次進 `/admin/mfa` 綁定，E2E 腳本自己用密鑰算 6 位數驗證碼（RFC 6238）。

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

### 收入與付款紀錄頁

- 創作者「收入」（`/creator/earnings`）與品牌「付款紀錄」（`/brand/payments`）：用 `list_my_collaborations` 的「進行中」與「已完成」兩個分頁加總（加總邏輯在 `src/lib/earnings.ts`），不新增資料庫物件。款項由平台人工確認、撥款為人工銀行轉帳；發票功能尚未提供（仍不在範圍內）。
  - 測試付款（綠界 stage）的提示目前是整頁層級：付款設定為 stage 時，兩頁頂端會顯示「測試環境」警示。要標示「哪幾筆合作案是測試付款」需要新增彙總 RPC（後續項目，本次不動資料庫）。
- 資料庫函式每個分頁最多回 200 筆；任一分頁滿 200 筆時，頁面會標示「金額可能比實際少」。要精確加總需另開 SQL 彙總函式（本次未做）。

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

## 公開的創作者列表與首頁

`/creators` 不用登入就能瀏覽與搜尋通過審核的創作者（類別、關鍵字、排序、分頁，每頁 12 位）。資料來自 `list_public_creators`（`20261203000100_public_creators.sql`，訪客可呼叫），回傳公開頁看得到的欄位加上評分與起價（所有報價的最低價）。品牌登入後的創作者廣場（`search_creators`，有報價與收藏）不變。

首頁的區塊順序：主視覺＋搜尋列 → 剛加入的創作者（沒有公開的創作者時不顯示）→ 流程分頁（五步，示意畫面是程式畫的、內容虛構）→ 保障 → 給品牌／給創作者 → 常見問題 → 結尾。首頁沒有放平台數字與使用者見證：等有真實資料再加，不寫假的。

公開頁共用的頂列（`TopBar`＋`SiteNav`）有兩個下拉選單（功能、適合誰）與手機選單，連結定義在 `src/lib/site-nav.ts`；說明頁在 `src/app/(marketing)/`：`/features`、`/for-brands`、`/for-creators`、`/pricing`。這些頁面的文案只寫系統現在做到的事；流程或收費規則改了要一起更新（`/pricing` 與 `/terms` 的手續費說明必須一致）。

### 公開頁給誰看什麼

| 資料 | 訪客（沒登入） | 登入後 |
|---|---|---|
| 作品圖、自介、類別、風格、互動率、評價 | 看得到 | 看得到 |
| 報價（各合作形式） | 看得到 | 看得到 |
| 粉絲數 | 看不到（顯示「登入後顯示」） | 看得到 |
| 作品的 IG 貼文連結、IG 帳號 | 看不到 | 看得到 |

規則在資料庫執行（`20261204000100_gate_followers.sql`）：訪客對 `creator_profiles.follower_count`、`ig_username` 與 `creator_portfolio_items.link_url` 沒有讀取權限；`get_public_creator`、`list_public_creators` 對訪客回傳的粉絲數是 null，訪客也不能依粉絲數排序或用 IG 帳號搜尋。報價經由 `list_creator_rates`（訪客可呼叫）讀取，`creator_rates` 資料表本身的授權不變。目的是讓公開頁能被搜尋引擎收錄，同時把粉絲數與帳號連結留給註冊的人。

## 評價

合作完成（撥款）後，品牌與創作者互相評分（1–5 星，文字選填、最多 500 字）。migration `20261202000100_reviews.sql`，規則的 TS 常數在 `src/lib/reviews/view.ts`。

- **期限**：完成後 14 天內可以寫；每個合作案每一方一則，送出後不能修改。
- **雙盲**：雙方都寫完的那一刻一起公開；只有一方寫的話，14 天期滿才公開。寫之前只知道對方「寫了沒」，看不到內容。
- **文字**：不能有電話、Email、LINE ID 或連結（會公開）。前端與資料庫都檢查。
- **哪裡看得到**：合作案詳情（雙方）；創作者公開頁 `/c/<handle>` 的星等與「合作評價」（訪客也看得到）；品牌看報名者列表時每位創作者的星等；創作者看機會詳情時品牌的星等。創作者寫給品牌的評價內容只有該品牌自己在合作案詳情看得到，其他人只看得到品牌的平均與則數。
- **隱藏違規評價**：管理員在 `/admin/collabs/<id>` 的「評價」區按「隱藏這則評價」（原因必填，只有管理員看得到，寫進 audit log，action `review_hidden`／`review_unhidden`）。隱藏後不公開、不列入平均，作者看到「已被平台隱藏」。管理員是該合作案的參與者時不能處理。

資料表 `collaboration_reviews` 不授權給任何 API 角色，讀寫只經由 definer 函式：`submit_collaboration_review`、`get_collaboration_reviews`（參與者）、`review_stats`、`list_creator_reviews`（訪客可呼叫）、`admin_list_collab_reviews`、`admin_set_review_hidden`。

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

**新增函式也一樣：** 資安修正（`20261129000100_security_hardening.sql`）起，postgres 建立的函式（任何 schema）**預設不再給 PUBLIC 執行**，也不會自動給 anon／authenticated。每個新函式都要在同一個 migration 先 `revoke execute ... from public, anon, authenticated, service_role`，再明確 `grant execute` 給需要的角色（例如 RLS policy 用的 helper 要 grant 給 authenticated），否則 API 會回 permission denied。trigger 函式不需要 grant。

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

1. Authentication → Providers → Email（本次資安版本上線時，OTP 長度要等新版網站上線後才改，見「資安修正（全系統體檢）上線」第 7 步）：開啟「Confirm email」（`enable_confirmations`）；Email OTP 長度 **8**、有效期限 **600 秒**（資安修正：碼越長、越短命，暴力猜測越難）。後台預設是 8 碼、3600 秒，有效期限一定要改。登入頁接受 6 到 8 位數，所以本機（6 碼）與正式環境（8 碼）都能用。
2. Authentication → Sign In / Providers：關閉匿名登入（anonymous sign-ins）。
3. 密碼登入封鎖：真正的保證是 migration 裡的 `null_encrypted_password` trigger（推送 migration 即生效，不受方案限制）。另外在 Authentication → Hooks 新增 Postgres hook「Password verification attempt」指向 `public.hook_reject_password`，作為第二層防護（方案允許才有）。
4. Authentication → URL Configuration：Site URL 填正式網址；Redirect URLs 加入下面這行（`<site>` 換成正式網址）：
   ```
   https://<site>/auth/callback**
   ```
5. Authentication → Emails：要先完成第 6 項的自訂 SMTP 才能改範本（預設範本寄的是登入連結，不是 6 碼驗證碼，登入頁會無法使用）。「Magic Link」與「Confirm signup」兩個範本都換成 `supabase/templates/otp.html`（主旨分別為 `Kollink 登入驗證碼`、`Kollink 註冊驗證碼`）。
6. Authentication → SMTP Settings：設定自訂 SMTP（例如 Resend）。內建寄信上限約每小時 2 封，不能用於正式環境。
7. Authentication → Attack Protection：建議開啟 CAPTCHA（Turnstile 或 hCaptcha），並在登入頁加上對應元件（需要前端整合，見下方「資安待辦」，先不要只開後台設定，否則登入會失敗）。
7a. Authentication → Multi-Factor：開啟 **TOTP**（Enroll 與 Verify 都要開）。管理員的兩步驟驗證靠這個設定；沒開的話管理員無法綁定驗證器，進不了 `/admin`。
8. Google OAuth：照「社群登入設定 → Google 登入（正式環境）」逐步設定。
9. 排程清理沒被引用的 Storage 物件：`brand-logos`（沒被 `brand_profiles.logo_path` 引用）、`creator-media`（沒被 `creator_profiles.avatar_path`、`creator_portfolio_items.image_path` 引用）`brief-covers`（沒被 `briefs.cover_path` 引用）與 `deliverables`（沒被任何 `collaboration_submissions.file_paths` 引用的，例如上傳後沒有交稿），都只刪超過 24 小時的，見 `docs/superpowers/plans/2026-11-22-foundation-followups.md`。

## 上線前檢查

- [ ] 設定客服聯絡方式：`src/lib/site.ts` 的 `SUPPORT_EMAIL`（與 `SUPPORT_LINE_URL`）改成真實信箱與 LINE 官方帳號網址。目前是 `support@example.com` 佔位，在改掉之前，客服連結會顯示「聯絡方式準備中」（/help、停權橫幅、金額上限說明、線下付款提示、無法退出合作的說明）。
- [ ] 服務條款與隱私權政策：請律師審閱 `/terms`、`/privacy`（`src/app/terms/page.tsx`、`src/app/privacy/page.tsx`），把「（營運者名稱）」「（營運者地址）」「（管轄法院）」換成實際資料，再把 `src/lib/site.ts` 的 `LEGAL_DRAFT` 改成 `false`（兩頁頂端的「這份文件是草稿」提示就會消失）。
- [ ] 確認首頁大標：`src/lib/site.ts` 的 `HERO_HEADLINE`（目前「把對的品牌，牽到對的創作者。」；備選：「一條紅線，從品牌牽到創作者。」「好的合作，從牽對線開始。」）。
- [ ] 用真的 iPhone（Safari）開首頁、登入頁、創作者公開頁，確認 3D 紅線順暢、文字可讀、捲動不卡；省電模式與「減少動態效果」開啟時應該是靜態線。
- [ ] 管理員用真的驗證器 App（Google Authenticator、1Password 等）掃描 `/admin/mfa` 的 QR Code 完成綁定（QR 在白底磚上，深色模式也能掃）；同時確認 Dashboard 已開啟 TOTP（見「正式環境設定」第 7a 項）。

## 資安修正（全系統體檢）上線

這個版本含兩個 migration（`20261129000100_security_hardening.sql`、`20261129000200_admin_mfa.sql`）與網站程式，**必須一起上線**：

- migration 之後，舊版網站的合作案詳情會因為讀不到 ATM 欄位而出錯（現在改用 `get_my_payment_details`）。
- migration 之後，沒有通過 TOTP 的管理員在資料庫裡不是管理員；舊版網站沒有 `/admin/mfa`，管理員會進不了後台。

**部署順序（依序；下面的指令與 SQL 都請直接複製貼上，不要手打）：**

1. 確認 Vercel 的 Production 環境變數有 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（CSP 在建置時就固定，缺了的話網站連不上 Supabase）。
2. 推 migration 前的只讀檢查（只回一列）。在終端機執行：
   ```bash
   npx supabase db query --remote --read-only "select (select rolbypassrls from pg_roles where rolname = 'postgres') as bypassrls, has_table_privilege('postgres', 'storage.objects', 'select') as can_read_storage, (select max(version) from supabase_migrations.schema_migrations) as last_migration, (select count(*) from pg_policies where policyname in ('brand_logos_insert_own','brand_logos_update_own','creator_media_insert_own','creator_media_update_own','brief_covers_insert_own','brief_covers_update_own','profiles_select','brand_profiles_select','creator_favorites_insert_own')) as old_policies, (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('storage_quota_ok','storage_upload_quota_ok','can_view_user','get_my_payment_details','is_admin_account','creator_profiles_log_stats')) as new_fns_existing, (select count(*) from public.creator_profiles where follower_count > 100000000) as followers_over_cap, (select count(*) from public.admins) as admins, (select count(*) from auth.mfa_factors f join public.admins a on a.user_id = f.user_id where f.status = 'verified') as admin_totp;"
   ```
   或把下面的 SQL 貼到 Supabase Studio 的 SQL Editor：
   ```sql
select (select rolbypassrls from pg_roles where rolname = 'postgres') as bypassrls,
       has_table_privilege('postgres', 'storage.objects', 'select') as can_read_storage,
       (select max(version) from supabase_migrations.schema_migrations) as last_migration,
       (select count(*) from pg_policies where policyname in ('brand_logos_insert_own','brand_logos_update_own','creator_media_insert_own','creator_media_update_own','brief_covers_insert_own','brief_covers_update_own','profiles_select','brand_profiles_select','creator_favorites_insert_own')) as old_policies,
       (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('storage_quota_ok','storage_upload_quota_ok','can_view_user','get_my_payment_details','is_admin_account','creator_profiles_log_stats')) as new_fns_existing,
       (select count(*) from public.creator_profiles where follower_count > 100000000) as followers_over_cap,
       (select count(*) from public.admins) as admins,
       (select count(*) from auth.mfa_factors f join public.admins a on a.user_id = f.user_id where f.status = 'verified') as admin_totp;
   ```
   預期結果：
   - `can_read_storage` = `true`。**若是 `false` 就中止，不要推 migration**：Storage 的計數 helper 讀不到 `storage.objects`，推了之後每一次上傳都會 permission denied。
   - `bypassrls` = `true`（若是 `false`，Storage 數量上限會悄悄失效）。
   - `last_migration` = `20261128000400`。
   - `old_policies` = `9`。
   - `new_fns_existing` = `0`。
   - `followers_over_cap` = `0`。
   - `admins` ≥ `1`。
3. Supabase Dashboard → Authentication → Multi-Factor：開啟 **TOTP**（Enroll 與 Verify 都要開）。**這時先不要改 Email OTP 長度**（舊版網站只接受 6 碼）。
4. 確認要推的 migration，再推送：
   ```bash
   npx supabase db push --remote --dry-run
   ```
   清單必須只有 `20261129000100` 與 `20261129000200`，確認後：
   ```bash
   npx supabase db push --remote --yes
   ```
5. **馬上**合併 PR（資料庫與網站必須一起上線：新版網站上線前，合作案詳情頁會出錯，管理員也沒有後台權限）。
6. 每位管理員馬上開 `/admin`，到 `/admin/mfa` 綁定驗證器（第一次綁定只需要 Email 登入），確認 `/admin` 進得去。另外確認：品牌帳號看待付款的合作案有付款資訊、創作者畫面沒有 ATM 帳號細節、上傳一張圖成功。
7. 到這裡才改：Authentication → Providers → Email 的 OTP 長度改為 8、有效期限 600 秒；改完用 8 位數驗證碼登入一次。
8. 之後、金流正式上線前：在 Vercel 預覽環境用綠界測試環境走信用卡（含 3D 驗證）與 ATM 取號；若 CSP 擋住導向，放寬 `form-action`（見下方「資安待辦」）。

**卡住時：**

- **不要回滾 migration。**
- `db push` 之後 Vercel 部署失敗：先用下面的暫時 SQL（SQL Editor）讓舊版網站的合作案頁面恢復運作：
  ```sql
  grant select (atm_bank_code, atm_v_account, atm_expire_date) on public.payments to authenticated;
  ```
  新版網站上線後馬上收回：
  ```sql
  revoke select (atm_bank_code, atm_v_account, atm_expire_date) on public.payments from authenticated;
  ```
- 這段期間管理員用 service_role 備用 SQL（見上面各節）處理後台工作。
- **絕對不要在 `db push` 之前部署新版網站**（會導致登入失敗）。
- 如果只套用了 `20261129000100`（第二個沒推成功）：合併 PR 前先重跑步驟 4 的 `db push`。

**這個版本的行為變更：**

- 品牌錄取報名時，金額**低於創作者報名時的報價**：合作案先進入「等待創作者確認」（`invited`），創作者接受後才進入待付款，婉拒則結束；品牌在對方確認前可以撤回。金額等於或高於報價、或創作者沒有報價：照舊直接進入待付款。創作者在品牌付款前都可以退出合作。
- Storage 上傳數量上限（每位使用者在該 bucket 的物件數）：`brand-logos` 40、`creator-media` 120、`brief-covers` 300；`deliverables` 每個合作案 200（`src/lib/upload-limits.ts` 與 migration 一致）。**計數的是目前存在的物件**，換圖時舊檔沒有刪除，所以實際上是累計上限；要靠下方第 9 項的清孤兒檔排程把舊檔清掉。
- 創作者改粉絲數、互動率時，只要狀態不是待審（`pending`），都會寫一筆 `creator_stats_changed` 操作紀錄（停權或被退回期間改的也算）。
- 管理員在後台頁面被要求第二步驟時，驗證完會回到原本要去的後台頁面（只接受 `/admin` 底下的站內路徑）。

**救援：** 遺失驗證器見「管理員兩步驟驗證」。管理員全部進不了後台時，用 SQL Editor 的 service_role 備用 SQL（上面各節）仍然可以處理（system 身分，不看 aal）。

**其他設定：** 新增資料庫函式時，postgres 建立的函式預設不再給 PUBLIC 執行：每個新函式都要自己 `grant execute` 給需要的角色（見「正式環境（Hosted Supabase）設定」的「新增函式也一樣」）。

### 資安待辦（之後再做）

- Supabase CAPTCHA（Turnstile 或 hCaptcha）：後台開啟的同時，`AuthForm` 的 `signInWithOtp`／`verifyOtp` 要傳 `captchaToken`。
- 流量限制：`apply_to_brief`、`save_brief`、收藏（`setFavoriteAction`）還沒有每人每分鐘／每日上限（邀請已限制 24 小時 30 次）；可用資料庫計數（同 `send_message`）或 Vercel Firewall。
- 帳號列舉：註冊時 `handle taken` 會告訴對方網址已被使用（註冊必要，接受）；收藏不存在的創作者已改成一律 42501。
- Session cookie 不是 HttpOnly：`@supabase/ssr` 的瀏覽器 client 需要讀它（Realtime、Storage）。補償措施是 CSP 的 `connect-src` 只放行 Supabase；XSS 仍然可以偷走 session，所以不要新增 `dangerouslySetInnerHTML`。
- 交稿檔案（deliverables）的 MIME sniffing：只檢查宣告的 Content-Type，內容沒有驗證（PDF 可能內嵌腳本）；檔案從 Supabase 網域用 1 小時 signed URL 開啟，不在網站的來源下執行。可以縮短 signed URL 時間或加上 `download`。
- CSP 的 `script-src` 有 `'unsafe-inline'`（cacheComponents／PPR 不能每請求產生 nonce）；之後可評估只對動態的 `/admin`、`/brand/collabs` 改用 nonce，或 `experimental.sri`。
- 綠界 `form-action`：只放行 `payment(-stage).ecpay.com.tw`。**還沒有驗證 3D 驗證（可能導向銀行網域）與 ATM 的跨網域導向鏈**；上線前在 Vercel 預覽環境用綠界測試環境走一次；若被擋，把 `form-action` 放寬為 `https:`，其他指令不變。
- 停權前已建立的付款單：創作者被停權時，品牌之前在綠界建立的付款單（例如 ATM 取號後才轉帳）仍會完成付款，合作案照樣進入待交稿，變成「進行中的合作案、創作者已停權」。管理員需要在付款異常或合作案列表留意，必要時用平台取消＋退款處理。
- 邀請與開啟對話各自是每個品牌 24 小時 30 次（`invite_creator`、`start_conversation`），合起來一天最多可以接觸 60 位創作者；要更嚴格時改成共用一個計數。
- Storage 數量上限是累計物件數（見上方「這個版本的行為變更」），需要清孤兒檔的排程（「正式環境設定」第 9 項）；沒有排程的話，常換圖的使用者最終會被擋。
- 登入頁的 Email OTP 6–8 碼輸入只有單元測試（`src/lib/auth/otp-code.test.ts`），沒有在瀏覽器走完整的寄信流程（本機內建寄信每小時 2 封）；正式環境設定 8 碼後要實際登入一次確認。

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

綠界變數（`ECPAY_ENV`、`ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`）**目前不要設**（`SITE_URL` 只有在開 LINE 登入時才設，見「社群登入設定」）（正式站在拿到綠界正式金鑰前不開付款，Preview 也不設；測試金鑰只在本機使用）。上線時只加到 **Production**，值見「合作案的付款與撥款」，改了要重新部署。程式在 `VERCEL_ENV=production` 上會拒絕測試環境與公開測試商店，這需要 Vercel 的「Enable access to System Environment Variables」保持開啟。

`CRON_SECRET`：審核逾期自動通過的 Vercel Cron（`vercel.json`：每天 UTC 01:00 = 台灣 09:00 呼叫 `/api/cron/auto-approve`）。值用一串夠長的亂數（例如 `openssl rand -hex 32` 的結果），加到 **Production** 環境。Vercel 會自動在 cron 請求帶 `Authorization: Bearer <CRON_SECRET>`；沒設定時 route 一律回 500，不會自動通過任何合作案。Hobby 方案的 Cron 一天只跑一次、而且可能在該小時內任何時間觸發（UTC 01:00–01:59，台灣 09:00–09:59），所以實際是「審核期限到了之後最晚隔天自動通過」。本機在 `.env.local` 隨便設一個值即可，手動測試：

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/auto-approve
```

### 計畫 9（管理後台）上線

0. 推送前的唯讀檢查（都不會改資料）：

   ```bash
   # 預覽會套用哪些 migration：必須剛好列出 20261128000100、000200、000300、000400（只預覽，不會套用）
   npx supabase db push --remote --dry-run
   ```

   ```sql
   -- 應回傳 2 列：creator_profiles_status_check、payment_anomalies_source_check（migration 會先 drop 再重建）
   select conname from pg_constraint
   where conname in ('creator_profiles_status_check', 'payment_anomalies_source_check');

   -- 只能出現 pending、approved、suspended
   select status, count(*) from public.creator_profiles group by 1;

   -- 目前待撥款的合作案（上線空窗期的處理方式見下方）
   select id, status from public.collaborations where status = 'awaiting_payout';
   ```

   部署空窗期不要使用舊的撥款 SQL（現在會報 `invalid transition`）：撥款一律在部署後經由 `/admin`，且創作者必須已填收款帳戶。

1. 合併前：`npx supabase db push --remote`（`20261128000100_admin_core.sql`、`20261128000200_admin_money.sql`、`20261128000300_admin_review_fixes.sql`、`20261128000400_admin_refund_participant_guard.sql`，依序）。migration 會改 `transition_collaboration`：之後撥款只能經由後台或 `admin_mark_payout`（舊的撥款 SQL 會報 `invalid transition`）；`admin_mark_payout` 現在要帶帳號末四碼。
2. 合併後：照「管理後台 → 新增管理員」把營運人員的帳號加進 `admins`，用該帳號登入確認進得了 `/admin`。
3. 通知所有已審核的創作者到「我的 → 收款帳戶」填寫（沒有帳戶時不能撥款）。目前 `awaiting_payout` 的合作案在創作者填好前會顯示「創作者還沒填收款帳戶」。
4. 推送後的匿名檢查（用 anon 的 publishable key，`<PROJECT_REF>`、`<PUBLISHABLE_KEY>`、`<handle>` 換成實際值，直接複製貼上）：

   ```bash
   URL="https://<PROJECT_REF>.supabase.co"; KEY="<PUBLISHABLE_KEY>"
   # 1) 必須被拒絕（permission denied，HTTP 401/403，不可回傳 true/false）
   curl -s -X POST "$URL/rest/v1/rpc/is_admin" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{}'
   # 2) 必須被拒絕
   curl -s -X POST "$URL/rest/v1/rpc/admin_overview" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{}'
   # 3) 必須仍回傳已審核創作者的資料列（不是空陣列）
   curl -s "$URL/rest/v1/creator_profiles?status=eq.approved&select=handle&limit=3" -H "apikey: $KEY"
   ```

   最後用瀏覽器（未登入）開 `/c/<已審核創作者的 handle>`，確認頁面正常顯示。
