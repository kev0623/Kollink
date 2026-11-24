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
| 資料表權限寫在 migration | 雲端新專案不會自動授權 public 資料表給 anon / authenticated / service_role（本機會）。`20261124000100_explicit_api_grants.sql` 補齊現有權限；之後每個新增資料表的 migration 都要自己寫 `grant`，否則本機測試會過、雲端會 permission denied。 |
| 綠界通知 | 檢查 MerchantID（新環境變數 `ECPAY_MERCHANT_ID`）；`SimulatePaid=1` 的模擬付款只回覆收到、不記錄；金額只接受純整數。 |
| 報價只能經由函式寫入 | 計畫 3 起 `creator_rates` 收回 anon / authenticated 的 INSERT、UPDATE、DELETE，只能用 `set_creator_rates`；取消勾選的合作形式，報價由 `update_creator_public_profile` 一併刪除。 |
| 公開頁不快取 | `/c/[handle]` 每次請求以使用者自己的 client 讀取，因為審核狀態目前在 Studio 用 SQL 改、App 無法觸發 revalidate。找不到時回應碼是 200 + `noindex`（串流後才 `notFound()`，soft 404）。 |
| 收藏直接寫資料表 | `creator_favorites` 由品牌自己的 client 直接 insert／delete（RLS：只能讀、增、刪自己的，新增時必須是品牌；不開放 UPDATE）；重複收藏的 `23505` 視為成功。資料庫允許收藏未審核的創作者，廣場只列出已審核的。 |
| 廣場搜尋只給品牌 | `search_creators`、`popular_style_tags` 是 definer 函式，非品牌一律 `42501`（結果含起價與貼文報價，延續「報價只給品牌看」）。總數用 window 函式放在 `total_count`。 |
| 廣場分頁 | 篩選、排序、關鍵字在網址；「載入更多」是 Server Action 回傳下一批（一次 24 位），頁數不在網址，分享或重新整理回到第一批。 |
| 廣場區間 | 粉絲與起價區間一律含下限、不含上限（例如「1 千到 1 萬」是 1,000–9,999）。 |

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
  - 品牌 Logo 孤兒物件清理排程尚未實作（見上方 Logo 注意事項）；計畫 3 的 `creator-media` 共用同一項。
  - 審核狀態橫幅在 client 端導覽後不會更新，要重新整理才會看到最新狀態。
  - 色彩 token：`text-white` 尚未納入 token；錯誤文字的對比度需再檢查。
  - 之後每個資料頁都必須呼叫 `requireRole`，否則沒有角色或未審核的使用者會直接看到頁面。（計畫 3 的 `/creator/me/profile` 與其 server action 已呼叫；公開頁 `/c/*` 刻意不呼叫）
  - 選項白名單（產業、地區、內容領域等）只在 UI 端強制（同計畫 4、5 的項目）。
  - proxy 對每個 RSC prefetch 都呼叫 `getUser()`（會打 Auth 伺服器）；可評估改用 `getClaims()`。
  - 已登入的使用者造訪 `/login` 會停留在登入頁；可考慮直接導回首頁。
  - service_role 仍可直接寫入 `profiles`、`brand_profiles`；可考慮比照 `creator_profiles` 收回其寫入權限。

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
  - 公開頁 `metadataBase` 只在關閉 Vercel 系統環境變數或非 Vercel 部署時才需要設定（Next 16 會退回使用 `VERCEL_PROJECT_PRODUCTION_URL`）。
  - 品牌透過鎖定報價的連結註冊後，onboarding 完成會落在 `/brand`（onboarding 沒有帶 `next`）；考慮讓 `next` 穿過 onboarding。
  - 計畫 3 最終審查延後項目：
    - 收回 `service_role` 對 `creator_rates` 的寫入權限並加測試。
    - 缺少的測試：停權創作者、報價／作品 payload 形狀錯誤、anon client 設定、`loadPortfolio`／`loadRates` 錯誤與空資料、AvatarField。
    - IG 連結 regex 大小寫敏感且不接受 `#fragment`（資料庫與前端要一起改）。
    - `validatePortfolio` 路徑格式、`parseRatesForm` 去重、`parsePortfolioForm` 數量上限。
    - `formatPercent(NaN)`、`toNumberOrNull("")`。
    - JSDoc 註明 `loadPortfolio`／`loadRates` 會讀 cookies；PostgrestError 與 Error 的差異；本人頁 `.single()`。
    - 跨資料夾的 pgTAP 測試有雙重防護，需要整理。
    - `/c` layout 底部 6rem padding 對所有身分都存在。
    - 全站 `error.tsx`。
    - 頂列「登入」沒有帶 `next`（需要 `usePathname` 的 client island）。
    - 「已儲存」提示改 sticky。
    - Storage 孤兒物件（排程清理）。
    - OG 圖片下載 Google 字型沒有 timeout。

### 4. 創作者廣場、5. 招募與機會頁
- 索引：`creator_profiles(status, created_at desc)`、`categories`／`style_tags`／`collab_types` 的 GIN、`creator_rates(creator_id, price_twd)`、`creator_favorites(brand_id, created_at desc)` → 已完成（計畫 4）。還沒做：`briefs(status, deadline)`、`briefs(brand_id)`、`brief_applications(creator_id)`（計畫 5）、`conversations(creator_id)`、`collaborations(conversation_id)`、`collaborations(brief_id)`（計畫 6、7）。
- 報名的狀態變更需要 definer 函式（目前沒有開放 UPDATE）。錄取時，要在同一個 transaction 裡建立對話和合作案。
- 待決定：尚未審核的創作者能不能報名；超過截止日但狀態仍是 open 的招募要不要擋；品牌刪除招募時，報名紀錄會一起被刪除（cascade），這樣是否可接受。
- 刪除 `public/*.svg` 這些 scaffold 留下的圖檔 → 已完成（計畫 4）。
- 產業、地區、內容領域的白名單只在 UI 端強制，資料庫只檢查長度與數量。
- 搜尋與篩選必須能容忍清單以外的值 → 廣場已做到（計畫 4：網址值清理後照常比對，比對不到就是沒有結果）；計畫 5 的招募篩選比照辦理。若需要嚴格清單，要在資料庫端強制。
- 計畫 4 新增的後續事項：
  - 從公開頁按 ♡ 後用瀏覽器「上一頁」回到廣場，畫面是快取的舊狀態（重新整理或從導覽列進入就正確）；♡ 刻意不 revalidate，避免每按一次重跑整頁搜尋。
  - 在「只看收藏」裡取消收藏，卡片留到下次篩選或重新整理才消失。
  - 列表模式的使用者進入廣場時，會先看到一瞬間卡片（server snapshot 固定是卡片）。
  - 列表的「貼文報價」欄顯示 IG 貼文價，但點標題是依起價排序（spec 只有四種排序）。
  - 關鍵字是 `ilike '%…%'`，用不到索引；目前資料量下搜尋相關索引大多用不到，創作者到數千位時重新評估（例如 `pg_trgm` GIN 索引）。
  - 風格標籤選項只列最熱門的 20 個；冷門標籤只能用網址 `?tag=` 篩選。
  - 收藏數沒有上限、也沒有收藏清單頁（spec 決定用「只看收藏」開關）。
  - 表單輸入的 NUL（`\u0000`）會進到資料庫並以 22P05 失敗：要比照雙向控制字元（bidi）處理，JS 的 `cleanText`／`hasBidi` 與 SQL 的 `clean_text`／`has_bidi` 兩邊都要擋，且兩邊的字元集合必須完全一致。
  - 篩選抽屜（FilterDrawer）開著時若視窗拉寬超過 `lg`，仍維持 modal 狀態。
  - `FavoriteButton` 在請求進行中沒有 disabled。
  - 角色是 brand 但沒有 `brand_profiles` 的帳號按收藏，會得到外鍵錯誤 `23503`。

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
- `is_admin()`、`my_role()`、`is_conversation_participant()` 的 EXECUTE 權限從 PUBLIC 收回。brand-logos 的 insert/update policy 以 authenticated 身分呼叫 my_role()，收回後要再 grant 給 authenticated。

### 10. 審核逾期自動通過
- `transition_collaboration` 的 system 身分要求「透過 PostgREST 以 service_role 呼叫」；**pg_cron 以 postgres 身分執行會被判定為「不是參與者」**。可以改用 Next route 搭配 Cron 和 secret，再以 service_role 呼叫 RPC；或另外寫一個只授權給 service_role 的 `auto_approve_due()` definer 函式。

## 部署

正式環境（Hosted Supabase 與 Vercel）的設定清單以 README 的「正式環境（Hosted Supabase）設定」與「部署（Vercel）」為準，這裡不重複（避免兩份清單不一致）。清單包含：Redirect URLs 加 `https://<site>/auth/callback**`、關閉匿名登入、Email 範本、自訂 SMTP、CAPTCHA、Google OAuth。
