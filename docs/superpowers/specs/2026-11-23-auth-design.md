# Kollink 登入與註冊設計規格（計畫 2）

- 日期：2026-11-23
- 範圍：登入、註冊、填寫基本資料、登入後的頁面骨架、改名 Pollen → Kollink
- 前置：地基計畫（`docs/superpowers/plans/2026-11-22-foundation.md`）與其待辦（`2026-11-22-foundation-followups.md` 第 2 節）
- UI 風格沿用 `2026-11-22-ui-design.md`

## 決定摘要

| 項目 | 決定 |
|---|---|
| 登入方式 | Google 登入 + Email 6 碼驗證碼，不使用密碼。LINE 之後再加。 |
| 創作者審核 | 人工審核。審核中可以登入、可以修改資料，畫面顯示「審核中，通常 1–2 個工作天」。計畫 9 之前在 Supabase Studio 用 SQL 審核。 |
| IG 本人驗證 | 建立帳號時產生 6 碼驗證碼，請創作者暫時放進 IG 自我介紹，審核時人工確認。不串 Meta API。 |
| 品牌註冊欄位 | 品牌名稱、產業（必填），Logo（選填，存 Storage 路徑）。統編留到計畫 8。沒有 Logo 時顯示品牌名稱第一個字（尚無畫面使用品牌頭像，延後到計畫 3/4 實作）。 |
| 創作者註冊欄位 | 顯示名稱、IG 帳號、粉絲數、地區、1–5 個內容領域標籤（必填）。報價、作品、受眾年齡不在註冊流程。 |
| 公開頁網址（handle） | 預設帶入 IG 帳號，可修改。審核通過前可以隨意改，通過後鎖定。 |
| 正式名稱 | Kollink。介面上的名稱集中在一個設定檔。 |
| 檢查放在哪一層 | proxy 只處理登入 cookie 與「沒登入導去 /login」；身分與資料完整度由各區 layout 透過共用的 current-user 函式檢查；真正的權限由 RLS 負責。 |

## 1. 使用者流程與頁面

### 註冊 / 登入
1. `/signup`：選「我是品牌」或「我是創作者」，選擇放在網址參數（`?role=brand|creator`）。
2. 同一頁選「用 Google 繼續」或輸入 Email 收 6 碼驗證碼。`/login` 是同一個元件，少了選身分那一步。
3. Google 登入回到 `/auth/callback` 交換 session；Email 驗證碼在頁面上直接完成。
4. 登入後導向規則（寫成純函式 `resolvePostLoginPath`）：

| 狀態 | 導向 |
|---|---|
| 沒有 profile，有 role 參數 | `/onboarding/brand` 或 `/onboarding/creator` |
| 沒有 profile，沒有 role | `/onboarding`（選身分） |
| 有 profile，身分是品牌 | `next` 參數（若為品牌區內的安全站內路徑）或 `/brand` |
| 有 profile，身分是創作者 | `next` 參數（若為創作者區內的安全站內路徑）或 `/creator` |

### 填寫資料
- **品牌**（`/onboarding/brand`）：品牌名稱、產業（下拉選單）、Logo（選填）。送出後進 `/brand`。
- **創作者**（`/onboarding/creator`）：顯示名稱、IG 帳號、粉絲數、地區、1–5 個內容領域標籤。公開頁網址預設帶入 IG 帳號（轉小寫），可手動修改。送出後進 `/creator`。

### 登入後頁面骨架
- `/brand`：電腦版左側導覽列（創作者廣場、我的招募、合作案、訊息、付款與發票、設定）。只有「設定」可用（修改品牌名稱、產業、Logo），其他顯示「即將推出」。
- `/creator`：手機版底部 5 個分頁（機會、合作、訊息、收入、我的），電腦版改成左側導覽列。只有「我的」可用（修改註冊時填的資料；handle 只有審核前可改），其他顯示「即將推出」。
- 創作者狀態為 pending 時，頁面上方固定顯示：
  > 審核中，通常 1–2 個工作天。請把驗證碼 **XXXXXX** 暫時加到 IG 自我介紹，審核通過後就可以刪掉。
- 狀態為 suspended 時顯示「帳號已暫停，請聯絡客服」，不顯示驗證碼。
- 右上角（手機版在「我的」裡）有登出。

### 導向檢查
- `src/proxy.ts`：更新 Supabase session cookie；沒登入且路徑需要登入時導去 `/login?next=<原路徑>`。不需要登入的路徑：`/`、`/c/*`、`/signup`、`/login`、`/auth/*`、`/api/payments/ecpay/notify`、靜態檔。
- `/onboarding/*` layout：沒有登入 → `/login`；已經有 profile → 導回自己那一區。
- `/brand/*` layout：沒有 profile → `/onboarding`；身分不是品牌 → `/creator`。
- `/creator/*` layout：沒有 profile → `/onboarding`；身分不是創作者 → `/brand`。
- 所有讀取 session 的元件都放在 `<Suspense>` 底下，不在 layout 最外層 await（`cacheComponents` 的限制，見 `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`）。
- 管理員目前沒有 profile，登入會被導去 `/onboarding`；計畫 9 再處理。

## 2. 資料庫改動

### 2.1 建立帳號函式
兩個 `security definer`、`search_path = ''` 的函式，只授權給 `authenticated`：

- `create_brand_account(p_brand_name text, p_industry text, p_logo_path text default null) returns void`（品牌的 display_name 直接用品牌名稱）
- `create_creator_account(p_display_name text, p_handle text, p_ig_username text, p_follower_count integer, p_region text, p_categories text[]) returns text`（回傳驗證碼）

共同規則：
- `auth.uid()` 為 null → 錯誤 42501。
- 已經有 profile → 錯誤 23505（訊息 `account already exists`）。
- 文字清理 `clean_text`（前端 `cleanText` 必須用完全相同的集合）：(1) 任何位置一律移除 U+200B、U+2060、U+FEFF（所以「美妝」與「美​妝」視為相同）；U+200C、U+200D 只在前後去除，內部保留，以免拆散 emoji（如 👩‍💻）與需要它們的文字；(2) 去掉前後的空白與看不見的字元：ASCII 空白（`\s`）以及 U+0085、U+00A0、U+00AD、U+034F、U+061C、U+115F、U+1160、U+1680、U+180E、U+2000–U+200F、U+2028、U+2029、U+202F、U+205F、U+2060–U+2064、U+2800、U+3000、U+3164、U+FE0F、U+FEFF、U+FFA0；清完不可為空。(3) 雙向控制字元（U+202A–U+202E、U+2066–U+2069）出現在任何位置都視為無效：對應欄位報 `invalid <欄位>`，前端報「含有不允許的特殊字元」。長度上限：display_name 40、brand_name 60、industry 30、region 30、ig_username 30。
- `brand_profiles.logo_url` 改名為 `logo_path`，只存 Storage 路徑：null，或 `<user_id>/<檔名>`（`'^' || user_id || '/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'`，檔名以英數字開頭，且不可含 `..`）。檢查做成 CHECK constraint `brand_profiles_logo_path_check`（取代原本的 trigger）；函式先自行檢查並 raise 22023 `invalid logo_path`。顯示用的公開網址由 App 的 `brandLogoUrl(path)` 用 `NEXT_PUBLIC_SUPABASE_URL` 組出。
- 創作者：handle 符合既有 check（`^[a-z0-9_.]{3,30}$`）；ig_username 符合 `^[A-Za-z0-9_.]{1,30}$`；follower_count ≥ 0；categories 1–5 個、不重複、每個 `clean_text` 後非空且 ≤ 20 字。
- handle 重複 → 錯誤 23505（訊息 `handle taken`），前端顯示「這個網址已經有人使用」。
- 格式錯誤 → 錯誤 22023，訊息標明欄位名稱（例如 `invalid handle`）。
- 兩個 profiles insert 包 `exception when unique_violation`：handle 的唯一限制（`creator_profiles_handle_key`）→ 23505 `handle taken`；其他唯一衝突（同時建立）→ 23505 `account already exists`。
- 在同一個 transaction 寫入 `profiles` 與對應的 `brand_profiles` / `creator_profiles`（創作者 status 一律 pending），創作者另外寫入 `creator_verifications`。

品牌的 `profiles.display_name` 等於品牌名稱。

**安全規則：** `role` 與 `display_name` 絕不可從 `auth.users.user_metadata` 讀取（確認 Email 之前攻擊者可以任意寫入），只能讀 `profiles`。密碼登入一律封鎖：`auth.users.encrypted_password` 由 trigger 強制存 null（真正的保證），另加 `password_verification_attempt` hook 作第二層防護。

另外加上資料表層級的欄位限制（更新時也適用）：`profiles.display_name` 1–60 字、`brand_name` 1–60、`industry` ≤ 30、`region` ≤ 30、`ig_username` 格式、`categories` 最多 5 個。創作者顯示名稱 40 字的上限由建立與修改函式都檢查（前端同步檢查）。

另外有兩個修改函式（同樣 `security definer`、`search_path = ''`、只授權 `authenticated`，驗證規則與建立相同）：

- `update_brand_account(p_brand_name text, p_industry text, p_logo_path text) returns void`（`p_logo_path` 是必填參數，傳 null 代表移除 Logo）：呼叫者必須已有 `brand_profiles`，否則 42501 `not a brand`；同一個 transaction 更新 `brand_profiles` 與 `profiles.display_name`。
- `update_creator_account(p_display_name text, p_handle text, p_ig_username text, p_follower_count integer, p_region text, p_categories text[]) returns text`：呼叫者必須已有 `creator_profiles`，否則 42501 `not a creator`；`handle_locked_at` 不是 null 時 handle 與現值不同 → 42501 `handle locked after approval`，未鎖定時撞名 → 23505 `handle taken`；同一個 transaction 更新 `creator_profiles` 與 `profiles.display_name`。
  - **改 IG 帳號要重新審核**：IG 帳號（不分大小寫比較）與現值不同時，approved → 狀態退回 `pending`；suspended → 維持 suspended；兩者都產生新驗證碼（覆蓋 `creator_verifications` 該列，且與舊碼不同）並回傳；其他情況回傳 null。DB 端只做 `clean_text` 正規化，前端 `normalizeIgUsername` 先去掉前置 `@`（DB 收到 `@` 會報 `invalid ig_username`）。
  - 粉絲數為創作者自填，不另外驗證；頁面在欄位旁以小字提示「自填，品牌可在合作前自行確認」，IG 欄位提示「更換 IG 帳號後需要重新審核」。
  - 創作者資料頁在回傳新驗證碼時顯示「你更換了 IG 帳號，需要重新審核」，並由審核中橫幅顯示新驗證碼。

修改資料只能經由這兩個函式：撤銷 anon / authenticated 對 `profiles`、`brand_profiles`、`creator_profiles` 的所有 UPDATE 與 DELETE 權限（含欄位級），並拿掉三條 `*_update_self` policy。刪帳號由 `auth.users` 的 cascade 處理。另外 `service_role` 不再有 `creator_profiles` 的 INSERT / DELETE 權限（建立只走函式，避免「刪掉重建」繞過 handle 鎖定）。

拿掉 `profiles_insert_self`、`brand_profiles_insert_self`、`creator_profiles_insert_self` 三條 INSERT policy，並撤銷 authenticated 對這三張表的 INSERT 權限。建立帳號只能經由上面兩個函式。

### 2.2 `creator_verifications`
```
user_id uuid primary key references public.creator_profiles (user_id) on delete cascade
code text not null check (code ~ '^[A-HJ-NP-Z2-9]{6}$')
created_at timestamptz not null default now()
```
- RLS：本人與管理員可 SELECT；不開放任何寫入權限。
- 驗證碼字元集排除 0、O、1、I，用 `gen_random_bytes` 產生。

### 2.3 handle 鎖定
- `creator_profiles.handle_locked_at timestamptz`（null = 未鎖）。第一次離開 pending（或 INSERT 時 status 就不是 pending）時由 trigger 自動設為 `now()`；之後狀態退回 pending 也不會解鎖。
- BEFORE INSERT OR UPDATE trigger：`old.handle_locked_at is not null` 時，`handle` 或 `handle_locked_at` 被改動 → 42501（`handle locked after approval`），對所有角色都生效（含 service_role 與 definer 函式）。
- 唯一例外：Studio 管理者在同一個 transaction 先執行 `set local kollink.allow_handle_change = 'on';`（Studio 請用 `set local`，不要用 `set`），且 `current_user in ('postgres', 'supabase_admin')`，兩個條件都成立才放行。
- `handle_locked_at` 與 `user_id` 只能由 trigger 管理：INSERT 時 `handle_locked_at` 由 status 決定（忽略傳入值）；UPDATE 時未經 GUC 例外不能改 `user_id`，也不能在未鎖定的列自行設定 `handle_locked_at`。`service_role` 的 UPDATE 權限只剩 `ig_username, follower_count, engagement_rate, region, categories, style_tags, collab_types, bio, status`。
- 不再 `grant update (handle)`；handle 只能經 `update_creator_account` 修改。`status` 不在任何可更新欄位內，創作者無法自行改成 approved。

### 2.4 Logo 儲存空間
- Storage bucket `brand-logos`：public 讀取、檔案上限 2MB、允許 `image/png`、`image/jpeg`、`image/webp`。
- `storage.objects` policy：路徑第一層資料夾必須等於 `auth.uid()::text`；寫入者必須是品牌，或還沒建立帳號的使用者（品牌註冊時是先上傳 Logo、再建立帳號），創作者不能寫入。
- bucket 用 migration 建立（`insert into storage.buckets`），不依賴手動設定。

### 2.5 改名 Pollen → Kollink
資料庫尚未部署到任何環境，**直接修改原本的 migration 和測試**，不另寫改名 migration：
- GUC `pollen.in_transition` → `kollink.in_transition`，`pollen.recording_payment` → `kollink.recording_payment`。
- `package.json` 的 name、`layout.tsx` 的 title、規格文件與 README 中的 Pollen。
- 介面名稱集中在 `src/lib/site.ts`（`SITE_NAME = "Kollink"`）。

### 2.6 型別
- `supabase gen types typescript --local > src/lib/supabase/database.types.ts`，加 npm script `db:types`。
- CI 的 db job 在 `supabase db start` 之後重新產生並 `git diff --exit-code`，不一致就失敗。

### 2.7 選項設定
- 產業、內容領域、地區的選項放在 `src/lib/options.ts`。
- 內容領域初始選項：美妝、保養、美食、旅遊、寵物、3C、親子、穿搭、居家、運動、生活。
- 產業初始選項：美妝保養、食品飲料、服飾配件、3C 家電、母嬰親子、寵物、居家生活、旅遊住宿、餐廳、其他。
- 地區：台灣縣市列表 + 「海外」。
- 資料庫只檢查數量與長度，不檢查選項內容（品類尚未決定，改選項不用寫 migration）。

## 3. 登入實作

### Supabase 用戶端（`@supabase/ssr`）
| 檔案 | 用途 |
|---|---|
| `src/lib/supabase/server.ts` | `createClient()`：Server Component / server action 使用，帶使用者自己的 session，RLS 與狀態函式會以使用者身分判斷。 |
| `src/lib/supabase/client.ts` | 瀏覽器用，只用 publishable key。 |
| `src/lib/supabase/proxy.ts` | `updateSession(request)`：proxy 用，更新 session cookie 並回傳 user。 |
| `src/proxy.ts` | 呼叫 `updateSession`，依第 1 節規則導去 `/login`。 |
| `src/lib/auth/current-user.ts` | `getCurrentUser()`：回傳 `{ user, profile, brand, creator, verificationCode }` 或 null；用 React `cache()` 讓同一個請求只查一次；只能在 `<Suspense>` 內呼叫。 |

- `src/lib/supabase/admin.ts`（service role）不變，登入與註冊流程不使用它。

### 金鑰命名
- 已確認 CLI 3.2 提供 `PUBLISHABLE_KEY` 與 `SECRET_KEY`。環境變數改名為 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`、`SUPABASE_SECRET_KEY`，同步更新 `.env.example` 與 `admin.ts`；並實測 secret key 呼叫 `record_payment_success` 仍被判定為 service_role。
- secret / service role 金鑰只出現在 import `server-only` 的檔案，絕不放進 `NEXT_PUBLIC_*`。

### Email 驗證碼
- 寄送：`signInWithOtp({ email, options: { shouldCreateUser: true } })`。
- 驗證：`verifyOtp({ email, token, type: 'email' })`。
- 信件範本 `supabase/templates/otp.html`（中文），只放 `{{ .Token }}`，不放連結；`config.toml` 的 `magic_link` 與 `confirmation` 兩個範本都指向它。驗證成功後，瀏覽器前往 `/auth/continue`，由伺服器查身分後導向。
- 本機信件進 Mailpit（`http://127.0.0.1:54324`）。
- 重寄冷卻 60 秒（`config.toml` 的 `max_frequency` 與畫面倒數一致）。
- 正式環境 SMTP 在部署階段設定，不在本計畫範圍。

### Google 登入
- `signInWithOAuth({ provider: 'google', options: { redirectTo: '<origin>/auth/callback?next=...&role=...' } })`。
- `/auth/callback`（route handler）：`exchangeCodeForSession(code)`，再依第 1 節規則導向；失敗導去 `/login?error=callback`。
- `config.toml` 加入 `[auth.external.google]`（預設 `enabled = false`，照 README 設定後在本機改成 true），`client_id` / `secret` 用 `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)` / `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)`；`site_url` 與 `additional_redirect_urls` 包含 `http://127.0.0.1:3000` 和 `http://localhost:3000`。
- 環境變數 `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`：不是 `"true"` 時，Google 按鈕顯示「尚未設定」且不可點，Email 登入不受影響。

### 安全的 `next` 參數
`safeNextPath(input: string | null): string | null`：只接受以 `/` 開頭、第二個字元不是 `/` 或 `\`、不含控制字元、長度 ≤ 512 的路徑；其他一律回傳 null。

### 登出
server action 呼叫 `supabase.auth.signOut()`，再導向 `/`。

### 錯誤訊息（中文）
| 情況 | 訊息 |
|---|---|
| 驗證碼錯誤或過期 | 驗證碼錯誤或已過期，請重新取得 |
| 寄送太頻繁 | 寄送太頻繁，請稍後再試 |
| handle 重複 | 這個網址已經有人使用 |
| 欄位格式錯誤 | 對應欄位下方顯示原因 |
| 其他 | 發生錯誤，請稍後再試 |

### 表單驗證
表單規則寫在 `src/lib/validation/onboarding.ts`（純函式，不引入新套件），規則與 2.1 資料庫檢查一致；前端先驗證，資料庫是最後防線。

## 4. 測試與文件

### pgTAP
- `create_brand_account` / `create_creator_account`：正向案例；重複建立；未登入；各欄位格式錯誤；handle 重複；創作者 status 必為 pending；驗證碼格式正確。
- 直接 INSERT / UPDATE profiles / brand_profiles / creator_profiles 被拒絕（42501）。
- `update_brand_account` / `update_creator_account`：正向案例、`not a brand` / `not a creator`、各欄位格式錯誤（含 industry、region）、display_name 與 brand_name 同步、handle 撞名。
- `logo_path`：合法路徑可存、別人的資料夾、含 `..`、以 `.` 開頭、網址都被拒。
- 隱形字元：名稱只有 U+200B 或 U+3164 視為空白；前後 NBSP、U+3164、U+FE0F 被去掉；中間的零寬字元被移除；雙向控制字元在任何位置無效。
- `not authenticated`（有 authenticated 角色但沒有 sub）四個函式都測；資料庫擁有者直接寫入不合法的 logo_path 被 CHECK 擋下（23514）；authenticated 不能 DELETE 三張表；handle 唯一約束名稱為 `creator_profiles_handle_key`（錯誤對應依賴它，Postgres 預設命名）。
- `creator_verifications`：本人與管理員看得到、其他人與 anon 看不到、任何人不能寫入；anon 不能呼叫任何建立或修改函式。
- 停權中改 IG：頁面提示「已更換 IG 帳號。帳號目前暫停中，請聯絡客服」（approved 改 IG 則提示重新審核）。
- handle：未鎖定可經函式修改；鎖定後（含退回 pending）對 authenticated、service_role、沒設 GUC 的 postgres 都不能改，設了 `kollink.allow_handle_change` 的 postgres 可以；不能改 status；service_role 不能新增或刪除 creator_profiles。
- 改 IG：approved 改 IG → pending 且換新驗證碼；只改粉絲數仍 approved；suspended 改 IG 仍 suspended 且換新碼；大小寫差異不算更換。
- 不能更新別人的 profile / creator_profile / brand_profile（地基待辦）。
- `brand-logos`：品牌與尚未建立帳號的使用者可以上傳到自己的資料夾，不能上傳到別人的資料夾，創作者不能上傳。
- 既有 94 項測試改名後全部通過。

### Vitest
- `safeNextPath`：`//evil.com`、`/\evil.com`、`https://evil.com`、`javascript:`、含換行、空字串、正常路徑。
- `resolvePostLoginPath`：第 1 節表格的每一種情況，加上 `next` 指向另一區時改回預設頁。
- `onboarding` 驗證：每個欄位的邊界值。

### 端對端驗收
在本機用 Email 驗證碼（從 Mailpit 取碼）各註冊一次品牌與創作者，確認導向、審核中提示與驗證碼、走錯區被導回、handle 審核後鎖定、登出。由沒參與實作的 subagent 驗收。

### CI
db job 加型別漂移檢查；其他不變。

### README
- 本機開發：Docker、`npx supabase start`、`.env.local`（從 `.env.example` 複製並填入 `supabase status` 的值）、`npm run dev`、`npm run test`、`npm run test:db`、Mailpit 網址。
- Google OAuth 設定步驟（可直接複製的文字）：在個人 Google Cloud 專案建立 OAuth 用戶端、授權的重新導向 URI `http://127.0.0.1:54321/auth/v1/callback`、把 client id / secret 填進 `.env.local`、重新啟動 Supabase。
- 審核創作者（在 Supabase Studio SQL Editor 執行）：
  ```sql
  select cp.handle, cp.ig_username, cp.follower_count, v.code
  from public.creator_profiles cp
  join public.creator_verifications v on v.user_id = cp.user_id
  where cp.status = 'pending'
  order by cp.created_at;

  update public.creator_profiles set status = 'approved'
    where handle = '填入網址代稱' and ig_username = '填入你確認過的 IG 帳號';
  -- 受影響 0 列代表創作者在審核期間改了 IG（會退回審核並換新驗證碼），請重新確認
  ```

## 5. 不在本次範圍
- LINE 登入、品牌統編與發票資料、作品上傳、報價編輯（計畫 3）
- 管理後台的審核介面（計畫 9）
- 審核結果通知信
- 正式環境 SMTP、正式環境 Google OAuth 網址（部署階段）
- 一個帳號兩種身分、品牌多成員
