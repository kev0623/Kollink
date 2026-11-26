# 計畫 9：管理後台設計

來源：`2026-11-22-ui-design.md`（`/admin`：創作者審核、合作案總覽、撥款／退款、違規訊息列表；撥款、退款、停權一定要透過後台頁面操作並寫 audit log）、`plans/2026-11-22-foundation-followups.md` 的「9. 管理後台」與標給後台的項目（`is_admin()`／`my_role()` 的 EXECUTE、`set_creator_status()`、取消與爭議處理的狀態轉換、付款後台、計畫 8 移過來的 soft delete）、README「審核創作者（管理後台完成前）」「合作案的付款與撥款」「站內訊息（管理後台完成前）」裡的人工 SQL。既有程式：`transition_collaboration`（身分優先 system > brand > creator > admin）、`record_payment_success`、`resolve_payment_refund`、`resolve_payment_anomaly`（計畫 8）、`messages.flagged_contact`（計畫 7）、`audit_logs`。視覺沿用 `2026-11-24-ui-refresh-design.md` 與品牌、創作者區的殼（`SideNav`、`BottomTabBar`）。

## 使用者決定（2026-11-27）

| 題目 | 決定 |
|---|---|
| 範圍 | 四塊都做：(1) 創作者審核：待審核列表、核准、退回（原因給創作者看）、停權／解除停權（停權會暫停對話，計畫 7 已有）。(2) 款項與撥款：付款單列表、人工標記已付款（取代 README 的 SQL，一律經由 `record_payment_success`；線下／超過上限的 MAN 單與「綠界已扣款但沒收到通知」的 KL 單都要支援）、標記已撥款（`awaiting_payout → completed`，附轉帳說明）、需退款與付款異常用 `resolve_payment_refund`／`resolve_payment_anomaly` 處理；撥款要拒絕測試（stage）付款。(3) 合作案總覽（篩選）與爭議時的平台取消（原因必填；已付款就標記需退款）。(4) 違規訊息（`flagged_contact`）列表與「標記已檢視」。 |
| 管理員帳號 | 只用 SQL 新增（`admins` 表）；不做管理員管理畫面。 |
| 撥款方式 | 營運人員在平台外手動銀行轉帳，再到後台標記並寫轉帳說明。 |
| 創作者收款帳戶 | 創作者在自己的設定填寫：銀行代碼、分行代碼（選填）、帳號、戶名。視為敏感資料：獨立資料表、RLS 只給本人與管理員、寫入走 definer 函式並驗證（銀行代碼 3 碼、帳號位數）、品牌永遠看不到、列表只顯示末四碼、完整帳號只在後台的撥款畫面出現；至少撥款動作要寫 audit。 |

## 代替使用者做的決定（實作前可以推翻）

| 題目 | 決定與理由 |
|---|---|
| 退回的狀態 | `creator_profiles.status` 新增 `rejected`。原因存在 `review_note`（只有退回、停權時有值；`approved`／`pending` 一律 null，所以公開可讀的已審核列不會帶出原因）。創作者在頁面上方看到原因，修正後按「重新送審」回到 `pending`（`request_creator_review()`）。退回**不鎖** handle（只有 approved／suspended 才鎖，原本是「離開 pending 就鎖」）。 |
| 審核動作 | `approve`：pending／rejected → approved；`reject`：pending → rejected；`suspend`：approved → suspended；`unsuspend`：suspended → approved。退回與停權原因必填（1–500 字），核准與解除停權不用。 |
| 誰是管理員 | 只看 `admins` 表（`is_admin()`），與 `profiles.role` 無關。管理員通常是**專用帳號、沒有 profile**；登入後直接到 `/admin`，不會被送去 `/onboarding`。若管理員帳號同時是品牌或創作者，照既有規則「參與者永遠以參與者身分行動」：自己的合作案不能用管理員身分處理（資料庫回 `admin is participant`，畫面不顯示管理員動作）。 |
| 守門 | `requireAdmin()`（新）：未登入導 `/login?next=/admin`；不是管理員導回自己的首頁（沒有 profile 的導 `/onboarding`）。每個 `/admin` 頁面與 Server Action 都要呼叫（layout 不算數，同 `requireRole`）。`proxy.ts` 的需要登入路徑加 `/admin`。 |
| 寫入一律走 definer 函式 | 每個後台寫入都是 `security definer` 函式，開頭 `admin_actor()`：管理員回 `admin`；以 service_role 執行（README 的備用 SQL）回 `system`；其他 `42501 not admin`。寫 `audit_logs`（`actor_kind` = admin／system）。Server Action 一律用**管理員自己的 client**，不用 service_role。 |
| 對人的 audit | `audit_logs` 加 `subject_id`（被處理的使用者），審核、看收款帳戶、檢視訊息、創作者改收款帳戶都記在這裡；`collaboration_id` 是 null 的列只有管理員讀得到（現有 RLS 已經如此）。 |
| 管理員的說明放哪裡 | 參與者看得到合作案的 `audit_logs`（事件列表），所以管理員內部的說明不放進 audit 的 note：人工付款說明 → `payments.admin_note`（新欄位，authenticated 的欄位權限不含，和 `refund_note` 一樣）；轉帳說明 → `collaboration_payouts.transfer_note`（新表，只有管理員讀得到）。**平台取消的原因**是例外：雙方都需要知道，放在事件的 note，顯示「平台取消合作：原因」。 |
| 人工標記已付款 | 兩條路，都經由 `record_payment_success`：(a) `admin_record_offline_payment(合作案, 說明)`：建一張 `MAN` 開頭的付款單（金額 = 報價）再呼叫，給「超過線上上限、線下匯款」；(b) `admin_record_lost_payment(KL 單號, 綠界交易編號, 金額, 環境, 說明)`：用既有的 KL 單，給「綠界已扣款、通知遺失」，金額由管理員照綠界後台填，不符時記成付款異常（不標記已付款）。環境由 App 用這個部署的 `ECPAY_ENV` 帶入（KL 單是這個部署建立的）；沒有設定綠界時拒絕、改用 README 備用 SQL。`transition_collaboration` 的 `mark_paid` 允許 admin（仍然只能在 `kollink.recording_payment` 旗標下，也就是只能經由 `record_payment_success`）。 |
| 撥款 | `admin_mark_payout(合作案, 轉帳說明)`：拒絕測試付款（有 `provider_env = 'stage'` 的已付款）、沒有已付款的款項、有待退款的款項、創作者沒有收款帳戶。在 `collaboration_payouts` 留下帳戶快照（銀行代碼、末四碼、戶名）、金額與說明，再轉換狀態。`transition_collaboration` 的 `payout` 改成只能在 `kollink.paying_out` 旗標下（只能經由 `admin_mark_payout`），README 舊的撥款 SQL 因此失效、改成呼叫新函式。撥款金額 = 合作案報價（計畫 8：平台不收手續費）。 |
| 收款帳戶 | 新表 `creator_payout_accounts`（一人一筆）：銀行代碼 3 碼、分行 4 碼（選填）、帳號 7–16 碼數字（輸入的空白與 `-` 去掉）、戶名 1–40 字。`account_number` 不授權給任何 API 角色直接讀（欄位權限），本人與列表只拿得到 `account_last4`；完整帳號只能經由 `admin_get_payout_account(合作案)`，而且只在合作案 `awaiting_payout` 時回傳。任何審核狀態的創作者都可以先填。 |
| 查看完整帳號的 audit | 寫（`payout_account_viewed`），同一位管理員對同一位創作者 10 分鐘內只記一筆（頁面重新整理不會洗版）。創作者每次改帳戶也寫 audit（`payout_account_updated`，note 是「銀行代碼 ****末四碼」），撥款畫面在 7 天內改過時顯示警告（帳號被盜後改帳戶的風險）。 |
| 平台取消 | `admin_cancel_collaboration(合作案, 原因)`：任何未結束的狀態（invited 到 awaiting_payout）→ cancelled。已付款、還沒退款的款項一律標記 `refund_required`，並寫一筆 `refund_scheduled` 事件（「平台會退回已託管的款項」）。只做全額退款標記；部分退款、補償不在範圍。`transition_collaboration` 新增 `admin_cancel`，只能在 `kollink.admin_cancelling` 旗標下。 |
| 違規訊息 | 新表 `message_reviews`（只有管理員讀得到，不改 `messages`，避免 Realtime 對參與者送 UPDATE 事件）；`mark_message_reviewed` 重複標記不報錯。列表可看未檢視／已檢視／全部。停權、取消在各自的頁面做，不在訊息列表直接停權。 |
| `is_admin()`／`my_role()` | 收回 PUBLIC 與 anon 的 EXECUTE，grant 給 authenticated（RLS、storage、Realtime 的 policy 需要）與 service_role。anon 會套用的 policy 只有 `creator_profiles_select`、`creator_portfolio_items_select`：拆成 anon 專用（只看 approved，不呼叫函式）與 authenticated 兩條。已檢查：storage 的 policy 都只對 authenticated；沒有 view 或 invoker 函式呼叫這兩個函式。 |
| 版面 | 與品牌、創作者區相同的殼：桌面左側 `SideNav`（總覽、創作者審核、合作案、款項、違規訊息，5 項；底部是「管理員」標籤與登出），手機底部 `BottomTabBar` 放同樣 5 項，頂端一列「管理後台」與登出。列表在手機也是直式卡片（不用表格），長字串 `break-all`。 |
| 確認 | 核准、解除停權用既有 `ConfirmAction`；退回、停權、平台取消、撥款、人工付款、退款、異常用新的 `NoteAction`（頁面內展開、說明必填、0/500 計數）。不用 `confirm()`。「標記已檢視」不改變任何人的資料，單鍵即可。 |
| 篩選與分頁 | 全部在網址：`?status=`、`?view=`、`?state=`、`?q=`（50 字）、`?page=`（每頁 50 筆、最多第 1000 頁）。不認得的值一律退回預設，不報錯。總數用 window 函式放在 `total_count`。 |
| 合作案詳情 | `/admin/collabs/[id]` 重用 `get_collaboration`（管理員看得到，視角是 `admin`）、交稿紀錄、事件列表、`CollabHeader`、`Stepper`；另外加「平台處理」卡片與付款單列表。不顯示「前往對話」（對話頁只給雙方）。 |
| 測試快速登入 | 加「測試管理員」（`dev-admin@kollink.test`）：只建 auth 使用者並加進 `admins`（service_role 有 `admins` 的寫入權限），沒有 profile。開關與既有的測試快速登入相同（只在本機）。 |
| 通知 | 不寄 Email、不推播（沒有寄信基礎建設）。站內：創作者頁面上方的審核橫幅（退回／停權原因、重新送審）、合作案事件（平台取消原因、會退款、已撥款）。 |
| Soft delete | 不做。目前沒有刪除帳號的功能；`payments`、`collaborations` 的外鍵本來就擋住實體刪除；違規處理用停權即可。等「刪除帳號」功能出現時再一起設計（要決定保留期限、個資匿名化、進行中合作案怎麼辦）。 |
| README 的人工 SQL | 改成「後台無法使用時的備用 SQL」：一律以 service_role 呼叫同一批 definer 函式（audit 的 actor 是 system），不再直接改資料表或呼叫 `transition_collaboration`。 |
| 公開頁快取 | 不在本計畫（followups 計畫 3 的 `cacheTag` 項目留著）：公開頁與廣場本來就不快取，核准、停權後下一次請求就生效。 |

## 資料庫

兩個 migration：`20261128000100_admin_core.sql`（權限收斂、審核、違規訊息）、`20261128000200_admin_money.sql`（收款帳戶、款項、撥款、取消、列表）。

### 新資料表與欄位

| 物件 | 內容 | 權限 |
|---|---|---|
| `audit_logs.subject_id` | 被處理的使用者（審核、帳戶、訊息） | 沿用 `audit_logs_select`（沒有合作案的列只有管理員） |
| `creator_profiles.status` | 加 `rejected` | — |
| `creator_profiles.review_note` | 退回／停權原因（≤ 500 字；只有 rejected／suspended 可以有值） | 本人與管理員（RLS）；只有 definer 函式能寫 |
| `message_reviews` | `message_id`、`reviewed_by`、`reviewed_at` | 管理員讀；寫入只經由 `mark_message_reviewed` |
| `creator_payout_accounts` | `user_id`、`bank_code`、`branch_code`、`account_number`、`account_last4`（generated）、`account_name`、`updated_at` | RLS 本人與管理員；authenticated 只能讀 `account_number` 以外的欄位；寫入只經由 `set_my_payout_account` |
| `payments.admin_note` | 人工付款說明（≤ 500 字） | authenticated 讀不到（欄位權限） |
| `collaboration_payouts` | 撥款快照：金額、銀行代碼、分行、末四碼、戶名、轉帳說明、actor | 管理員讀；寫入只經由 `admin_mark_payout` |

### 函式

| 函式 | 誰可以呼叫 | 說明 |
|---|---|---|
| `admin_actor()`、`admin_clean_note()`、`admin_lock_collab()` | 內部 | 管理員身分、說明清理（1–500 字）、鎖合作案並擋「管理員是參與者」 |
| `set_creator_status(使用者, 動作, 原因)` | 管理員、service_role | 審核四個動作；audit `creator_<動作>` |
| `request_creator_review()` | 創作者本人 | rejected → pending；audit `creator_resubmit` |
| `admin_list_creators(狀態, 關鍵字, limit, offset)` | 管理員 | 帶 IG 驗證碼；待審核由舊到新 |
| `mark_message_reviewed(訊息)`、`admin_list_flagged_messages(檢視, limit, offset)` | 管理員 | — |
| `set_my_payout_account(銀行, 分行, 帳號, 戶名)` | 創作者本人 | audit `payout_account_updated` |
| `admin_record_offline_payment`、`admin_record_lost_payment` | 管理員、service_role | 見上表；回傳 `record_payment_success` 的結果 |
| `admin_mark_payout(合作案, 轉帳說明)` | 管理員、service_role | 見上表 |
| `admin_get_payout_account(合作案)` | 管理員、service_role | 只在 awaiting_payout；audit（10 分鐘去重） |
| `admin_cancel_collaboration(合作案, 原因)` | 管理員、service_role | 回傳標記需退款的筆數 |
| `admin_list_collaborations`、`admin_list_payments`、`admin_list_payouts`、`admin_overview` | 管理員 | 列表與總覽數字 |
| `transition_collaboration` | 不變 | `mark_paid` 允許 admin；`payout` 需要 `kollink.paying_out`；新增 `admin_cancel`（需要 `kollink.admin_cancelling`、原因必填） |

錯誤碼沿用既有慣例：身分 `42501`（`not admin`、`admin is participant`、`not a creator`）、找不到 `P0002`、狀態 `55000`（`creator status changed`、`collaboration not awaiting payout`、`test payment cannot be paid out`、`payout account missing`、`refund pending`、`no paid payment`、`collaboration already closed`）、格式 `22023`（`invalid reason`、`invalid note`、`invalid env`、`invalid provider_trade_no`、`invalid bank_code`…）。

## 畫面

| 路徑 | 內容 |
|---|---|
| `/admin` | 待辦數字卡片：待審核創作者、待撥款、需退款、付款異常、未檢視的違規訊息、等待付款的合作案；點了到對應列表。 |
| `/admin/creators` | 狀態標籤（待審核、已退回、已審核、已停權、全部）、搜尋（網址代稱、IG、名稱）。每列：名稱、狀態、網址代稱、IG（連到 IG 個人頁）與自填粉絲數、驗證碼、地區與領域、申請時間、原因；按鈕依狀態：核准／退回、核准、停權、解除停權。 |
| `/admin/collabs` | 狀態標籤（進行中、各狀態、全部）、搜尋（案號 8 碼、案名、品牌、創作者）。每列：案號、案名、狀態、測試付款／需退款標記、品牌 × 創作者、金額、更新日。 |
| `/admin/collabs/[id]` | 標題區、進度條、「平台處理」卡片（依狀態：撥款區含完整帳戶與 7 天內改過的警告；人工標記已付款；每張未付款的 KL 單一個「綠界已扣款但沒收到通知」表單；平台取消）、撥款紀錄、付款單列表（需退款的單有「已退款」）、交稿紀錄、事件。 |
| `/admin/payments` | 分類：待撥款（等最久的在前，帳戶只顯示末四碼與不能撥款的原因）、需退款（「已退款」）、付款異常（未處理／已處理；「已處理」）、全部付款單。 |
| `/admin/messages` | 未檢視／已檢視／全部；每則：時間、發送方、品牌 ↔ 創作者（連到審核列表搜尋）、內文、「標記已檢視」或檢視時間。 |
| `/creator/me/payout` | 目前的帳戶（銀行代碼、末四碼、戶名、更新時間）與表單（帳號一律重新輸入）。`/creator/me` 加「收款帳戶」按鈕。 |
| 創作者頁面上方 | 退回：「審核沒有通過，請修正後重新送審。原因：…」、驗證碼、「我已修正，重新送審」。停權：「帳號已暫停，請聯絡客服。原因：…」。 |

## 不在範圍內

- 管理員管理畫面（新增、移除管理員一律用 SQL）。
- 串接綠界退款 API、部分退款、退款給 ATM 付款人的帳號收集（仍在綠界後台或另外轉帳）。
- 自動撥款、批次撥款、撥款排程。
- Email／推播通知。
- 帳號刪除與 soft delete（理由見上表）。
- 管理員看雙方的對話全文（只看被標記的訊息）。
- 公開頁快取與 `revalidateTag`。
- 後台的操作紀錄查詢頁（audit 都在資料庫，需要時用 SQL 查；README 附查詢）。

## 驗收

- **資料庫測試**（新 `24_admin_core` 48 個、`25_admin_money` 60 個；`03_collaborations` 的直接撥款斷言改成帶旗標，總數不變）：
  - anon 不能呼叫 `is_admin`／`my_role`，authenticated 可以；沒有 anon／PUBLIC 的 policy 呼叫它們；訪客仍讀得到已審核的創作者與作品。
  - 審核四個動作、原因必填、狀態不對 55000、非管理員 42501、退回不鎖 handle、創作者讀得到自己的原因、重新送審、service_role 是 system。
  - 違規訊息：標記、重複標記、一般訊息不能標記、品牌讀不到紀錄。
  - 收款帳戶：格式、本人讀不到完整帳號、品牌讀不到任何帳戶、不能直接寫表。
  - 人工付款兩條路、管理員是參與者被擋、不能直接 `mark_paid`／`payout`／`admin_cancel`、測試付款與沒有帳戶不能撥款、撥款快照、平台取消標記需退款、列表與篩選。
- 單元測試、lint、tsc、build 全部通過。
- **E2E**（本機，測試快速登入 + SQL 種子資料），390 與 1280 截圖：審核（核准、退回 → 創作者看到原因並重新送審、停權 → 對話暫停、解除）、收款帳戶（創作者填寫、品牌看不到、列表只有末四碼）、線下付款、通知遺失補登（含金額不符 → 付款異常）、撥款（測試付款被拒、沒有帳戶被拒、成功）、平台取消已付款的合作案 → 需退款 → 記錄已退款、付款異常處理、違規訊息標記、非管理員打開 `/admin` 被導回、anon 呼叫 `rpc/is_admin` 被拒。
