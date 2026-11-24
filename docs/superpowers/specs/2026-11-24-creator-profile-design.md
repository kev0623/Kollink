# 計畫 3：創作者公開檔案頁 `/c/[handle]` 設計

來源：`2026-11-22-ui-design.md` §5.3，以及 `plans/2026-11-22-foundation-followups.md` 的「3. 創作者公開檔案頁」。視覺沿用 `2026-11-24-ui-refresh-design.md` 的 token 與元件。

## 使用者決定（2026-11-24）

| 題目 | 決定 |
|---|---|
| 作品來源 | 創作者上傳圖片，存 Supabase Storage；每張可附一個 IG 貼文連結（選填）。最多 6 張。 |
| 頭像 | 創作者自己上傳；沒上傳時顯示名字第一個字。 |
| 平台數據（評分、完成案數、準時率、合作過的品牌、評價） | 版面先排好，沒有資料時顯示「新創作者・尚無評價」。評價資料表留到計畫 6。 |
| 未審核創作者的公開頁 | 只有本人能預覽，上方提示「審核通過後才會公開」；其他人（含管理員以外的品牌）看到 404。 |

## 頁面內容（手機優先，由上到下）

1. 頭像、顯示名稱、地區、內容領域標籤、平台數據列（目前固定顯示「新創作者・尚無評價」）。
2. 三項數據：IG 粉絲數、互動率（%）、主要受眾年齡。創作者沒填的項目顯示「—」。
3. 風格標籤。
4. 作品：最多 6 張，3×2 網格（手機 2 欄、桌面 3 欄）；有連結的點了開新分頁到 IG。沒有作品時整個區塊不顯示。
5. 想接的合作（`collab_types`）。
6. 報價方案（`creator_rates`）：
   - 訪客或創作者身分：顯示鎖定區塊「🔒 品牌登入後可查看報價」，連到 `/login?next=/c/<handle>`。
   - 品牌身分：列出各合作形式的價格（NT$，千分位）；沒有報價時顯示「尚未提供報價，可以直接邀請洽談」。
7. 合作過的品牌：目前顯示空狀態「還沒有完成的合作」。
8. 「邀請合作」按鈕：手機固定在底部，桌面固定在右欄頂部。
   - 訪客：連到 `/signup?role=brand`。
   - 品牌：目前停用，顯示「即將推出」（邀約流程在計畫 4/6）。
   - 創作者（包含本人）：不顯示按鈕。

電腦版（`md` 以上）分兩欄：左欄放 1–3，右欄放 4–7，「邀請合作」固定在右欄頂部。公開頁不套登入後的側邊導覽外框，最上方用簡單的頂列（Kollink 字標，以及登入或回後台的連結）。

## SEO / 分享

- 伺服器端渲染。`generateMetadata` 設定 title「<顯示名稱>（@<handle>）｜Kollink」與 description（地區、內容領域、粉絲數）。
- `opengraph-image`：用 Next 的 OG 圖片產生功能，內容是頭像（或名字首字）、名稱、粉絲數、內容領域。
- 未審核或不存在的 handle：`notFound()`，而且 metadata 不洩漏任何資料。本人預覽時加上 `robots: noindex`。
- 注意 `cacheComponents`：讀 session 的部分（本人判斷、品牌判斷、報價）必須放在 `<Suspense>` 裡；公開資料要可以被快取或預先渲染，但審核狀態一改就要能看到新內容（用 tag 或不快取，由實作計畫決定，並寫明理由）。

## 資料層

### 新欄位（`creator_profiles`）

- `avatar_path text`：null 或 `<user_id>/avatar-<檔名>`；格式用 CHECK 限制，比照 `brand_profiles.logo_path`。
- `audience_age text`：選項白名單在 UI 端（`13-17`、`18-24`、`25-34`、`35-44`、`45+`），資料庫只限長度 ≤ 10。
- 既有的 `bio`（≤ 300 字）、`style_tags`（≤ 8 個，每個 ≤ 12 字）、`collab_types`（UI 白名單：`IG 貼文`、`Reels`、`限時動態`、`產品互惠`；資料庫限 ≤ 6 個，每個 ≤ 20 字）、`engagement_rate`（0–100）開始使用。文字要經過既有的 `clean_text` 處理，並擋下 `has_bidi` 字元，跟現有函式一致。

### 新資料表 `creator_portfolio_items`

`id uuid pk`、`creator_id uuid → creator_profiles.user_id on delete cascade`、`image_path text not null`（`<creator_id>/portfolio-<檔名>`，CHECK 格式）、`link_url text`（null，或 `https://(www.)?instagram.com/...`，由函式檢查）、`position smallint 0–5`、`unique (creator_id, position)`。

- RLS select：anon 與 authenticated 都可以讀，條件是創作者已審核、本人或管理員（跟 `creator_profiles_select` 一樣）。
- 不開放直接寫入；在 migration 裡明確寫 `grant`（雲端不會自動授權，見 followups「資料表權限寫在 migration」）。

### 公開讀取

anon 讀不到 `profiles.display_name`，所以要新增 definer 函式 `get_public_creator(p_handle text)`，只回傳公開欄位：handle、display_name、avatar_path、region、categories、follower_count、engagement_rate、audience_age、style_tags、collab_types、bio、status、is_self。
- 條件：已審核，或呼叫者是本人；其他情況不回傳任何列。
- grant 給 anon 與 authenticated。
- 作品用一般 select（受 RLS 限制）讀取；報價沿用 `creator_rates_select` 的 RLS（品牌與本人）。

### 寫入（都用 definer 函式，比照 `update_creator_account`）

- `update_creator_public_profile(p_bio, p_style_tags, p_collab_types, p_engagement_rate, p_audience_age, p_avatar_path)`：呼叫者必須是創作者；檢查格式與長度。
- `set_creator_portfolio(p_items jsonb)`：整批覆寫，最多 6 項，每項是 `{image_path, link_url}`，position 依陣列順序。
- `set_creator_rates(p_rates jsonb)`：整批覆寫，`collab_type` 必須在 `collab_types` 裡，`price_twd` 是 0 到 10,000,000 的整數。同時收回 authenticated 對 `creator_rates` 的直接寫入（拿掉 `creator_rates_write_own` policy，撤銷 insert/update/delete）。
- 這些函式都不會改到 status 或 handle。

### Storage

新的公開 bucket `creator-media`：單檔上限 5 MB，只接受 `image/jpeg`、`image/png`、`image/webp`。
- 寫入限制：路徑第一層是自己的 uid，而且 `my_role() = 'creator'`。
- 讀取：bucket 是公開的。未審核創作者的圖片網址如果被猜到也看得到；這點可以接受，因為路徑含亂數。這要寫進文件。
- 上傳在 client 端用使用者自己的 Supabase client，跟品牌 Logo 的做法一樣；送出時由函式檢查路徑屬於本人。
- 孤兒檔清理與品牌 Logo 共用同一項待辦。

## 創作者後台

`/creator/me` 新增「公開頁」區塊（或拆成子頁 `/creator/me/profile`，由實作計畫決定）。內容：頭像上傳、自我介紹、風格標籤、想接的合作（勾選）、互動率、受眾年齡、作品（上傳、排序、刪除、IG 連結）、報價（每個勾選的合作形式各一個價格）。另外顯示「查看我的公開頁」連結到 `/c/<handle>`。

## 不在範圍內

收藏 ♡（計畫 4）、評價資料表與真實的平台數據（計畫 6）、邀約流程（計畫 4/6）、圖片 magic bytes 驗證（目前沒有 server 端上傳 action，沿用 followups 的規則）。

## 驗收

- 資料庫測試：
  - anon 透過 `get_public_creator` 讀得到已審核的創作者、讀不到 pending 的。
  - 本人讀得到自己 pending 的資料。
  - anon 讀不到報價；品牌讀得到報價。
  - 創作者不能改別人的作品或報價，也不能直接 insert/update `creator_rates`、`creator_portfolio_items`。
  - 函式的格式與長度檢查都有測試；品牌不能上傳到 `creator-media`。
- 單元測試與 lint、tsc、build 全部通過。
- E2E：在本機實際走過以下流程，並在手機 390 與桌面 1280 截圖：創作者填資料並上傳 → 本人預覽（pending）→ 用 SQL 核准 → 訪客看到公開頁與報價鎖定區塊 → 品牌看到報價 → 查看 OG 圖片。
