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
| 招募寫入只走函式 | `briefs`、`brief_applications` 收回 anon／authenticated／service_role 的寫入（anon 連讀取都沒有）；寫入只能經由 `save_brief`、`close_brief`、`delete_brief`、`apply_to_brief`、`withdraw_application`、`decide_application`。 |
| 台灣日期 | 「今天」一律是 `today_tw()`（`Asia/Taipei`）；TS 的 `todayTw()` 同一條規則。`today_tw(p_now)` 的參數只給測試驗證跨日邊界，policy 與函式一律不帶參數呼叫。 |
| 招募狀態 | `draft → open → closed`；「已截止」由 `deadline < today_tw()` 算出，不寫進資料庫。截止日當天可以報名；截止或關閉後品牌仍可錄取／婉拒。只有草稿能刪除；不能重新開啟、不能改回草稿。 |
| 未審核創作者 | 可以瀏覽機會與詳情，不能報名（`42501 creator not approved`）。 |
| 招募可見性 | 招募主、管理員、創作者（開放中且未截止）、報名過的人（任何狀態）。品牌看不到其他品牌的招募。判斷寫在 definer helper `can_view_brief`（避免兩張表的 policy 互相遞迴）。 |
| 錄取 | 計畫 6 起錄取 = 建立合作案：`accept_application_with_collab` 在同一個 transaction 把報名改成 accepted、取得或建立對話、建立合作案（`awaiting_payment`，案名 = 招募名稱）。`decide_application` 只剩婉拒。錄取或婉拒後不能改；撤回後不能再報名同一則。 |
| 預算 0 | 視為沒填（存成 null）；「現金」篩選與「預算或產品至少一項」都依此判斷。 |
| 建立合作案只走函式 | `collaborations`、`conversations` 收回所有 API 角色的寫入（只剩 SELECT）；建立只能經由 `accept_application_with_collab`、`invite_creator`。同一對品牌／創作者只有一個對話（取得或建立並鎖住），同一個品牌對同一位創作者同時只能有一個 invited。 |
| 合作案讀取 | 列表 `list_my_collaborations`（只列自己參與的）、詳情 `get_collaboration` 與事件 `list_collaboration_events`（參與者與管理員）是 definer 函式；交稿紀錄用 RLS 直接讀。頁面另外要求視角等於該區。 |
| 交稿 | 私密 bucket `deliverables`（50 MB、圖片／影片／PDF），路徑 `<合作案>/<創作者>/<uuid>.<副檔名>`；只有創作者在 awaiting_submission 能上傳到自己的資料夾；交出去的檔案不能刪、不能換。交稿紀錄只能經由 `submit_deliverables`（同時推進到 in_review；創作者的 `submit` 轉換也只能走這個函式）。原始檔名不保存。 |
| 付款與撥款（計畫 8、9 前） | 不收錢。管理員用 README 的 SQL 標記：已付款一律「service_role 建付款單 → `record_payment_success`」；撥款以 service_role 呼叫 `transition_collaboration(..., 'payout')`。本機另有 `/api/dev/mark-paid`（開關同測試快速登入）。 |
| 審核逾期自動通過 | Vercel Cron（`vercel.json`，每天 UTC 01:00）→ `/api/cron/auto-approve`（`CRON_SECRET`、常數時間比對）→ service_role 呼叫只授權給 service_role 的 `auto_approve_due()`；一件失敗不影響其他件。用 `vercel.json` 而不是 `vercel.ts`（後者要新增 `@vercel/config` 套件）。 |
| 站內訊息只走函式 | `messages` 收回所有 API 角色的寫入與 anon 讀取（只剩 authenticated／service_role 的 SELECT）；送出只能經由 `send_message`（參與者、內文 1–2000 字、對話未暫停、每人每分鐘 20 則）。`flagged_contact` 一律由 BEFORE INSERT trigger（`has_contact_info`）計算，規則與 `src/lib/messages/contact.ts` 相同。 |
| 誰能開啟對話 | 只有品牌，經由 `start_conversation`（已審核創作者；已有對話直接回傳；24 小時最多 30 個新對話）。創作者（包括報名過的）不能主動開啟。品牌開了但還沒傳訊息、也沒有合作案的空對話，創作者看不到。 |
| 對話暫停 | 創作者不是 approved 時，雙方都不能再送訊息，歷史訊息照常顯示。 |
| 已讀與即時 | `conversation_reads.last_read_at` = 最後一則訊息的 `created_at`，由 client 在開啟對話與收到訊息時呼叫 `mark_conversation_read`。即時更新用 Realtime Postgres Changes（`messages` 在 `supabase_realtime` publication；RLS 以訂閱者身分過濾），訂閱前先 `realtime.setAuth()`。 |

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
- 索引：`creator_profiles(status, created_at desc)`、`categories`／`style_tags`／`collab_types` 的 GIN、`creator_rates(creator_id, price_twd)`、`creator_favorites(brand_id, created_at desc)` → 已完成（計畫 4）。`briefs(status, deadline)`、`briefs(brand_id, created_at desc)`、`brief_applications(creator_id, created_at desc)`、`brief_applications(brief_id, status)` → 已完成（計畫 5）。`conversations(creator_id)`、`collaborations(conversation_id)`、`collaborations(brief_id, creator_id)`（唯一）→ 已完成（計畫 6）。
- 報名的狀態變更需要 definer 函式 → 已完成（計畫 5：`withdraw_application`、`decide_application`）。錄取時在同一個 transaction 建立對話和合作案 → 已完成（計畫 6：`accept_application_with_collab`）。
- ~~待決定：未審核能不能報名、截止後要不要擋、刪除招募時報名一起刪~~ → 已決定（計畫 5）：未審核不能報名；截止後不能報名；只有草稿能刪除（草稿沒有報名）。
- 刪除 `public/*.svg` 這些 scaffold 留下的圖檔 → 已完成（計畫 4）。
- 產業、地區、內容領域的白名單只在 UI 端強制，資料庫只檢查長度與數量。
- 搜尋與篩選必須能容忍清單以外的值 → 廣場已做到（計畫 4）；招募也做到（計畫 5：`?tab=`、`?cat=`、`?step=` 的垃圾值照常顯示，清單外的內容領域只是沒有結果）。若需要嚴格清單，要在資料庫端強制。
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
  - 七位數以上的起價（例如 NT$1,234,567）在 lg／xl 寬度會超出卡片被切掉；10 萬以上可改用精簡格式（如 `NT$123.5萬`）。
  - ♡ 的錯誤訊息不會自動消失，窄螢幕可能被切到；卡片的 focus 外框在 ♡ 取得焦點時也會亮；列表每列有兩個連到同一頁的連結。
  - 關鍵字先 trim 再截成 50 字，結尾可能留一個空白（只影響輸入框顯示）。
  - 測試缺口：pgTAP 的 `\` 照字面比對、20 個標籤上限、排序斷言偏弱；`requireRole` 拒絕非品牌、刪除不存在的收藏沒有測試；♡ 樂觀更新與回復沒有測試；aria 斷言依賴屬性順序；♡ 疊層與頭像替代字沒有測試。
  - 角色是 brand 但沒有 `brand_profiles` 的帳號按收藏，會得到外鍵錯誤 `23503`。
- 計畫 5 新增的後續事項：
  - `brief-covers` 孤兒物件（換封面、刪草稿時刪檔失敗、表單離開時未儲存的上傳）與其他 bucket 共用同一個清理排程（尚未實作）。草稿的封面網址若被猜到也看得（公開 bucket，路徑含 UUID）。
  - NUL（U+0000）只在招募與報名表單擋（`hasBadChar`）；其他既有表單仍會得到 22P05 →「發生錯誤」。要全面處理時，把 `hasBidi` 的呼叫點都換成 `hasBadChar`。
  - 「我的報名」最多列 100 筆、沒有分頁；報名者列表沒有分頁；品牌「我的招募」最多 200 則；`brief_application_counts` 的 `p_ids` 沒有筆數上限（建議加 ≤100）。
  - 招募與機會頁不快取（每次請求以使用者 client 讀取）；截止日在台灣午夜跨日時，已開著的頁面要重新整理才會更新。
  - 404 在 `<Suspense>` 內觸發，回應碼是 200 + `noindex`（與 `/c/[handle]` 相同）。
  - 「適合我」的內容領域與地區比對是完全相等（清單外的值不會模糊比對）。
  - 錄取或婉拒沒有通知（spec 不在範圍內）；錄取後建立對話、合作案 → 已完成（計畫 6）。
  - 品牌刪除帳號時，招募與報名會 cascade 刪除（帳號刪除流程見計畫 8 的 soft delete 項目）。
  - 發佈、關閉、錄取後沒有 revalidate `/creator` 相關路徑（頁面本來就不快取，影響有限）；重複點擊關閉／錄取／撤回時顯示錯誤而不是靜默重新整理（`isStaleStateMessage` 以在地化文字比對，建議改用錯誤代碼）。
  - 已知小問題：分頁籤與篩選 chip 高度 36px 小於 44px 觸控目標、沒有 focus-visible；婉拒按鈕沒有進行中標示；空 handle 會連到 `/c/`；`briefs_select` 每列呼叫 definer（規模變大再看）；rows-guard 沒有 pgTAP 測試。
  - 計畫 5 最終審查留下的小事（皆不影響上線）：
    - 招募表單草稿步驟 1–3 按 Enter 會儲存草稿（新招募會導向編輯頁）。
    - 創作者手機報名面板高度 70vh，鍵盤彈出時偏擠。
    - `list_opportunities` 的頁數超過最後一頁時 total 會是 0。
    - `planCoverUpload` 沒有檢查 id 格式。
    - 舊的 `budget_*` CHECK 與新的重複，可移除。
    - 錯誤對照：invalid title／description 只顯示通用訊息，invalid accept 沒有對照。
    - `formatDateTw` 遇到無效 ISO 字串會 throw。
    - `delete_brief` 在多則招募共用同一個 `cover_path` 時的邊界情況。
    - `savedMark` 型別是 `unknown`。
    - 「已報名」分頁的 skeleton 是 grid，與實際列表不一致。
    - `/creator` 頁沒有單元測試（只有 E2E）。
    - 開發備註：瀏覽器測試開發伺服器請用 `http://localhost`，不要用 `127.0.0.1`（`allowedDevOrigins`）。

### 6. 合作案詳情頁
- 貼文連結在 app 端用 `new URL()` 再檢查一次（資料庫的 regex 會接受 `a..b.com`）。→ 已完成（計畫 6）
- server action 代替品牌或創作者操作時，必須用**使用者自己的 client**；用 service_role 呼叫會被判定為 system，品牌或創作者的動作會被拒絕。→ 已完成（計畫 6）
- 計畫 6 新增的後續事項：
  - `deliverables` 孤兒物件（上傳後沒有交稿、離開頁面）與其他 bucket 共用同一個清理排程（尚未實作）。
  - 交稿檔案不保存原始檔名，畫面顯示「圖片 1」「PDF 2」；需要原始檔名時另外存一欄。
  - 上傳只檢查 MIME type 與大小（bucket 也擋一次），沒有檢查 magic bytes；檔案只給雙方看、用 signed URL 開新分頁。
  - signed URL 在頁面渲染時產生、有效 1 小時；頁面開超過 1 小時後點檔案要重新整理。
  - 列表最多 200 筆、沒有分頁；管理員的全部合作案列表在計畫 9。
  - 沒有任何通知（spec 不在範圍內）；對方動作後要重新整理才看得到（即時更新在計畫 7）。
  - Hobby 方案的 Cron 一天一次，實際是「到期後最晚隔天自動通過」；升級 Pro 後可改成每小時。Hobby 的 Cron 會在 UTC 01:00–01:59（台灣 09:00–09:59）內任何時間觸發；Vercel Production 沒設 `CRON_SECRET` 時 route 回 500、不會自動通過任何合作案。
  - 錄取時案名固定是招募名稱（表單沒有案名欄）；修改金額、爭議處理、評價都不在範圍內。
  - `auto_approve_due` 的失敗只寫 Postgres warning 與 Vercel log，沒有告警。
  - 交稿的上傳在沒有交稿時不會被清掉（併入上面 `deliverables` 孤兒物件的清理排程）；交稿與刪除檔案之間有競態（submit／delete 同時發生）。
  - `accept_application_with_collab` 沒有重新檢查創作者仍是 approved（`invite_creator` 有檢查）。
  - `collabErrorMessage` 以完全比對轉中文，遇到動態訊息（例如 `collaboration <uuid> not found`）會落到預設訊息；建議改用錯誤代碼或前綴比對。
  - 最終審查留下的項目（資料庫與權限）：
    - 品牌讀得到 `collaborations/<id>/` 資料夾下尚未交稿的上傳檔（`can_read_deliverable` 只看合作案雙方，不看檔案是否已在某次交稿裡）。
    - 付款事件 `payment_requires_refund` 對創作者顯示的文字要再調整，避免讓創作者以為是自己的問題。
    - 刪除檔案時檢查 `file_paths` 沒有 GIN 索引（交稿數量大之後再加）。
    - `auto_approve_due` 的 `skip locked` 沒有並行測試。
    - pgTAP 測試 16 有一個恆真的斷言，之後改成有實際判斷力的版本。
    - SQL 註解寫 `DELIVERABLE_NAME_RE`，TS 常數實際叫 `NAME_RE`，兩邊名稱要對齊。
    - 列表用 inner join，`profiles` 列不存在時整個合作案會從列表消失。
  - 最終審查留下的項目（程式與畫面）：
    - `src/app/api/cron/auth.ts` 沒有 `import "server-only"`。
    - `/api/dev/mark-paid` 會回傳原始資料庫錯誤、沒有 CSRF 防護（僅限本機開發）。
    - dev-login route 對沒有 body 的 POST 會當掉（僅限本機開發）。
    - `PublishForm` 的 client 錯誤訊息在編輯輸入時不會消失。
    - `OfferForm` 重新送出時，上一次的伺服器錯誤會閃一下。
    - 合作案分頁列在窄螢幕沒有 `overflow-x-auto`。
    - 狀態徽章與頁面其他文字有重複資訊；載入骨架是靜態的，與實際版面不完全一致。
    - 「審核通過」按鈕在要求修改的表單展開時沒有 disabled。
    - 沒有「品牌看得到邀請按鈕」的測試。
    - 部署空窗期：舊版「錄取」按鈕在資料庫已更新、程式還沒部署時會短暫失敗。

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
  - 已讀時間用最後一則訊息的 `created_at`：極少數情況下，較早的 `created_at` 卻較晚 commit 的訊息會被當成已讀（`mark_read` 用 `max(created_at)`，存在競態）。
  - 頻率限制已用 advisory lock 序列化（`20261126000300`），但沒有並行測試。
  - 品牌按「傳訊息」就會建立對話（即使最後沒有送出），24 小時 30 個的上限也把錄取、邀請建立的對話算進去。
  - 創作者可以 SELECT 品牌開啟但還沒傳訊息的空對話（資料表層級的 RLS；列表函式與頁面會過濾，直接查表看得到）。
  - 導覽列在桌面時有兩個徽章元件（側邊與隱藏的底部導覽列），各自訂閱一次 Realtime；徽章的螢幕閱讀器文字與 hydration 後才彈出（pop-in）的表現待調整。
  - Realtime 斷線只顯示提示；重新連上（live）時會重新整理，但沒有自動輪詢。
  - Realtime 的 DELETE 事件只帶 id（目前沒有刪除訊息功能，之後做刪除時要處理）。
  - `compareMessages` 只比到毫秒，資料庫是微秒；同一毫秒內的訊息排序靠 id。
  - 輸入框的字數計數用原始內容，送出前才清理（`cleanMessageBody`），兩者可能差幾個字。
  - `İ`（帶點大寫 I）的小寫化在 JS 與 SQL 的行為不完全一致（聯絡方式偵測）。
  - `list_messages` 的索引沒有 id 作為 tiebreak。
  - 對話頁的捲動在手機是整頁捲動，輸入區用 sticky 固定在底部導覽列上方；iOS 鍵盤彈出時的表現只在 E2E 的 390 寬模擬過。

### 8. 付款建單與撥款（**真的收錢之前必須完成**）
- `create_payment_order(collab_id)`：definer 函式，檢查呼叫者是品牌、狀態是 `awaiting_payment`、金額等於合作案報價，並由函式產生 `merchant_trade_no`。
- 付款金額和合作案報價不符時，目前會報錯，沒有留下任何紀錄，綠界還會一直重送 → 要記錄這筆異常並發出警示。
- 退款流程：清除 `refund_required` 的函式；`failed → paid` 的規則要寫清楚。
- `raw_notify` 只保留白名單欄位（可能含有 card4no / card6no）。
- `provider_trade_no` 不接受只有空白的值；金額設定上限（綠界單筆限額）。
- route 補單元測試（mock `createAdminClient`）；用真實的沙盒通知補一項簽章測試。
- 帳號刪除改用 soft delete（`collaborations` 和 `payments` 的外鍵會擋住實體刪除）。
- 「確認並付款」按鈕目前只顯示說明；接綠界時改成建單（create_payment_order）並導向付款頁。README 的人工標記 SQL 在金流上線後移除。

### 9. 管理後台
- 管理員目前只能讀取。需要 `set_creator_status()`（definer 函式，檢查 `is_admin()`），以及取消或爭議處理的狀態轉換。
- `is_admin()`、`my_role()`、`is_conversation_participant()` 的 EXECUTE 權限從 PUBLIC 收回。brand-logos 的 insert/update policy 以 authenticated 身分呼叫 my_role()，收回後要再 grant 給 authenticated。（計畫 7 已收回 is_conversation_participant 的 PUBLIC／anon；is_admin、my_role 仍待處理）

### 10. 審核逾期自動通過
- `transition_collaboration` 的 system 身分要求「透過 PostgREST 以 service_role 呼叫」；**pg_cron 以 postgres 身分執行會被判定為「不是參與者」**。可以改用 Next route 搭配 Cron 和 secret，再以 service_role 呼叫 RPC；或另外寫一個只授權給 service_role 的 `auto_approve_due()` definer 函式。
→ 已完成（計畫 6：Vercel Cron + auto_approve_due）。

## 部署

正式環境（Hosted Supabase 與 Vercel）的設定清單以 README 的「正式環境（Hosted Supabase）設定」與「部署（Vercel）」為準，這裡不重複（避免兩份清單不一致）。清單包含：Redirect URLs 加 `https://<site>/auth/callback**`、關閉匿名登入、Email 範本、自訂 SMTP、CAPTCHA、Google OAuth。
