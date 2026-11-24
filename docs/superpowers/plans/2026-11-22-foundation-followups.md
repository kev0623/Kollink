# 地基完成後的待辦與注意事項

地基計畫（`2026-11-22-foundation.md`）執行期間，審查留下的延後項目，以及執行中做出、和計畫原文不同的決定。寫後續計畫前先看這份。

## 執行中做出的決定（以這裡為準，和計畫原文不同）

| 決定 | 內容 |
|---|---|
| 品牌身分自行宣告 | MVP 接受：任何人都能註冊成品牌、看到報價。這是「註冊才看得到價格」的導流設計，不是保密。之後若出現大量抓取，再加入品牌審核或流量限制。 |
| 未審核創作者的報價 | 品牌看不到（只看得到已審核創作者的報價）。 |
| 預設權限收緊 | 每張 public 資料表都撤銷 anon / authenticated 的 `truncate, trigger, references`。 |
| 狀態只能經由函式改變 | 連 service_role 與資料庫擁有者都不能直接改合作案的狀態類欄位（guard trigger）；service_role 對 `collaborations` 只有 SELECT。 |
| 標記已付款 | 只能經由 `record_payment_success`（`kollink.recording_payment` 旗標）；service_role 也不能直接呼叫 `mark_paid`。 |
| 參與者身分優先 | 身分判斷順序為 system > brand > creator > admin。管理員若是案子的參與者，只能以參與者身分操作，不能幫自己的案子撥款。 |
| 發佈連結 | 必須是完整網址（有網域和路徑）。 |
| 取消後才到的付款（B1） | 記錄為已付款、`refund_required = true`，寫入 audit（`payment_requires_refund`），回覆綠界 `1|OK`；實際退款留給計畫 8。 |
| 付款金額 | 必須同時等於付款單金額和合作案報價；不接受空值。 |
| 綠界通知 | 檢查 MerchantID（新環境變數 `ECPAY_MERCHANT_ID`）；`SimulatePaid=1` 的模擬付款只回覆收到、不記錄；金額只接受純整數。 |

## 各計畫需要處理的事項

### 2. 登入與註冊
- 還沒有 `profiles` 的使用者，`my_role()` 會是 null；middleware 要把他們導向註冊流程，並**排除 `/api/payments/ecpay/notify`**。 → 已完成（計畫 2）
- `next.config.ts` 開了 `cacheComponents`：`cookies()` 必須放在 `<Suspense>` 底下，參考 `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`。 → 已完成（計畫 2）
- 加入 `@supabase/ssr`；確認 Supabase CLI 3.x 的金鑰命名（publishable / secret），並更新 `.env.example`。 → 已完成（計畫 2）
- 加入 `supabase gen types typescript` 產生的型別，以及 CI 的型別漂移檢查。 → 已完成（計畫 2）
- 補測試：跨使用者更新無效、創作者不能建立品牌檔案、以 pending 狀態建立檔案的正向對照。 → 已完成（計畫 2）
- ~~決定正式名稱~~ → 已定為 Kollink（計畫 2 Task 1）
- README 補上本機開發步驟（Docker、`supabase start`、`.env.local`、`npm run test:db`）。 → 已完成（計畫 2）
- 品牌 Logo（`brand-logos`）部署注意：
  - 正式環境必須開啟 Email 驗證、關閉匿名登入，因為還沒建立 profile 的使用者也能上傳 Logo。
  - 要加排程清理：刪除沒有被任何 `brand_profiles.logo_path` 引用、且超過 24 小時的 `brand-logos` 物件。
  - 若日後新增上傳用的 server action，要驗證圖片 magic bytes，不能只信 MIME type 與副檔名。
- 計畫 2 新增的後續事項：
  - 管理員目前登入後會被導去 `/onboarding`（計畫 9）。
  - 正式環境 SMTP 與 Google OAuth 網址（部署，見 README）。
  - `create_*_account` 尚未限制同一 IP 的註冊頻率（上線前評估）。
  - 品牌 Logo 孤兒物件清理排程尚未實作（見上方 Logo 注意事項）。
  - 審核狀態橫幅在 client 端導覽後不會更新，要重新整理才會看到最新狀態。
  - 色彩 token：`text-white` 尚未納入 token；錯誤文字的對比度需再檢查。
  - 之後每個資料頁都必須呼叫 `requireRole`，否則沒有角色或未審核的使用者會直接看到頁面。
  - 選項白名單（產業、地區、內容領域等）只在 UI 端強制（同計畫 4、5 的項目）。

### 3. 創作者公開檔案頁
- 訪客（anon）讀不到 `profiles.display_name`；缺少頭像欄位；評分、完成案數、準時率需要合作資料，但 RLS 會擋住 → 需要一個欄位，或只開放必要欄位的 view / definer 函式，另外要建評價資料表。
- 收藏 ♡ 需要一張資料表。

- 計畫 2 Task 3 修正收回了創作者對 `engagement_rate`、`style_tags`、`collab_types`、`bio` 的直接 UPDATE（`profiles`、`brand_profiles`、`creator_profiles` 的 UPDATE 權限與 `*_update_self` policy 全部移除，修改改走 definer 函式）。公開檔案頁要改 bio / style_tags / collab_types / engagement_rate 時，擴充 `update_creator_account` 或另開 definer 函式。

### 4. 創作者廣場、5. 招募與機會頁
- 索引：`creator_profiles(status)`、`categories` / `style_tags` 的 GIN 索引、`briefs(status, deadline)`、`briefs(brand_id)`、`brief_applications(creator_id)`、`conversations(creator_id)`、`collaborations(conversation_id)`、`collaborations(brief_id)`。
- 報名的狀態變更需要 definer 函式（目前沒有開放 UPDATE）。錄取時，要在同一個 transaction 裡建立對話和合作案。
- 待決定：尚未審核的創作者能不能報名；超過截止日但狀態仍是 open 的招募要不要擋；品牌刪除招募時，報名紀錄會一起被刪除（cascade），這樣是否可接受。
- 刪除 `public/*.svg` 這些 scaffold 留下的圖檔。
- 產業、地區、內容領域的白名單只在 UI 端強制，資料庫只檢查長度與數量。
- 搜尋與篩選必須能容忍清單以外的值；若需要嚴格清單，要在資料庫端強制。

### 6. 合作案詳情頁
- 貼文連結在 app 端用 `new URL()` 再檢查一次（資料庫的 regex 會接受 `a..b.com`）。
- server action 代替品牌或創作者操作時，必須用**使用者自己的 client**；用 service_role 呼叫會被判定為 system，品牌或創作者的動作會被拒絕。

### 7. 站內訊息
- `flagged_contact` 用 BEFORE INSERT trigger 計算，不要讓訊息改走 service_role（那樣 `sender_id` 的預設值 `auth.uid()` 會是 null）。
- 把 `messages` 加進 `supabase_realtime` publication。
- 待決定：誰可以主動開啟對話（目前任何品牌或創作者都可以，包括尚未審核的創作者）。
- 補測試：偽造 sender、第三方建立對話、update / delete 被拒絕、管理員可見性。

### 8. 付款建單與撥款（**真的收錢之前必須完成**）
- `create_payment_order(collab_id)`：definer 函式，檢查呼叫者是品牌、狀態是 `awaiting_payment`、金額等於合作案報價，並由函式產生 `merchant_trade_no`。
- 付款金額和合作案報價不符時，目前會報錯，沒有留下任何紀錄，綠界還會一直重送 → 要記錄這筆異常並發出警示。
- 退款流程：清除 `refund_required` 的函式；`failed → paid` 的規則要寫清楚。
- `raw_notify` 只保留白名單欄位（可能含有 card4no / card6no）。
- `provider_trade_no` 不接受只有空白的值；金額設定上限（綠界單筆限額）。
- route 補單元測試（mock `createAdminClient`）；用真實的沙盒通知補一項簽章測試。
- 帳號刪除改用 soft delete（`collaborations` 和 `payments` 的外鍵會擋住實體刪除）。

### 9. 管理後台
- 管理員目前只能讀取。需要 `set_creator_status()`（definer 函式，檢查 `is_admin()`），以及取消或爭議處理的狀態轉換。
- `is_admin()`、`my_role()`、`is_conversation_participant()` 的 EXECUTE 權限從 PUBLIC 收回。

### 10. 審核逾期自動通過
- `transition_collaboration` 的 system 身分要求「透過 PostgREST 以 service_role 呼叫」；**pg_cron 以 postgres 身分執行會被判定為「不是參與者」**。可以改用 Next route 搭配 Cron 和 secret，再以 service_role 呼叫 RPC；或另外寫一個只授權給 service_role 的 `auto_approve_due()` definer 函式。

## 部署

## 正式環境（Hosted Supabase）設定

上線前在 Supabase 後台逐項設定（本機的 `config.toml` 不會自動套用到正式專案）：

1. Authentication → Providers → Email：開啟「Confirm email」（對應 `enable_confirmations = true`）；Email OTP 長度 6、有效期限 900 秒。
2. 密碼登入封鎖：真正的保證是 migration 裡的 `null_encrypted_password` trigger（推送 migration 即生效，不受方案限制）。另外在 Authentication → Hooks 新增 Postgres hook「Password verification attempt」指向 `public.hook_reject_password`，作為第二層防護（此 hook 可能只在付費方案提供）。
3. Authentication → URL Configuration：Site URL 填正式網址；Redirect URLs 加入 `https://正式網址/**`。
4. Authentication → Emails：「Magic Link」與「Confirm signup」範本的主旨與內容都換成 `supabase/templates/otp.html`（`Kollink 登入驗證碼` / `Kollink 註冊驗證碼`）。
5. Authentication → SMTP Settings：設定自訂 SMTP（內建寄信有嚴格頻率上限，不能用於正式環境）。
6. Authentication → Attack Protection：開啟 CAPTCHA（Turnstile 或 hCaptcha），並同步在登入頁加上對應元件。
7. Google OAuth：Providers → Google 填入用戶端 ID／密鑰；Google Cloud Console 的重新導向 URI 加上 `https://<專案>.supabase.co/auth/v1/callback`。
