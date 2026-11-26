# 計畫 7：站內訊息設計

來源：`2026-11-22-ui-design.md` §6「訊息」（左邊對話列表、右邊對話內容，手機兩頁；送出前偵測聯絡方式、送出後在後台標記）、§5.2 合作案詳情的「對話區」、`plans/2026-11-22-foundation-followups.md` 的「7. 站內訊息」與「9. 管理後台」中 `is_conversation_participant` 的權限。資料表沿用計畫 1 的 `conversations`（`unique (brand_id, creator_id)`）與 `messages`；計畫 6 已收回 `conversations` 的直接 insert，對話只能經由 `ensure_conversation`（錄取、直接邀請）建立。視覺沿用 `2026-11-24-ui-refresh-design.md`。

## 使用者決定（2026-11-26）

| 題目 | 決定 |
|---|---|
| 誰可以開啟對話 | 品牌可以在已審核創作者的公開頁 `/c/[handle]` 按「傳訊息」主動開啟（只有品牌看得到這個按鈕）。創作者不能主動開啟；只能在已經存在的對話裡發訊息（由品牌傳訊息、錄取或邀請建立）。 |
| 報名過的創作者能不能找品牌 | **不能**（本計畫決定）。品牌一則招募可能收到很多報名，若每位報名者都能開對話，品牌的收件匣會變成第二個報名箱；報名本身已經有留言與報價。品牌想聊時，從報名者的公開頁按「傳訊息」即可。之後若需要，再加「品牌錄取前先問問題」之類的入口。 |
| 聯絡方式偵測 | 偵測電話、Email、LINE ID、外部連結。送出前在頁面內提醒（不是 `confirm()`），使用者可以「仍要送出」。送出後由資料庫的 BEFORE INSERT trigger 計算 `flagged_contact`；JS 與 SQL 用同一組正規表示式，兩邊註解互相指向，並共用同一組測試案例。管理員的違規訊息列表是計畫 9，這次只保證管理員能用 RLS／SQL 讀到被標記的訊息。 |
| 即時更新 | Supabase Realtime：開著的對話即時出現新訊息；導覽列（`SideNav`、`BottomTabBar` 的「訊息」）顯示未讀徽章，新訊息到達時即時更新。 |
| 附件 | 只支援文字，沒有附件。 |
| 合作案脈絡 | 對話標題區列出這個對話的所有合作案（案名 + 狀態，連到合作案詳情）；合作案詳情的「對話與紀錄」加上「前往對話」。 |
| 停權的創作者 | **對話暫停**（本計畫決定）：創作者的狀態不是 `approved` 時，雙方都不能再送訊息，但仍看得到歷史訊息。畫面顯示原因。品牌也不能對停權或待審核的創作者開啟新對話。 |

## 名詞

- **對話**：一個品牌與一位創作者之間唯一的一列 `conversations`。同一對的所有合作案共用這個對話。
- **未讀**：對方送出、而且晚於我的「已讀時間」的訊息。
- **暫停**：創作者不是 `approved`，對話變成唯讀。

## 誰看得到哪些對話

- 對話列表只列自己是品牌或創作者的對話。管理員看全部是計畫 9 的後台；這次管理員用 SQL 或 RLS 讀。
- 品牌按「傳訊息」會建立一個還沒有訊息的對話。這種空對話**只有品牌看得到**；創作者要等品牌送出第一則訊息才會在列表看到。由錄取或邀請建立的對話（有合作案），即使還沒有訊息，雙方都看得到。
- 第三方打開別人的對話頁，顯示 soft 404。品牌打開 `/creator/messages/...`、創作者打開 `/brand/messages/...`，會被 layout 導回自己那一區。

## 頁面

導覽列：品牌與創作者的「訊息」改成連到 `/brand/messages`、`/creator/messages`，圖示右上角顯示未讀徽章（有未讀的對話數，超過 9 顯示「9+」）。品牌的手機底部導覽列多出「訊息」，共 5 項。

### 列表 `/brand/messages`、`/creator/messages`

- 桌面（`md` 以上）：左欄是對話列表（寬 20rem），右欄是「選擇一個對話開始聊天」的空白提示。整塊高度固定在視窗內，兩欄各自捲動。
- 手機：只有對話列表。
- 每列：對方頭像（品牌看到創作者頭像，創作者看到品牌 Logo）、名稱、最後一則訊息的時間（今天顯示 `HH:mm`，其他天顯示 `MM/DD`，台灣時間）、最後一則訊息預覽（自己送的加「你：」，換行改成空白，最多 40 字）、未讀數膠囊，以及暫停的對話加「暫停」標籤。
- 排序：最後一則訊息時間由新到舊；沒有訊息的對話用建立時間。最多 200 筆，沒有分頁。
- 空狀態：
  - 品牌：「還沒有對話。到創作者的公開頁按「傳訊息」開始聊聊。」
  - 創作者：「還沒有對話。品牌傳訊息、錄取或邀請你之後，對話會出現在這裡。」

### 對話 `/brand/messages/[id]`、`/creator/messages/[id]`

- 桌面：左欄仍是對話列表（目前這一列反白、不顯示未讀數），右欄是對話。
- 手機：只顯示對話（第二頁），標題區左邊有「←」回到列表。
- **標題區**：對方頭像與名稱；品牌視角另有「查看公開頁」連到 `/c/<handle>`。下面一排是這個對話的合作案膠囊（案名・狀態），可以左右捲動，點了到合作案詳情。
- **訊息區**：由舊到新，依台灣日期插入日期分隔線（`2026/11/26`）。自己的訊息靠右、淡色底（`bg-primary-soft`）；對方的靠左、白底加邊框。每則下方顯示 `HH:mm`。被標記的訊息，雙方都會在下方看到「可能含聯絡方式，平台已留存紀錄」。
  - 一開始載入最新 50 則；更早的訊息用最上方的「載入較早的訊息」按鈕往前補 50 則。
  - 進入對話時捲到最底；收到或送出新訊息時也捲到最底；載入較早的訊息時不捲動。
- **輸入區**：多行輸入框、字數「n / 2000」、「送出」按鈕。Enter 換行；桌面可以按 Ctrl／⌘ + Enter 送出。手機的輸入區固定在底部導覽列上方。
  - 送出前偵測到聯絡方式：輸入框下方展開提醒「這則訊息可能含有電話、LINE。為了保障雙方權益，請在平台內溝通與付款；仍可送出，但平台會留存紀錄。」，按鈕是「仍要送出」和「修改訊息」。修改內容後要重新確認。
  - 對話暫停時，輸入區改成說明：品牌看到「這位創作者的帳號目前停權，對話暫停。」；創作者看到「你的帳號目前停權，暫時無法傳送訊息。」
- **即時**：訂閱這個對話的新訊息，收到就加到最後並標記已讀（分頁在背景時不標記，切回來再標記）。連線失敗時，訊息區上方顯示「即時更新已中斷，請重新整理頁面」。

### 入口

- `/c/[handle]`（品牌）：「邀請合作」旁邊加「傳訊息」（次要按鈕）。按下後開啟（或找到既有的）對話，導到 `/brand/messages/<id>`。訪客與創作者看不到這個按鈕。
- 合作案詳情 `/brand/collabs/[id]`、`/creator/collabs/[id]`：「對話與紀錄」標題右邊加「前往對話 →」，取代原本的「站內訊息即將推出。」。系統事件仍留在合作案詳情（不和訊息混排）。

## 資料層

### 權限（寫在 migration）

- `messages`：收回 anon、authenticated、service_role 的所有權限，只 `grant select` 給 authenticated、service_role。drop 計畫 1 的 `messages_insert_participant` policy。寫入只能經由 `send_message`；任何 API 角色都不能 UPDATE／DELETE。
- `is_conversation_participant`：從 PUBLIC 與 anon 收回 EXECUTE，保留 authenticated（`messages_select` policy 與 Realtime 的授權檢查會以 authenticated 呼叫）與 service_role。
- 內文上限從 4000 改成 **2000 字**（`messages_body_check`）。計畫 7 之前沒有任何畫面能寫入訊息，所以正式環境不會有超過的舊資料。
- 新資料表 `conversation_reads(conversation_id, user_id, last_read_at)`，主鍵 `(conversation_id, user_id)`。RLS 只讓本人讀；寫入只能經由 `mark_conversation_read`。
- 把 `messages` 加進 `supabase_realtime` publication。

### 函式（definer，`set search_path = ''`）

| 函式 | 誰可以呼叫 | 說明 |
|---|---|---|
| `start_conversation(p_creator_id) → uuid` | 品牌 | 已有對話就直接回傳。沒有的話，創作者必須是 approved，再用 `ensure_conversation` 建立。24 小時內最多開 30 個新對話。 |
| `send_message(p_conversation_id, p_body) → 新訊息` | 對話的品牌或創作者 | 管理員不行。清理內文（CRLF／CR 換成 LF，再 `clean_text`），不可有 bidi，1–2000 字。對話暫停時拒絕。同一個人 1 分鐘內最多 20 則。`sender_id` 一律是呼叫者。 |
| `mark_conversation_read(p_conversation_id)` | 參與者 | `last_read_at` 推進到這個對話最後一則訊息的 `created_at`，只會往後、不會倒退。沒有訊息時不寫。 |
| `list_my_conversations()` | 登入者 | 只列自己參與的對話（規則見上方「誰看得到哪些對話」），附對方的名稱、頭像、handle、最後一則訊息、未讀數與是否暫停。用 left join，對方 profile 不見時退回「品牌」「創作者」。 |
| `get_conversation(p_id)` | 參與者、管理員 | 標題資料，以及我是哪一方（brand > creator > admin）。其他人回 0 列。 |
| `list_messages(p_conversation_id, p_before_at, p_before_id, p_limit)` | 參與者、管理員 | 由新到舊，`(created_at, id)` 游標分頁，`p_limit` 限制在 1..100（預設 50）。其他人回 0 列。 |
| `unread_conversation_count() → integer` | 登入者 | 有未讀訊息的對話數（給導覽列徽章用）。 |
| `get_collaboration(p_id)` | （計畫 6） | 多回傳 `conversation_id`，給「前往對話」用。 |

對話的合作案列表直接以使用者自己的 client 讀 `collaborations`（`conversation_id = <id>`）。RLS 本來就只讓參與者與管理員讀。

### 聯絡方式偵測

SQL 的 `has_contact_info(text)`（immutable、不授權給任何 API 角色）與 TS 的 `contactKinds(text)` 使用同一組規則：

1. 先做 NFKC 正規化，再轉小寫（全形數字、英文、冒號都變成半形）。
2. **Email**：`[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}`
3. **外部連結**：`(https?://|www\.)`，或 `[a-z0-9-]\.(com|net|org|tw|me|io|co|cc|ly|gl|app|link|page|site)([^a-z0-9]|$)`（`line.me`、`bit.ly` 也算這一類）。
4. **LINE**：`(^|[^a-z])line[ \t]*(id|[:@])`、`加[^\n]{0,2}(賴|line)`、`賴[ \t]*(id|[:@])`。
5. **電話**：先去掉空白、Tab、括號、點、連字號，再比對手機 `(^|[^0-9])(\+?886|0)9[0-9]{8}([^0-9]|$)` 或市話 `(^|[^0-9])0[2-8][0-9]{7,8}([^0-9]|$)`。

這些規則都沒有反向參照，所以「有沒有符合」在 Postgres ARE 和 JS 的結果相同。兩邊的測試共用同一組案例：16 個要偵測到的，例如 `０９１２３４５６７８`、`ＬＩＮＥ：mei`、`加個line吧`；以及 11 個不應誤判的，例如 `預算 NT$30,000 元`、`deadline: 12/1`、`line drawing 風格`、`IG @mei.ig`。這組案例已在本機 rollback 的 transaction 裡實際比對過。

已知限制：用中文數字寫電話（「零九一二…」）、把 Email 寫成「at」、把號碼拆成多則訊息，都偵測不到。IG 帳號（`@xxx`）不算聯絡方式，因為創作者的公開頁本來就會顯示 IG。

`flagged_contact` 由 BEFORE INSERT trigger `messages_flag_contact` 一律重新計算。任何寫入路徑都一樣，包括擁有者在 SQL Editor 直接 insert。訊息不改走 service_role（followups「7. 站內訊息」）。

### 已讀與未讀

- 已讀時間記在 `conversation_reads` 的 `last_read_at`。
- 標記已讀的時機：開啟對話時，以及收到對方新訊息、而且分頁在前景時。由 client 呼叫 Server Action，不在伺服器渲染時寫入，避免 prefetch 把訊息標成已讀。
- 標記完成後在 `window` 發出 `kollink:messages-read` 事件，導覽列的徽章收到後重新查詢。
- 已讀時間取「最後一則訊息的 `created_at`」，而不是 `now()`。若某則訊息的 `created_at` 比較早、卻比較晚 commit，可能被當成已讀。`send_message` 是單一語句的短 transaction，這種情況可以接受。

### 即時更新（Realtime）

- 使用 Postgres Changes 訂閱 `public.messages` 的 INSERT。
- Realtime 會以**訂閱者的 JWT** 檢查 `messages_select`（RLS），訂閱者只收得到自己讀得到的列。所以：
  - 導覽列徽章與對話列表的訂閱不加過濾，收到的本來就只有自己參與的對話（或管理員的全部，但管理員沒有這兩個導覽列）。
  - 開著的對話另外加 `conversation_id=eq.<id>` 過濾。
- 訂閱前先 `await supabase.realtime.setAuth()`。`@supabase/supabase-js` 2.119 的 browser client 雖然會在 `INITIAL_SESSION` 時自動 setAuth，但訂閱可能早於那個事件，而先以 anon 身分訂閱就什麼都收不到。之後 token 更新由 supabase-js 自動處理（`TOKEN_REFRESHED` → `setAuth`）。
- 收到的列只當成「有新訊息」的訊號，或直接顯示（內容本來就是自己讀得到的）：
  - 對話頁：把收到的訊息合併進畫面（依 id 去重），並標記已讀。
  - 導覽列：重新呼叫 `unread_conversation_count()`。
  - 對話列表：debounce 400ms 後 `router.refresh()`，由伺服器重算預覽、排序與未讀數。
- 頻道名稱一律加亂數尾碼。realtime-js 對同名 topic 會回傳同一個 channel，兩個元件用同名 topic 會互相干擾。

### 文字規則（JS 與 SQL 一致）

- 先把 CRLF／CR 換成 LF，再用 `clean_text`／`cleanTextWithin` 清理。
- JS 用 `hasBadChar`（bidi 或 NUL）擋，SQL 用 `has_bidi` 擋。
- 字數以 code point 計算，1–2000 字。
- 中間的換行保留，畫面用 `whitespace-pre-wrap` 顯示。

### 錯誤碼（TS 端只經由 `src/lib/messages/errors.ts` 轉成中文）

| 錯誤 | 代碼 | 畫面文字 |
|---|---|---|
| `not authenticated` | 42501 | 登入已逾時，請重新登入 |
| `not a brand` | 42501 | 只有品牌可以主動傳訊息 |
| `creator not found` | P0002 | 找不到這位創作者，或對方還沒通過審核 |
| `conversation not found` | P0002 | 找不到這個對話 |
| `conversation closed` | 55000 | 對話已暫停，無法傳送訊息 |
| `invalid body` | 22023 | 訊息不能空白、最多 2000 字，也不能含特殊控制字元 |
| `too many messages` | 54000 | 傳送太頻繁，請稍候一分鐘再試 |
| `too many conversations` | 54000 | 今天開啟的新對話已達上限，請明天再試 |

其他錯誤一律顯示「發生錯誤，請稍後再試」。

## 不在範圍內

- 附件、圖片、已讀回條（「已讀」字樣）、正在輸入中、訊息編輯或刪除、封鎖對方、檢舉按鈕。
- Email 或推播通知（離線時收不到提醒）。
- 管理員的違規訊息列表與停權操作（計畫 9）。這次只在 README 附上讀取被標記訊息的 SQL。
- 創作者主動開啟對話、群組對話、品牌多成員。
- 訊息搜尋、對話列表分頁（最多 200 筆）。
- 把訊息與合作案的系統事件混在同一條時間軸。

## 驗收

- **資料庫測試（pgTAP）：**
  - 權限：
    - messages 對任何 API 角色都不能直接 insert（包括 service_role 與計畫 1 的欄位權限），不能 update、delete，anon 讀不到。
    - `is_conversation_participant` 不再授權給 anon。
    - `conversation_reads` 不能直接寫入。
    - `messages` 在 `supabase_realtime` publication 裡。
  - 聯絡方式：與 TS 共用的正反案例。
  - 開啟對話：
    - 創作者不能開；未登入不能開。
    - 待審核或不存在的創作者回 P0002。
    - 已有對話時回傳同一個，包括停權的創作者。
    - 品牌對已審核的創作者可以開啟，重按回傳同一個。
    - 24 小時內第 31 個新對話被擋，已有的對話不受頻率限制。
  - 送出：
    - 第三方與管理員不能送。
    - 內文會被清理；`sender_id` 一定是呼叫者，不能偽造。
    - CRLF 會換成 LF；空白、超過 2000 字、含 bidi 都被拒絕，剛好 2000 字可以。
    - 含聯絡方式時可以送出但被標記，一般訊息沒有標記。
    - 不能直接 insert、update、delete。
    - 對話暫停時雙方都不能送。
    - 第 21 則被頻率限制擋下。
    - 擁有者直接 insert 時也由 trigger 計算 `flagged_contact`。
  - 已讀：
    - 第三方不能標記。
    - 沒有訊息時不寫入。
    - 已讀時間等於最後一則訊息的時間。
    - 只讀得到自己的已讀紀錄。
  - 可見性：參與者看得到訊息，第三方看不到；管理員看得到被標記的訊息。
  - 讀取函式：
    - 列表的排序與空對話規則、未讀數、暫停標記、徽章數，以及標記已讀後未讀歸零。
    - 標題只給參與者和管理員。
    - 分頁游標與 `p_limit` 的上下限。
    - 第三方拿不到訊息、管理員拿得到。
    - `get_collaboration` 帶出 `conversation_id`。
  - 既有測試 `02_briefs_messaging_rls.test.sql` 改成用 `send_message` 發訊息，斷言數不變。
- **單元測試：** 聯絡方式（與 pgTAP 相同的案例）、內文清理與驗證、列表與訊息的 mapper、時間與預覽文字、訊息合併去重、錯誤對應、讀取函式（mock client）、Server Actions（輸入檢查、錯誤對應、導向）、導覽列項目。lint、tsc、build 全部通過。
- **E2E**（本機，用測試快速登入 `POST /auth/dev-login`，`account=brand|creator`；在 390 與 1280 截圖）：
  1. 品牌在 `/c/devcreator` 按「傳訊息」，到對話頁看到空白對話；創作者的列表看不到這個對話。
  2. 品牌送出第一則訊息，創作者的導覽列徽章不用重新整理就變成 1，列表出現對話並顯示未讀。
  3. 創作者打開對話，徽章歸零；回覆後，品牌那邊的對話即時出現回覆。
  4. 輸入「我的 LINE ID: mei_123」：送出前出現提醒；按「修改訊息」不送出；再按「仍要送出」後送出，雙方都看到「可能含聯絡方式」，SQL 查得到 `flagged_contact = true`。
  5. 用 SQL 種 60 則舊訊息後，「載入較早的訊息」能補齊。
  6. 合作案詳情的「前往對話」導到同一個對話，標題區列出合作案膠囊。
  7. 用 SQL 把創作者改成停權：雙方輸入區變成暫停說明，品牌在列表看到「暫停」標籤；改回 approved 後恢復。
  8. 第三方打開對話頁是 404；品牌開 `/creator/messages` 被導回 `/brand`。
  9. 手機 390：列表與對話是兩頁，輸入區固定在底部導覽列上方，沒有整頁水平捲軸。
