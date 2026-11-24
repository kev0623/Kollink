# 計畫 6：合作案設計

來源：`2026-11-22-ui-design.md` §5.2（合作案詳情頁）、§4（合作案列表、創作者詳情 → 發出邀約）、`plans/2026-11-22-foundation-followups.md` 的「6. 合作案詳情頁」「8. 付款」「10. 審核逾期自動通過」。狀態機沿用計畫 1 的 `transition_collaboration`；招募錄取來自計畫 5；公開頁「邀請合作」按鈕來自計畫 3。視覺沿用 `2026-11-24-ui-refresh-design.md`。站內訊息是計畫 7，本計畫的「對話區」只顯示系統事件。

## 使用者決定（2026-11-25）

| 題目 | 決定 |
|---|---|
| 招募錄取後 | 品牌錄取時就設定金額與交付內容，同一個 transaction 建立對話和合作案。因為創作者報名時已經同意，跳過「邀約」，直接從「確認」（`awaiting_payment`）開始。 |
| 付款 | 先把流程做完，金流（綠界）留到計畫 8。品牌按「確認並付款」後進入「等待付款」。計畫 8 之前，由管理員在 SQL Editor 標記已付款（README 會附指令）。本機開發另外提供一個測試用按鈕，開關跟測試快速登入共用。**整個流程不會真的收錢。** |
| 交稿 | 上傳檔案，也可以附連結和說明。檔案存在私密儲存空間，只有該合作案的雙方看得到。每個檔案 50 MB 以內，一次交稿最多 10 個檔案。 |
| 自動通過 | 這次一起做。用 Vercel Cron 搭配一個 secret，以 service_role 呼叫 RPC。Hobby 方案的 Cron 一天只能跑一次，所以實際上是「到期後最晚隔天自動通過」。卡片上會顯示倒數。 |

## 合作案怎麼開始

1. **招募錄取**（取代計畫 5「只標記錄取」）：
   - 品牌在報名者旁邊按「錄取」，會先打開頁面內的表單：
     - 金額：預填創作者提出的報價；沒有的話預填招募預算的上限，再沒有就用下限。必填，1 到 10,000,000 的整數。
     - 交付內容：預填招募的合作形式加上說明摘要，1–1000 字。
   - 送出後，在同一個 transaction 裡完成三件事：報名改為 `accepted`、建立對話、建立合作案（狀態 `awaiting_payment`，`brief_id` 指向招募）。完成後導向合作案詳情頁。
   - 同一則報名只能建立一個合作案。
2. **直接邀請**：
   - 品牌在公開頁 `/c/<handle>` 按「邀請合作」（取代「即將推出」），會打開頁面內的表單：案名（1–60 字）、交付內容、金額。
   - 送出後建立對話和合作案，狀態是 `invited`。
   - 只能邀請已審核的創作者。
   - 同一個品牌對同一位創作者，若已有進行中的邀約（狀態 `invited`），不能再重複邀請。

這兩種建立方式都要寫成 definer 函式（例如 `accept_application_with_collab`、`invite_creator`）。直接 insert `collaborations` 和 `conversations` 的權限要收回；計畫 1 有開放這兩張表的 insert，這次收掉。

## 狀態與動作

沿用 `transition_collaboration`，規則不變。這次加上畫面和函式：

| 狀態 | 進度條步驟 | 輪到誰 | 主要動作 | 次要動作 |
|---|---|---|---|---|
| `invited` | 邀約 | 創作者 | 接受 | 婉拒 |
| `awaiting_payment` | 確認／付款託管 | 品牌 | 確認並付款（計畫 8 前顯示「等待付款處理」） | 取消 |
| `awaiting_submission` | 交稿 | 創作者 | 交稿 | — |
| `in_review` | 審核 | 品牌 | 通過 | 要求修改（必填說明） |
| `awaiting_publish` | 發佈 | 創作者 | 填入貼文連結 | — |
| `awaiting_payout` | 撥款 | 平台 | （雙方只能看狀態「撥款處理中」） | — |
| `completed` | 結案 | — | — | — |
| `declined`／`cancelled` | — | — | 顯示「已婉拒」或「已取消」 | — |

「確認並付款」這個按鈕在計畫 8 之前：
- 按下後不改變狀態，只會打開說明：「付款功能即將開放。目前由平台人工確認款項，確認後會自動進入交稿階段。」
- 狀態維持 `awaiting_payment`，卡片顯示「等待付款確認」。
- 實際付款由管理員標記。

**標記已付款**一律走 `record_payment_success`：先建立一筆 `payments` 付款單，再呼叫 `record_payment_success`。不要開新的捷徑，這樣計畫 8 接綠界時，走的是同一條路徑。

- README 提供可以直接複製的 SQL。管理員執行時，帶入合作案的「案號」（合作案 id 的前 8 碼，畫面上顯示）。
- 本機的測試用按鈕「標記已付款（本機）」：
  - 只有 `isDevLoginEnabled()` 為真時才會出現。
  - 由 server route 以 service_role 建立付款單，再呼叫 `record_payment_success`。
  - 正式環境一律回 404。

**撥款**：`awaiting_payout` 改成 `completed`，由管理員執行。README 提供 SQL，以 service_role 或管理員身分呼叫 `transition_collaboration(..., 'payout')`。管理後台是計畫 9。

## 交稿

新的私密 bucket `deliverables`：
- 50 MB；接受 `image/jpeg`、`image/png`、`image/webp`、`video/mp4`、`video/quicktime`、`application/pdf`。
- 路徑：`<collab_id>/<uploader_uid>/<亂數檔名>`。

儲存空間的 policy：
- 讀取：該合作案的品牌或創作者，或管理員。
- 寫入：只有該合作案的創作者，寫在自己的資料夾，而且合作案狀態是 `awaiting_submission`。
- 刪除：創作者只能刪自己上傳、但還沒交出去的檔案（不在任何一次交稿紀錄裡）。

新資料表 `collaboration_submissions`：
- 欄位：`id`、`collaboration_id`、`round`（第幾次交稿，從 1 開始）、`note`（≤ 1000 字）、`links text[]`（≤ 5 個 https 網址，每個 ≤ 500 字）、`file_paths text[]`（≤ 10 個，必須在該合作案的 creator 資料夾裡）、`created_at`。
- 檔案或連結至少要有一個。
- 只能經由 definer 函式 `submit_deliverables(p_collab_id, p_note, p_links, p_file_paths)` 寫入。這個函式在同一個 transaction 裡新增交稿紀錄，並呼叫 `transition_collaboration('submit')`。
- 雙方和管理員可以讀取。

詳情頁顯示每一次交稿：
- 檔案：圖片顯示縮圖；影片和 PDF 顯示檔名和圖示，點了用 signed URL 開新分頁，有效 1 小時。
- 連結和說明。
- 品牌要求修改時寫的說明，會顯示在對應那一輪的下方，資料取自 `audit_logs` 的 note。

## 發佈

- 創作者填入貼文連結。前端先用 `new URL()` 檢查：必須是 https、主機名稱合法、有路徑。這是 followups 的要求，因為資料庫的 regex 會接受 `a..b.com`。
- 資料庫的 regex 再擋一次。

## 自動通過

- 新的 route `/api/cron/auto-approve`，只接受帶 `Authorization: Bearer ${CRON_SECRET}` 的請求，用常數時間比對。
- route 以 service_role 呼叫只授權給 service_role 的 definer 函式 `auto_approve_due()`。這個函式對所有 `in_review` 而且 `review_due_at <= now()` 的合作案，逐一呼叫 `transition_collaboration('auto_approve')`，回傳處理了幾件。
- 一件失敗不影響其他件。失敗的寫進 log。
- `vercel.ts` 或 `vercel.json` 設定 cron：每天一次（Hobby 方案的限制），時間是台灣時間 09:00，也就是 UTC 01:00。
- 新的環境變數 `CRON_SECRET`：README 寫明要加到 Vercel（Production）。本機在 `.env.local` 隨便設一個值即可。
- 審核卡片顯示「剩 N 天 HH 小時後自動通過」。到期後、Cron 還沒跑之前，顯示「即將自動通過」。

## 頁面

導覽列：品牌的「合作案」改成 `/brand/collabs`，創作者的「合作」改成 `/creator/collabs`。

### 列表 `/brand/collabs`、`/creator/collabs`

- 分頁標籤：進行中（invited 到 awaiting_payout）、已完成、已取消（declined 加上 cancelled）。
- 每列顯示：對方頭像和名稱、案名、金額、狀態名稱，以及「輪到你」或「等對方」的標記。品牌在 `awaiting_payout` 時顯示「撥款處理中」。
- 排序：「輪到你」的排在前面，其次依更新時間由新到舊。
- 空狀態：
  - 品牌：「還沒有合作案。到創作者廣場邀請，或從招募錄取創作者。」
  - 創作者：「還沒有合作案。到機會頁報名招募吧。」

### 詳情 `/brand/collabs/[id]`、`/creator/collabs/[id]`

兩邊共用同一個元件，只差在視角。

1. **標題區**：創作者 × 案名、交付內容、金額與託管狀態（「NT$4,500 待付款」「已託管」「已撥款」）、案號（id 前 8 碼）、來源（招募名稱，或「直接邀請」）。
2. **進度條（7 步）**：邀約 → 確認 → 付款託管 → 交稿 → 審核 → 發佈 → 撥款。
   - 已完成的步驟用淡主色，目前的步驟用主色加光暈，之後的步驟用灰色。
   - 從招募來的合作案，「邀約」顯示成已完成。
   - 手機版改成「目前狀態名稱 + 第 N / 7 步」加一條進度線。
3. **「現在要做什麼」卡片**（主色外框）：
   - 輪到自己時：「輪到你：○○」、說明、期限（審核的自動通過倒數），以及主要和次要按鈕。
   - 輪到對方時：「等對方○○」，並明確寫「你不用做任何事」。
   - 審核階段：品牌在卡片裡看到最新一次交稿的檔案縮圖。
   - 取消、婉拒或要求修改這類動作，用頁面內的確認區塊，不要用 `confirm()`。要求修改時，說明必填，最多 1000 字。
4. **交稿紀錄**：依輪次排列。
5. **對話區（系統事件）**：依時間列出 `audit_logs`，例如「11/25 測試創作者已交稿」「11/26 品牌要求修改：…」。計畫 7 會在這裡加上訊息和輸入框。

權限：
- 非參與者打開詳情頁，顯示 soft 404。
- 品牌打開 `/creator/collabs/...`、創作者打開 `/brand/collabs/...`，都會被 layout 導回自己那一區。

## 資料層的其他項目

- 讀取用的 definer 函式：
  - 列表需要對方的名稱和頭像。品牌讀不到 pending 創作者的 profile，但合作案的對方一定已審核，或至少已建立帳號。用 definer 函式 `list_my_collaborations(p_tab)` 和 `get_collaboration(p_id)`，回傳合作案欄位、對方的公開資料（名稱、頭像、handle）、招募名稱、交稿紀錄，以及經過整理的系統事件。只有參與者和管理員可以呼叫。
- `audit_logs` 寫入時，`actor_id` 對應的顯示名稱在讀取時才 join。
- 被收回寫入權限的資料表（`collaborations`、`conversations`）：在 migration 明確寫 `revoke`，再 `grant` 給需要的角色。
- 計畫 5 的 `decide_application(p_accept=true)` 改成必須帶金額和交付內容。也可以另外寫一個錄取函式，然後收回舊函式的錄取路徑，由實作計畫決定。婉拒照舊。
- 索引：`conversations(creator_id)`、`collaborations(conversation_id)`、`collaborations(brief_id)`（followups 的項目），以及 `collaboration_submissions(collaboration_id, round)`。

## 不在範圍內

- 綠界金流、退款、發票（計畫 8）。
- 站內訊息的文字對話和即時更新（計畫 7）。
- 管理後台 UI（計畫 9）。
- Email 通知。
- 評價（之後的計畫）。
- 合作案的爭議處理。
- 修改金額。
- 創作者主動提案。

## 驗收

- **資料庫測試：**
  - 錄取建立合作案：同一個 transaction、金額範圍、同一則報名不能重複建立、非招募主不能錄取。
  - 直接邀請：只能邀請已審核創作者、不能重複邀約、品牌身分檢查。
  - 交稿：只有創作者、只在 `awaiting_submission`、檔案路徑必須在自己的資料夾、輪次遞增。
  - storage 的讀取、寫入、刪除 policy，包括第三人被拒絕。
  - `auto_approve_due` 只處理到期的合作案，而且只有 service_role 能呼叫。
  - 用 `record_payment_success` 的標記路徑可以把狀態推進到 `awaiting_submission`。
  - 直接 insert `collaborations` 和 `conversations` 被拒絕。
  - 列表和詳情函式只回傳給參與者和管理員。
- 單元測試、lint、tsc、build 全部通過。cron route 的 secret 驗證要有測試。
- **E2E**（本機，用測試快速登入和 SQL 種子資料），在 390 與 1280 截圖：
  1. 招募錄取並設定金額，產生合作案，品牌和創作者都看得到。
  2. 用本機按鈕標記已付款。
  3. 創作者上傳圖片和 PDF，附連結交稿。
  4. 品牌要求修改，創作者再交一次稿，品牌通過。
  5. 創作者填入貼文連結，狀態變成「撥款處理中」。
  6. 用 SQL 撥款，合作案結案。
  7. 直接邀請，創作者婉拒；另一位創作者接受後，品牌取消。
  8. 帶 secret 呼叫 cron route：到期的合作案自動通過；不帶 secret 回 401。
  9. 第三人打不開詳情頁，也拿不到檔案的 signed URL。
