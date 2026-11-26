# 計畫 8：綠界金流設計

來源：`plans/2026-11-22-foundation-followups.md` 的「8. 付款建單與撥款（真的收錢之前必須完成）」、`2026-11-25-collaborations-design.md` 的「確認並付款」與「標記已付款」、README「合作案的付款與撥款（金流與管理後台完成前）」。既有程式：`supabase/migrations/20261122000400_payments.sql`（`payments`、`record_payment_success`）、`src/app/api/payments/ecpay/notify/route.ts`、`src/lib/payments/ecpay.ts`（CheckMacValue）、`src/lib/payments/ecpay-notify.ts`、`src/app/api/dev/mark-paid/route.ts`。狀態機沿用 `transition_collaboration`（`mark_paid` 只能經由 `record_payment_success`）。撥款與後台是計畫 9。

## 使用者決定（2026-11-26）

| 題目 | 決定 |
|---|---|
| 金鑰與環境 | 現在用綠界公開的測試環境（stage）金鑰。之後換正式的 MerchantID／HashKey／HashIV 只要改環境變數：`ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`、`ECPAY_ENV=stage|prod`。全部只在伺服器端，絕不加 `NEXT_PUBLIC_`。正式站不能意外收到真錢；環境變數不齊時，按鈕停用並顯示說明。 |
| 付款方式 | 信用卡 + ATM 虛擬帳號。ATM 用 PaymentInfoURL 接收銀行代碼、虛擬帳號、繳費期限並顯示給品牌；合作案維持 `awaiting_payment`，直到綠界的付款成功通知。 |
| 平台手續費 | 不收。品牌付合作案金額，全額給創作者；撥款人工處理（計畫 9 後台），`awaiting_payout` 不變。 |
| 電子發票 | 這次不做。 |

## 代替使用者做的決定（實作前可以推翻）

| 題目 | 決定與理由 |
|---|---|
| ATM 繳費期限 | 3 天（綠界預設；可設 1–60 天，到期日當天 23:59 截止）。合作案不會因為等 ATM 卡太久，品牌逾期可以重新取號。 |
| 線上付款上限 | 單筆 NT$200,000（`create_payment_order` 與 `PAYMENT_MAX_TWD`）。綠界文件沒有寫單筆上限，實際以特店合約為準，**上線前要向綠界確認**再調整。超過上限的合作案顯示「請聯絡平台」，由管理員用 README 的人工 SQL 處理。 |
| 站台網址 | 新的伺服器端環境變數 `SITE_URL`（只能是 origin，例如 `https://kollink.vercel.app`），用來組 ReturnURL 等回呼網址。不從請求的 Host 推算（避免被 Host 標頭影響回呼位置）。 |
| 測試模式在正式站 | 允許（使用者決定現在用 stage 金鑰）。但 stage 的 HashKey 是公開的，**任何人都能偽造付款通知**；所以付款單記錄 `provider_env`，畫面標「測試付款（未實際收款）」，README 的撥款 SQL 拒絕撥款給測試付款。 |
| 模擬付款（`SimulatePaid=1`） | 綠界文件：模擬付款「不會變更訂單狀態」、不要出貨。正式環境（`ECPAY_ENV=prod`）一律只回 `1|OK`、不記錄；測試環境照常記錄為已付款（測試 ATM 只能靠綠界後台的模擬付款）。 |
| 付款結果頁 | 信用卡設 OrderResultURL（瀏覽器 POST 回 `/api/payments/ecpay/result?c=<合作案>`，route 不讀內容、只 303 導回詳情）；ATM 不支援 OrderResultURL，用 ClientBackURL（綠界頁的「返回商店」）。 |
| 付款異常與警示 | 不報錯（綠界只重送 4 次就放棄，報錯等於什麼都沒留下）。寫進新資料表 `payment_anomalies`、寫一筆 audit（`payment_anomaly`）、`console.error`（Vercel log）；回綠界 `1|OK`。不接外部通知服務；管理員用 README 的 SQL 查（計畫 9 後台會列出）。 |
| 退款範圍 | 只做「記錄」：實際退款在綠界廠商後台人工操作，完成後執行 `resolve_payment_refund` 清除 `refund_required`（README 附 SQL）。 |
| 人工標記已付款 SQL | 保留到計畫 9 的後台，作為備用（超過上限、綠界通知遺失時）；README 標明「線上付款上線後只在這些情況使用」。 |
| 帳號軟刪除 | 不在本計畫：目前沒有刪除帳號的功能，`payments`／`collaborations` 的外鍵本來就會擋住實體刪除。移到計畫 9。 |
| 付款方式選擇 | 在我們的頁面先選（信用卡／ATM），送 `ChoosePayment=Credit` 或 `ATM`；不用 `ALL`。這樣建單時就知道方式，ATM 參數只在 ATM 單出現。 |

## 綠界文件（實作時以這幾頁為準）

- 測試介接資訊：https://developers.ecpay.com.tw/2856/ —— 測試商店 `MerchantID 3002607`、`HashKey pwFHCqoQZGmho4w6`、`HashIV EkRm7iFT261dpevs`；廠商後台帳號 `stagetest3`／`test1234`；測試卡 `4311-9522-2222-2222`（或 `4311-9511-1111-1111`），安全碼任意三碼，有效月年要晚於現在；3D 驗證碼固定 `1234`；「模擬付款」在廠商後台 → 一般訂單查詢 → 全方位金流訂單，送出的通知帶 `SimulatePaid=1`。
- 產生訂單：https://developers.ecpay.com.tw/?p=2862 —— stage `https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5`、prod `https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5`；必須由前端表單 POST（`application/x-www-form-urlencoded`）；`MerchantTradeNo` String(20)、英數字、不可重複；`MerchantTradeDate` `yyyy/MM/dd HH:mm:ss`；`TotalAmount` 整數新台幣；`TradeDesc`、`ItemName` 不要放特殊字元（`#` 是多商品分隔）；`ReturnURL` 必須和 `OrderResultURL` 不同；`EncryptType=1`（SHA256）；`OrderResultURL` 不支援 ATM。
- 信用卡一次付清：https://developers.ecpay.com.tw/?p=2866；ATM：https://developers.ecpay.com.tw/?p=2872 —— `ExpireDate` 1–60 天、預設 3；`PaymentInfoURL`（伺服器端）在「訂單建立完成後（非付款完成）」送銀行代碼、虛擬帳號、繳費期限。
- 付款結果通知（ReturnURL）：https://developers.ecpay.com.tw/?p=2878 —— `RtnCode=1` 才是成功；`SimulatePaid=1` 是模擬付款不要出貨；回應純文字 `1|OK`（常見錯誤 `1|ok`、`_OK`、空白）；沒有正確回應時隔 5–15 分鐘重送，**當天最多 4 次**。
- 取號結果通知（PaymentInfoURL）：https://developers.ecpay.com.tw/?p=2881 —— ATM `RtnCode=2` 才是取號成功；欄位 `BankCode` String(3)、`vAccount` String(16)、`ExpireDate` `yyyy/MM/dd`；同樣回 `1|OK`、同樣的重送規則。
- 檢查碼：https://developers.ecpay.com.tw/?p=2902 —— (1) 參數依名稱 A–Z 排序（不分大小寫）以 `&` 串接 (2) 前加 `HashKey=…&`、後加 `&HashIV=…` (3) URL encode（.NET `HttpUtility.UrlEncode`：空白變 `+`，`-_.!*()` 不編碼）(4) 全部轉小寫 (5) SHA256 (6) 轉大寫。官方範例（`ecpay20230312153023`，結果 `6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840`）已在 `src/lib/payments/ecpay.test.ts`，既有實作不用改。

## 流程

### 信用卡

1. 品牌在合作案詳情（`awaiting_payment`）選「信用卡」→ 按「確認並付款」。
2. Server Action `startPaymentAction(collabId, "credit")`：`requireRole("brand")` → 以**品牌自己的 client** 呼叫 `create_payment_order(collab, 'credit')`（資料庫檢查身分、狀態、上限、頻率，產生付款單編號、金額取合作案報價）→ 伺服器用 `buildCheckoutForm` 組綠界參數並算 `CheckMacValue` → 回傳 `{ action, fields }`（不含金鑰）。
3. 瀏覽器把回傳的欄位渲染成隱藏表單，立刻 `submit()`，整頁 POST 到綠界付款頁。
4. 品牌在綠界刷卡（測試環境：測試卡 + 3D 驗證碼 1234）。
5. 綠界伺服器 POST 到 ReturnURL `/api/payments/ecpay/notify`：驗簽、檢查 MerchantID、付款單編號、`RtnCode`、金額、交易編號 → `record_payment_success(…, p_env)` → 合作案進入 `awaiting_submission` → 回 `1|OK`。
6. 同時綠界讓瀏覽器 POST 到 OrderResultURL `/api/payments/ecpay/result?c=<id>`：**不讀內容、不改狀態**，303 導回 `/brand/collabs/<id>`。如果通知還沒到，詳情頁顯示「剛完成付款？綠界確認款項可能需要幾分鐘，請稍後重新整理頁面」（最新一張單是 30 分鐘內的信用卡待付款單時）。

### ATM

1–3. 同上，方式選「ATM 轉帳」，參數多了 `ExpireDate=3`、`PaymentInfoURL`，沒有 `OrderResultURL`。
4. 品牌在綠界頁選銀行，綠界顯示虛擬帳號；同時綠界伺服器 POST 到 PaymentInfoURL `/api/payments/ecpay/payment-info`：驗簽、`RtnCode=2` → `record_payment_info` 存銀行代碼、虛擬帳號、繳費期限 → 回 `1|OK`。
5. 品牌按綠界頁的「返回商店」（ClientBackURL）回到詳情：「現在要做什麼」卡片顯示 ATM 轉帳資訊（銀行代碼、每 4 碼空一格的虛擬帳號、金額、「2026/11/30 23:59 前」），合作案仍是 `awaiting_payment`。
6. 品牌轉帳後，綠界 POST ReturnURL（`RtnCode=1`），之後同信用卡第 5 步。
7. 期限過了沒轉帳：卡片不再顯示 ATM 資訊，回到選擇付款方式（重新取號 = 新的付款單）。

### 付款單的重用與重建

- 綠界不接受重複的 `MerchantTradeNo`，而且訂單在綠界付款頁打開時就建立了，所以**每按一次「確認並付款」都建立新的付款單**，從不重送舊編號。放棄的單永遠是 `pending`，無害。
- 唯一的「重用」是畫面層級：最新一張單是還沒到期、已取號的 ATM 單時，不顯示付款按鈕，改顯示轉帳資訊與「改用其他方式付款」（按了才建新單）。舊的虛擬帳號仍然有效：兩張都付了，第二筆走既有的「需退款」路徑。
- 頻率限制：同一個合作案一小時最多 10 張單（`54000 too many payment orders`）。
- 付款單編號由資料庫產生：`KL` + 台灣日期 `YYMMDD` + 12 位大寫十六進位，共 20 字（綠界上限 20、英數字）。測試商店 3002607 是所有人共用的，編號必須夠亂，不能用流水號。

### 冪等與重送

- `record_payment_success` 以 `merchant_trade_no` 鎖列（`for update`）：已付款回 `already_paid`，不會重複推進狀態或寫 audit。
- `record_payment_info` 相同的取號資料回 `unchanged`。
- 異常以 `(source, kind, merchant_trade_no, provider_trade_no)` 唯一索引去重：綠界重送同一筆異常只記一次、audit 只寫一次。
- 回 500 的只有「資料庫暫時錯誤」（讓綠界重送）與「環境變數不齊」；驗簽失敗、MerchantID 不符、欄位格式錯誤回 400（重送也不會過，留 log）。

## 資料庫

新 migration `20261127000100_payment_orders.sql`：

### `payments` 新欄位與限制

| 欄位 | 說明 |
|---|---|
| `payment_method` | `credit`／`atm`；只有 `create_payment_order` 建的單才有（本機按鈕、人工 SQL 是 null） |
| `provider_env` | `stage`／`prod`：驗證付款通知的是哪一組金鑰；本機與人工是 null |
| `created_by` | 建單的品牌 |
| `atm_bank_code`、`atm_v_account`、`atm_expire_date`、`payment_info_at` | ATM 取號結果（3 碼、6–16 碼數字） |
| `refunded_at`、`refund_note` | 退款處理完成的時間與說明（≤ 500 字） |

- `provider_trade_no` 不能只有空白（check）；`refunded_at` 有值時 `refund_required` 必須是 false。
- **欄位權限**：authenticated 改成只能讀列出的欄位，`raw_notify`、`created_by`、`refund_note` 只有 service_role 讀得到；anon 收回 SELECT（計畫 1 grant 了但 RLS 本來就沒給 anon）。

### `payment_anomalies`

`id`、`source`（`notify`／`payment_info`）、`kind`（`unknown_trade_no`／`amount_mismatch`／`price_mismatch`）、`merchant_trade_no`、`provider_trade_no`、`payment_id`、`collaboration_id`、`expected_amount_twd`、`received_amount_twd`、`raw`（白名單）、`resolved_at`、`resolved_note`、`created_at`。RLS：只有管理員讀；寫入只經由函式。

### 函式

| 函式 | 誰能呼叫 | 做什麼 |
|---|---|---|
| `create_payment_order(p_collab_id, p_method)` → `(merchant_trade_no, amount_twd, created_at)` | authenticated（品牌自己的 client） | 檢查：登入（42501）、方式（22023 `invalid payment method`）、參與者（P0002 `collaboration not found`）、是品牌（42501 `not collaboration brand`）、`awaiting_payment`（55000 `collaboration not awaiting payment`）、≤ 200000（22023 `amount exceeds online payment limit`）、一小時 10 張（54000 `too many payment orders`）。金額取合作案報價。 |
| `record_payment_success(…, p_env default null)` | service_role | 多了 `p_env`；回傳多一種 `anomaly`（找不到付款單、金額不符、付款單與報價不符：不報錯，記異常）；`raw` 先過白名單；交易編號去前後空白；`failed` 的單收到成功通知照常改成 `paid`（以綠界最後的成功通知為準；目前沒有程式寫入 `failed`）。舊的四參數呼叫（本機按鈕、README SQL）照常可用。 |
| `record_payment_info(…)` | service_role | 存 ATM 取號資料；回傳 `recorded`／`unchanged`／`ignored`（已付款或不是 ATM 單）／`anomaly`。 |
| `resolve_payment_refund(p_payment_id, p_note)` | 管理員或 service_role | `refund_required` 必須是 true（否則 55000）；說明 1–500 字；清除旗標、記時間與說明、寫 audit `payment_refunded`。 |
| `resolve_payment_anomaly(p_id, p_note)` | 管理員或 service_role | 記處理時間與說明；已處理 55000。 |
| `payment_raw_whitelist(jsonb)`、`record_payment_anomaly(…)` | 不授權給任何 API 角色 | 內部 helper。 |

**raw_notify 白名單**（SQL 與 `src/lib/payments/notify-fields.ts` 相同）：`MerchantID`、`MerchantTradeNo`、`StoreID`、`RtnCode`、`RtnMsg`、`TradeNo`、`TradeAmt`、`PaymentDate`、`PaymentType`、`PaymentTypeChargeFee`、`TradeDate`、`SimulatePaid`、`BankCode`、`vAccount`、`ExpireDate`（SQL 另外接受本機與人工用的 `source`）。不存 `card4no`、`card6no`、`ATMAccNo`（我們送 `NeedExtraPaidInfo=N`，但即使綠界多傳也不存）。

## 程式

| 檔案 | 內容 |
|---|---|
| `src/lib/payments/config.ts`（server-only） | `readEcpayConfig()`：四個 `ECPAY_*` + `SITE_URL` 都合法才回傳設定，否則 null。`ECPAY_ENV=prod` 時不接受測試商店 3002607；`SITE_URL` 必須是 https（stage 的 localhost 例外）、只能是 origin。`paymentAvailability()` 給畫面（不含金鑰）。 |
| `src/lib/payments/limits.ts` | `PAYMENT_MAX_TWD`、`ATM_EXPIRE_DAYS`、`RECENT_ORDER_MS`。 |
| `src/lib/payments/checkout.ts` | `buildCheckoutForm`：組參數與 CheckMacValue。`TradeDesc`、`ItemName` 只用固定文字與案號（不放使用者輸入的案名：可能有 emoji 或 `#`）。 |
| `src/lib/payments/notify-fields.ts` | 白名單、金額與付款單編號格式、ATM 欄位解析。 |
| `src/lib/payments/ecpay-notify.ts`、`ecpay-payment-info.ts` | 兩種通知的純處理函式（依賴注入，方便測試）。 |
| `src/lib/payments/view.ts` | 付款單 → 畫面摘要（測試付款、ATM 待繳、信用卡確認中、需退款）。 |
| `src/app/api/payments/ecpay/notify`、`payment-info`、`result` | 三個 route。 |
| `src/app/brand/collabs/actions.ts` | `startPaymentAction`。 |

### 公開端點與 CSRF

- `notify`、`payment-info`：不需要登入、不讀 cookie。身分只靠 CheckMacValue（`timingSafeEqual`、先比長度、不分大小寫）與 MerchantID。不檢查 Origin（綠界伺服器不帶）。`proxy.ts` 的 matcher 排除整個 `api/payments/ecpay/`，不做 session 更新。
- `result`：瀏覽器跨站 POST 進來（SameSite=Lax 的 cookie 不會帶），所以這個 route 什麼都不做，只 303 導回詳情；導過去的 GET 會帶 cookie、經過 proxy 與頁面的登入檢查。`c` 不是 UUID 時導回列表（不會變成 open redirect）。
- `startPaymentAction` 是 Server Action：Next 內建 Origin／Host 比對（`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`「Security」）；另外自己 `requireRole("brand")`、`isUuid`、檢查方式，金額與身分再由資料庫檢查。
- 綠界的付款頁是第三方網站，表單整頁 POST 過去，不需要 CSP 調整（目前沒有 CSP）。

### 環境變數不齊時

- 按鈕停用，下方顯示「線上付款尚未開放。目前由平台人工確認款項，確認後會自動進入交稿階段。」（沿用計畫 6 的說明）；`startPaymentAction` 回「線上付款尚未開放，請聯絡平台」。
- `notify`、`payment-info` 回 500 `0|Not configured`（綠界會重送，補上設定後就能處理；沒有設定時也不會有付款單送到綠界）。
- Vercel 只在 **Production** 設 `ECPAY_*` 與 `SITE_URL`；Preview 沒設，所以預覽部署的按鈕一律停用（避免回呼網址指向正式站）。

## 畫面

合作案詳情（品牌，`awaiting_payment`）的「現在要做什麼」卡片：

1. 測試模式（`ECPAY_ENV=stage`）：紅框說明「測試模式：目前使用綠界測試環境，不會真的扣款，付款完成也不會撥款給創作者。」
2. 有效的 ATM 待繳單：轉帳資訊卡 + 「改用其他方式付款」。
3. 否則：付款方式（單選：信用卡「在綠界付款頁刷卡，完成後回到這裡。」／ATM 轉帳「取得虛擬帳號，3 天內轉帳。」）+「確認並付款」。進行中顯示「前往綠界付款頁…」並停用。錯誤顯示在下方（`role="alert"`）。
4. 最新一張是 30 分鐘內的信用卡待付款單：「剛完成付款？…請稍後重新整理頁面。」
5. 「取消合作」：有 ATM 待繳單時，確認文字多一句「已取得的 ATM 帳號請不要再轉帳；如果已經轉帳，平台會退款。」
6. 本機按鈕「標記已付款（本機）」照舊（只在 `isDevLoginEnabled()`）。

卡片說明文字改成「選擇信用卡或 ATM 轉帳付款。款項由平台託管，創作者交稿並發佈後才撥款。」；原本固定顯示的「等待付款確認」移除。

標題區：已付款的單裡有 `provider_env = 'stage'` 時，金額旁邊加紅框標籤「測試付款（未實際收款）」（雙方都看得到）。

事件文字（雙方都看得到，用中性說法；followups 提到 `payment_requires_refund` 對創作者的文字要調整）：

| action | 文字 |
|---|---|
| `payment_requires_refund` | 收到一筆額外的付款，平台會處理退款 |
| `payment_refunded` | 平台已退回一筆額外的付款 |
| `payment_anomaly` | 平台正在確認一筆付款 |

創作者端不變（「等對方付款託管」）。

## 退款（本計畫只做記錄）

- 需要退款的情況：合作案取消後才到款、同一案付了兩次（例如 ATM 與信用卡都付了）。資料庫已標 `refund_required = true` 並寫 audit。
- 管理員用 README 的 SQL 列出需退款的款項 → 在綠界廠商後台找到該筆交易（用 `merchant_trade_no` 或綠界交易編號）辦理退款；ATM 付款無法刷退，要向品牌取得帳號另外轉帳 → 執行 `resolve_payment_refund(付款單 id, '說明')`。
- 不做：線上退款 API（綠界信用卡請退款 API）、部分退款、合作案中途取消的退款規則（爭議處理在後台計畫）。

## 部署

1. 推資料庫（`npx supabase db push --remote`）→ 在 Vercel Production 加 `ECPAY_ENV=stage`、`ECPAY_MERCHANT_ID=3002607`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`（測試值見上方文件）、`SITE_URL=https://kollink.vercel.app` → 合併 PR。
2. 推資料庫前的唯讀檢查：`payments` 沒有只含空白的 `provider_trade_no`（新的 check 才不會失敗）。
3. 換正式金鑰（之後）：向綠界申請正式特店（依公司規定，API 串接申請可以一併找 Ken 哥），拿到 MerchantID／HashKey／HashIV 後改 Vercel 的三個值與 `ECPAY_ENV=prod`，重新部署。`ECPAY_ENV=prod` 搭配測試商店 3002607 會被拒絕（按鈕停用）。上線前確認單筆限額，必要時改 `PAYMENT_MAX_TWD` 與 SQL。

## 不在範圍內

- 電子發票、平台手續費。
- 線上退款 API、部分退款、退款給品牌的自動化。
- 綠界 QueryTradeInfo 主動查詢（補遺失的通知）：通知只重送 4 次，如果全部失敗，管理員在綠界後台確認後用 README 的人工 SQL 標記（並把綠界交易編號填進 `provider_trade_no`）。
- 管理後台的付款／異常／退款列表（計畫 9）。
- 其他付款方式（超商代碼、條碼、Apple Pay、分期）。
- 帳號軟刪除（移到計畫 9）。

## 驗收

- **資料庫測試**（新檔 `22_payment_orders.test.sql`，修改 `04_payments.test.sql`）：
  - `create_payment_order`：anon、創作者、第三方品牌、錯的方式、非待付款、超過上限、頻率限制全部被拒；成功時金額取報價、編號格式正確、`created_by` 是品牌；品牌讀不到 `raw_notify`、不能直接 insert。
  - `record_payment_info`：記錄、重送 unchanged、信用卡單 ignored、格式錯誤、找不到付款單與金額不符記異常。
  - `record_payment_success`：金額不符記異常且重送只記一次、白名單（card6no 不會存）、環境、交易編號去空白、已付款後第二張單需退款、`failed → paid`、未知環境被拒。
  - 退款與異常處理：權限（品牌 42501、管理員與 service_role 可以）、說明必填、重複處理 55000、audit。
- **單元測試**：CheckMacValue 官方範例（既有）；`buildCheckoutForm` 用測試商店金鑰簽出來可以被驗證；設定檔各種缺漏；兩種通知的處理函式（含正式／測試環境的模擬付款）；三個 route（mock `createAdminClient`，含未設定、簽章錯誤、資料庫錯誤、anomaly）；`summarizePayments`。
- **真實沙盒樣本**：E2E 在綠界測試環境用測試卡付款，攔下綠界讓瀏覽器 POST 給 OrderResultURL 的內容（由綠界簽章），存成 fixture，單元測試用公開的測試金鑰驗證它的 CheckMacValue。
- **E2E**（本機 dev server，用測試快速登入與 SQL 種子資料；390 與 1280 截圖）：
  1. 環境變數不齊：按鈕停用與說明。
  2. 信用卡：選方式 → 綠界測試付款頁載入（金額、商品名稱正確）→ 測試卡 + 3D 驗證碼 → 導回詳情；本機收不到 ReturnURL（綠界連不到 localhost），用攔下的真實內容重送到本機 notify → 進入交稿、標題區「測試付款」、事件「款項已託管」；重送一次仍只有一筆 `mark_paid`。
  3. ATM：選 ATM → 綠界頁顯示虛擬帳號 → 用綠界頁上的值簽一份 payment-info 送到本機 → 「返回商店」後看到轉帳資訊卡 → 「改用其他方式付款」→ 送一份簽好的模擬付款（`SimulatePaid=1`，stage）→ 進入交稿。
  4. 重複付款 → 需退款事件 → README 退款 SQL → 「平台已退回…」。
  5. 金額不符 → 1|OK、異常列表有一列、事件「平台正在確認一筆付款」→ README 處理 SQL。
  6. 超過上限：錯誤訊息。簽章錯誤：400。偽造的 OrderResultURL POST：狀態不變。創作者看不到付款按鈕。
- **部署後煙霧測試**（正式站、測試模式）：用測試卡真的付一次，確認綠界的 ReturnURL 打到 Vercel、狀態自動改變（不用人工 SQL）；ATM 單用綠界廠商後台的「模擬付款」確認 PaymentInfoURL 與 ReturnURL。
