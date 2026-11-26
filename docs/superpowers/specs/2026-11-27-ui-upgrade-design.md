# Kollink UI 升級規格：紅線

日期：2026-11-27。取代 `2026-11-24-ui-refresh-design.md` 的視覺部分（該文件的「不改資料流程」原則本次不適用：本次同時處理 QA 報告的體驗問題）。

## 0. 使用者的要求與決定

- 原話：「UI 請幫我大大升級，可以參考 https://x.com/threejs（three.js 官方帳號的 WebGL 互動作品）；使用者體驗優先；功能也都幫我測試好」。
- 決定：首頁、登入／註冊用 3D，創作者公開頁輕量點綴；品牌／創作者／管理後台保持俐落（質感升級，不放 3D）。深色主題為主，可切換淺色，預設跟隨系統。
- 方向文件：`.superpowers/sdd/ui-direction.md`（主題「紅線」）。QA 報告：`.superpowers/sdd/audit-qa.md`（Major 4、Minor 17、Polish 12）。本規格把方向細化成可實作的決定，並逐條吸收 QA。

## 1. 原則

1. **只押一個意象：紅線**。月老的紅線把品牌和創作者繫在一起。大膽只花在首頁的 3D、登入頁的安靜版、合作案進度條（紅線加結）、未讀點與主要按鈕的紅；其他地方安靜、有紀律。
2. **使用者體驗優先於裝飾**。3D 永遠是「增強」：標題、按鈕、表單都是伺服器渲染的 HTML，3D 慢、壞、被關掉都不影響使用。
3. **每頁一個主要動作**，位置固定；不可復原或影響金流的動作一律頁內確認；錯誤告訴使用者怎麼修，死路一定給出口（客服入口）。
4. **同一件事全站同一個名字、同一個樣子**（按鈕、確認、通知、空狀態、檔案欄位都有共用元件）。
5. **誠實**：首頁沒有假數字、假推薦、假客戶 logo；付款相關文案只寫系統真的做到的事。

## 2. 色彩 token

### 2.1 token 表（`src/app/globals.css`，Tailwind v4 `@theme`）

深色是 `@theme` 的預設值；淺色寫在 `:root[data-theme="light"]`，以及沒有 JS 時的 `@media (prefers-color-scheme: light) { :root:not([data-theme]) }`（兩段內容相同，由單元測試保證一致）。

| token（`--color-*`） | 深色 | 淺色 | 用途 |
|---|---|---|---|
| `bg` | `#0D1424` 夜靛 | `#F3F5F9` | 頁面底 |
| `panel` | `#131C31` | `#E9EDF4` | 後台主內容區、側欄 |
| `surface` | `#1A2540` | `#FFFFFF` | 卡片、輸入框、底部導覽 |
| `subtle` | `#24304F` | `#EEF1F6` | 中性的淡底：hover、選取列、標籤、骨架（**新增**；取代被當成灰色用的 `primary-soft`） |
| `line` | `#2A3654` | `#D5DBE7` | 分隔線、卡片邊（裝飾性，不需 3:1） |
| `line-strong` | `#62739A` | `#7D88A0` | 輸入框、核取方塊、次要按鈕的邊（UI 元件邊界 ≥ 3:1，**新增**） |
| `ink` | `#EEF1F7` | `#0D1424` | 主要文字；`bg-ink` 是「反白膠囊」（選中的篩選標籤） |
| `on-ink` | `#0D1424` | `#FFFFFF` | `bg-ink` 上的文字（深色主題下反白膠囊是亮底深字） |
| `muted` | `#9AA6BF` | `#56617A` | 次要文字 |
| `primary` | `#D9392F` | `#D2342B` | 紅線：主要按鈕底色、進度、未讀點（深色主題比方向稿 `#F0483E` 暗一點，白字才過 4.5:1） |
| `primary-hover` | `#C2322A` | `#B8281F` | 主要按鈕 hover／按下（**新增**） |
| `on-primary` | `#FFFFFF` | `#FFFFFF` | 主要按鈕文字（**新增**） |
| `primary-soft` | `#3A1D26` | `#FBE4E1` | 只用在「紅線語意」的淡底：目前步驟光暈、自己的訊息泡泡、需要你處理的行動卡 |
| `accent` | `#FF7A70` | `#B8281F` | 紅色**文字**：酬勞金額、強調連結（取代 `text-primary`，**新增**） |
| `thread` | `#F0483E` | `#D2342B` | 純裝飾的紅線（3D、SVG、步驟線），不承載文字（**新增**） |
| `thread-glow` | `#FF6B5E` | `#E8584E` | 3D 紅線光暈（**新增**） |
| `far` | `#2A3654` | `#C9D1E0` | 3D 遠景線段（**新增**） |
| `success` | `#8FD3BF` 青瓷 | `#17705A` | 成功、已完成、上線中（淺色由 `#3E8E6A` 加深，修 QA m9） |
| `success-soft` | `#17332F` | `#DDF3EC` | 成功的淡底 |
| `danger` | `#FF8A80` | `#B42318` | 錯誤、破壞性動作的文字與邊框 |
| `danger-soft` | `#3A1A1E` | `#FDECEA` | 錯誤通知與破壞性確認的淡底（**新增**） |
| `focus` | `#FF9A8F` | `#B8281F` | 焦點框（**新增**） |

半徑：`--radius-card: 20px`（原 32px）、`--radius-btn: 9999px`、`--radius-input: 12px`、`--radius-nav: 16px`（原 24px）。深色不用陰影，用 surface 層次與 1px `line`；淺色只有浮層（下拉、對話框）用一層 `shadow-lg`。

### 2.2 對比（WCAG 2.2，計算腳本在 scratchpad `ui-plan/c3.mjs`）

文字（需 ≥ 4.5:1）：

| 底 | 深色 ink／muted／accent／success／danger | 淺色 ink／muted／accent／success／danger |
|---|---|---|
| `bg` | 16.24／7.51／7.24／10.71／8.05 | 16.84／5.68／5.72／5.49／6.02 |
| `panel` | 14.99／6.93／6.68／9.88／7.43 | 15.65／5.28／5.32／5.11／5.60 |
| `surface` | 13.42／6.21／5.98／8.85／6.65 | 18.38／6.20／6.25／6.00／6.57 |
| `subtle` | 11.52／5.33／5.13／7.60／5.71 | 16.23／5.48／5.52／5.30／5.81 |
| `primary-soft` | 13.41／6.20／5.98／8.84／6.65 | 15.13／5.10／5.14／4.94／5.41 |
| `success-soft` | 11.97／5.53／5.33／7.89／5.93 | 15.85／5.35／5.39／5.17／5.67 |
| `danger-soft` | 13.79／6.37／6.14／9.09／6.83 | 16.07／5.42／5.46／5.24／5.75 |

其他：`on-primary`／`primary` 深 4.59、淺 4.92；`on-primary`／`primary-hover` 深 5.55、淺 6.25；`on-ink`／`ink` 深 16.24、淺 18.38。非文字（≥ 3:1）：`line-strong`／`surface` 深 3.21、淺 3.56；`line-strong`／`panel` 深 3.58、淺 3.03；`focus`／`bg` 深 8.99、淺 5.72；`thread`／`bg` 深 4.99、淺 4.51；`primary`／`surface` 深 3.31、淺 4.92。

### 2.3 既有 class 的對照（src/ 內全部要能用，或在指定 task 遷移）

| 既有用法（次數） | 處理 | Task |
|---|---|---|
| `text-ink` 237、`text-muted` 217、`border-line` 191、`bg-surface` 162、`divide-line` 12、`bg-bg` 7、`bg-panel` 4、`bg-line` 5 | 名稱不變，值換成新表 | 1 |
| `bg-ink text-on-ink`（69／71） | 名稱不變。語意定為「反白膠囊」（選中的標籤）。被當成**主要按鈕**用的地方，在各畫面 task 改成 `btn.primary`（見 §9.4）；Task 1 後到遷移前，深色主題下它們是亮底深字的膠囊，仍可用、對比足夠 | 1、6–12 |
| `bg-primary-soft`（54，多半當中性灰） | Task 1 全部機械替換成 `bg-subtle`（含 `hover:`）；之後只有訊息泡泡、目前步驟、行動卡刻意用 `bg-primary-soft` | 1、10、11 |
| `text-primary`（14） | 機械替換成 `text-accent` | 1 |
| `bg-primary`、`border-primary`、`ring-primary-soft`（Stepper 用） | Stepper 重寫 | 10 |
| `ring-ink`（30）、`focus:ring-ink` | 名稱不變（ink 對比最高）；新元件改用全站 `:focus-visible` 規則（`outline-focus`） | 1、2 |
| `border-ink`（16，選中標籤與 hover） | 名稱不變 | — |
| `accent-ink`（6，radio／checkbox） | 機械替換成 `accent-primary` | 1 |
| `bg-danger`（3：未讀徽章、ConfirmAction） | 未讀徽章改 `bg-primary text-on-primary`（Task 1）；ConfirmAction 重寫（Task 2） | 1、2 |
| `text-success`、`bg-success-soft`、`text-danger`、`border-danger` | 名稱不變，值換新 | 1 |
| `bg-ink/40`（FilterDrawer 的 backdrop） | 名稱不變（深色下會變亮，改成 `backdrop:bg-bg/70`） | 8 |
| `rounded-card` 95、`rounded-btn` 109、`rounded-input` 30、`rounded-nav` 2 | 名稱不變，值換新 | 1 |
| `opengraph-image.tsx` 的 `OG_COLORS` 色碼 | 換成新深色值 | 7 |

驗收：`grep -rnE "(bg|text|border|ring|accent)-primary-soft|text-primary\b|accent-ink" src` 在 Task 1 後只剩刻意保留的 `primary-soft`（Task 1 後為 0，Task 10、11 才加回）。

## 3. 字體

`next/font/google`（自架，CSP 的 `font-src 'self'` 不用改）：

| 字體 | 權重 | 設定 | 用在 |
|---|---|---|---|
| Manrope | variable（200–800） | `subsets: ["latin"]`、`display: "swap"`、`preload: true`、`variable: "--font-manrope"` | 拉丁字與數字（放在字族最前面），金額與粉絲數加 `tabular-nums` |
| Noto Sans TC | 400、500、700 | `display: "swap"`、`preload: false`、`variable: "--font-noto-sans"` | 介面與內文 |
| Noto Serif TC | 700、900 | `display: "swap"`、`preload: false`、`variable: "--font-noto-serif"` | 首頁大標（900）、各頁 h1、首頁段落標題、公開頁名字、合作案金額（700） |

- 中文字型由 Google 切成上百個 `unicode-range` 小檔，`next/font` 會全部自架；瀏覽器只下載頁面用到的字所在的切片，所以**不 preload**（preload 會抓到用不到的切片）。不用 variable 版本的中文字（切片大）。拿掉 600：`font-semibold` 在 Noto Sans TC 會取 700，不會假粗體。Rubik 移除。
- 字族：`--font-sans: var(--font-manrope), var(--font-noto-sans), "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif`；`--font-serif: var(--font-noto-serif), "Songti TC", "PMingLiU", serif`。
- 字級（px）：12／14／16／20／28／40／64，對應 Tailwind `text-xs`、`text-sm`、`text-base`、`text-xl`、`text-[28px]`、`text-[40px]`、`text-[64px]`。首頁大標：手機 40、平板 56、桌面 72（`text-[40px] md:text-[56px] xl:text-[72px]`）。內文行高 1.7（`leading-[1.7]` 設在 body），標題 1.2。後台頁面 h1：28px serif 700（原 32px sans）。
- 不用全大寫小標、不用等寬字當標籤（ATM 虛擬帳號這類「要逐字抄」的字串例外，保留 `font-mono tabular-nums`）、按鈕文字不加「→」（現有的「查看合作案 →」改成「查看合作案」）。

## 4. 主題切換

- `<html data-theme="dark|light" data-theme-pref="dark|light|system">`。偏好存在 `localStorage["kollink-theme"]`，值 `dark`／`light`／`system`（預設 `system`）。
- 根 layout 的 `<head>` 放一段內嵌腳本（`src/lib/theme.ts` 的 `THEME_SCRIPT`，字串常數）：讀偏好 → `system` 時用 `matchMedia("(prefers-color-scheme: light)")` 決定 → 在繪製前設定 `data-theme`、`data-theme-pref` 與 `style.colorScheme`。`<html>` 加 `suppressHydrationWarning`。這是 Next 文件 `preventing-flash-before-hydration.md`「Themes」的做法；CSP 是靜態的 `script-src 'self' 'unsafe-inline'`，內嵌腳本可執行，不需要 nonce（cacheComponents 的靜態外殼本來就不能用 nonce）。
- 沒有 JS：沒有 `data-theme`，CSS 用 `prefers-color-scheme` 跟隨系統（預設深色）。
- `ThemeSync`（client，掛在根 layout 的 body 最後）：`useLayoutEffect` 重新套用一次（開發模式 Strict Mode 會清掉 html 上的屬性，見同一份文件「Re-applying attributes in development」），並在偏好是 `system` 時監聽系統切換。
- 切換控制 `ThemeSelect`：原生 `<select>`（標籤「主題」，選項「深色／淺色／跟隨系統」）——鍵盤、螢幕閱讀器、手機原生選單都免費正確，16px 字不會觸發 iOS 放大。位置：後台側欄底部（桌面）、手機版頂列的帳號選單頁（品牌「設定」、創作者「我的」、管理員頂列）、首頁頁尾、登入／註冊頁底部。
- 3D 場景與 OG 以外的程式不讀色碼；場景從 `getComputedStyle(document.documentElement)` 讀 `--color-thread` 等變數，並用 `MutationObserver` 監看 `data-theme` 變化即時換色（不重建場景）。
- 切換時不做全頁漸變動畫（避免所有元素一起閃）。

## 5. 首頁（`/`）

### 5.1 結構

1. **頂列**（不 sticky、透明疊在 3D 上）：左邊字標「Kollink」（Manrope 800，`i`／`k` 之間沒有花樣；字標左側一個 8px 的紅色結點）。右邊：未登入「登入」（文字按鈕，44px 高）；已登入「進入後台」（依身分導 `/brand`、`/creator`、`/admin`、`/onboarding`；在 `<Suspense>` 內讀 session，fallback 是同尺寸的「登入」佔位，不跳動）。主題選擇不放頂列（手機空間不夠），放頁尾。
2. **主視覺**（`min-h-[100svh]`，最少 640px）：3D 紅線鋪滿背景；文字區靠左下（桌面 `max-w-[640px]`，左邊距 64px、底邊距 96px；手機左右 20px、底 40px）。
   - 大標（serif 900）、副標（sans 16／18px，`text-muted`）、兩個入口按鈕（就是紅線的兩端）、一行「已經有帳號？登入」。
   - 「我是品牌」= 主要按鈕（實心紅），「我是創作者」= 次要按鈕（描邊）——兩者同尺寸（手機各佔一半寬度、高 52px）。滑過／聚焦時紅線往那一端收緊（`data-thread-pull`）。
3. **怎麼運作**（`id="how"`）：一條隨捲動畫出來的 SVG 紅線串起四個結；編號是合理的（真的是順序）。
4. **品牌得到什麼／創作者得到什麼**：兩欄（手機上下），中間一條垂直的細紅線（桌面）；每欄 4 條，用列（不是卡片）。
5. **安心的設計**：4 條真實的機制說明（見 5.2），用分隔線的列。
6. **收尾**：一句話＋兩個入口按鈕（同主視覺）。
7. **頁尾**：字標與標語、「需要協助？」連結到 `/help`、`ThemeSelect`、「登入」「註冊」連結。不放年份（避免在靜態外殼讀現在時間）。

### 5.2 文案（全部定稿；實作時照抄）

**大標（三選一，預設 A）**
- A：「把對的品牌，牽到對的創作者。」
- B：「一條紅線，從品牌牽到創作者。」
- C：「好的合作，從牽對線開始。」

大標在 `src/lib/site.ts` 的 `HERO_HEADLINE`（預設 A），擁有者改一行即可換。

**副標**：「Kollink 是台灣品牌與 IG 創作者的合作平台。找人、談條件、付款、交稿到撥款，每一步都在同一條線上。」

**入口按鈕**：「我是品牌」（`/signup?role=brand`）、「我是創作者」（`/signup?role=creator`）。按鈕下方一行：「已經有帳號？登入」。

**怎麼運作**（段落標題「從牽線到撥款，四個結」）：
1. **媒合** —「品牌在創作者廣場找人直接邀請，或刊登招募讓創作者報名。條件寫清楚：交付內容、金額、期限。」
2. **確認並付款** —「創作者接受條件後，品牌付款。款項先由平台代管，不會直接進到任何一方。」
3. **交稿審核** —「創作者在平台上交稿，品牌審核：通過，或寫下要修改的地方。品牌逾期沒有審核，系統會自動通過。」
4. **發佈撥款** —「創作者發佈貼文並貼上連結，平台確認後把款項撥給創作者。」

**品牌得到什麼**（標題「給品牌」）：
- 「每位創作者都經過人工審核，才會出現在廣場。」
- 「看得到粉絲數、互動率、作品與報價，用類別與地區篩選。」
- 「一個招募收齊報名，錄取、婉拒都在同一頁。」
- 「合作進度一條線看到底，現在輪到誰一眼就知道。」

**創作者得到什麼**（標題「給創作者」）：
- 「一個公開頁放作品與報價，報價只給品牌看。」
- 「品牌找上門，或自己報名有興趣的招募。」
- 「品牌付款後才開始工作；交稿通過、發佈後撥款。」
- 「撥款全額轉到你的帳戶，平台不收手續費。」

**安心的設計**（標題「我們怎麼保護每一次合作」）：
- 「款項代管」—「品牌的付款先留在平台，創作者完成交稿與發佈後才撥出。」若 `paymentAvailability().enabled` 為 false，另加一行 `text-muted`：「線上付款開放前，款項由平台人工確認。」（伺服器元件在建置時讀環境變數；與合作案頁的說法一致）
- 「真人審核」—「創作者要在 IG 自我介紹放上驗證碼，平台人工確認是本人帳號。」
- 「訊息留在平台」—「討論訊息與交稿檔案都留在平台上；要分享電話或 LINE 前，系統會先提醒你。」
- 「有人可以問」—「遇到問題，從頁尾的『需要協助？』聯絡我們。」

**收尾**：「下一條線，可能就是你的。」＋兩個入口按鈕。

**頁尾**：「Kollink・台灣品牌 × 創作者合作平台」、「需要協助？」、「主題」選擇、「登入」「註冊」。

不放：數字統計、推薦語、客戶 logo、「立即免費試用」之類的話。

### 5.3 「怎麼運作」的捲動紅線

- 純 SVG ＋ CSS，不用 JS：一條垂直路徑（手機）／水平波浪路徑（桌面 ≥ 1024px）穿過四個結。結是 16px 圓，外圈 1px `thread`，已畫過的結填滿。
- `@supports (animation-timeline: view())` 時，路徑的 `stroke-dashoffset` 綁 `animation-timeline: view()`、`animation-range: entry 10% cover 60%`，捲進來時畫出；不支援（Firefox、舊 Safari）或 `prefers-reduced-motion: reduce` 時直接畫滿。不做每個段落 fade-up。

## 6. three.js 紅線場景

最終程式碼在實作計畫 Task 5（原型與截圖見計畫「原型」段）。

### 6.1 視覺

- 深靛的夜裡，一條有絲質感的紅線從左下的「品牌結」緩緩拱到右上的「創作者結」，主體在畫面右上與中段，**不壓到左下的文字區**（手機：線在上方 55% 的區域）。
- 線本身：粗細沿線 ±15% 變化、靠近結處略細；核心是實色加輕微 fresnel 提亮；外層一條 3.2 倍寬的光暈管，邊緣透明度衰減（深色：加法混合，像發光；淺色：一般混合、低透明度，像紅絲線在紙上的陰影——加法混合在淺底會被洗白）。
- 兩個結：低面數的小珠（Icosahedron）＋面向鏡頭的柔光圓片。
- 遠景：8 條（手機 5 條）很暗的細線（`far` 色），在 z −6 到 −12 慢慢飄——「其他正在發生的媒合」。沒有粒子雨、星空、地球。
- 不用後製（EffectComposer／bloom）：光暈靠第二條管與結的光圓片完成，手機也跑得動。

### 6.2 行為

- **繩索**：verlet 模擬（桌面 48 點、手機 32、登入頁 28、公開頁 20），兩端固定在結上；小重力、阻尼 0.985、每格 3 次約束；低頻風力讓它永遠在呼吸，不會完全靜止。
- **游標**：指標附近的點被輕推（彈簧趨向偏移目標，不會瞬移）；指標離開後慢慢回位。觸控裝置不跟手指（避免捲動時誤觸），只有呼吸。
- **入口按鈕張力**：滑過或聚焦「我是品牌」時，品牌端的結往中間移 12%、繩長縮短 8%，線往那一端收緊（約 300ms 緩動）；「我是創作者」反之。離開後放鬆。鍵盤聚焦一樣有效（`focusin`）。
- **「牽線」開場（唯一精心安排的時刻）**：約 1.2 秒，線從品牌結「畫」到創作者結（shader 依線的 v 座標裁切），到達時創作者結的光圓片亮一下。文字不等動畫：標題與按鈕是 HTML，一開始就在。canvas 在第一幀畫完後 300ms 淡入（不是 LCP 元素：LCP 是大標）。
- **閒置**：呼吸＋遠景線飄動；分頁隱藏（`visibilitychange`）或捲出視窗（`IntersectionObserver`）時停止 rAF。

### 6.3 技術

- 套件：只加 `three`（0.187.x）與 `@types/three`（dev）。不用 react-three-fiber／drei／examples addons。全部 **具名 import**。
- 檔案：`src/components/thread/thread-scene.ts`（不依賴 React 的純 TS，`createThreadScene(canvas, opts)` 回傳 handle：`setPointer`、`setPull`、`setPalette`、`resize`、`start`、`stop`、`dispose`）；`src/components/thread/ThreadCanvas.tsx`（client 包裝：在 `useEffect` 內 `await import("./thread-scene")`，所以 three 只在用到的頁面才下載，後台 bundle 不含 three）；`src/components/thread/ThreadFallback.tsx`（伺服器元件，靜態內嵌 SVG 紅線，與 3D 構圖相同）。
- **後備**：SVG 永遠先渲染（和 canvas 同一個容器、同尺寸，`absolute inset-0`），canvas 第一幀後才淡入並蓋上；以下情況不載入 three、只留 SVG：`prefers-reduced-motion: reduce`、`navigator.connection.saveData`、建立 WebGL context 失敗、`webglcontextlost`。reduced-motion 下首頁的 SVG 不動。
- **無版面位移**：容器尺寸由 CSS 決定（主視覺 `absolute inset-0`），canvas `position:absolute; width/height:100%`；CLS 必須是 0。
- **DPR 上限**：主視覺桌面 2、手機 1.5；登入頁與公開頁 1.5。`antialias` 只在 DPR < 2 時開。`powerPreference: "low-power"`、`alpha: true`（透明清除，頁面底色透出來，換主題不會出現色差）。
- **釋放**：卸載時 `stop()`、移除監聽、所有 geometry／material `dispose()`、`renderer.dispose()`、`renderer.forceContextLoss()`。
- **CSP**：three 從 npm 打包、不用 CDN；不用 `eval`／`new Function`；不用 Worker（`worker-src` 已允許 `'self' blob:`，但不需要）。`security-headers.ts` 不用改。
- **Bundle**：three 的 chunk 目標 ≤ ~170KB gzip（原型實測值記在計畫）；`npm run build` 後用 `.next` 產物確認 `/brand`、`/creator`、`/admin` 的 JS 不含 three。

### 6.4 三個用法

| 變體 | 頁面 | 構圖 | 互動 |
|---|---|---|---|
| `hero` | 首頁主視覺 | 全幅；線拱在右上與中段 | 游標、入口按鈕張力、開場 |
| `quiet` | `/login`、`/signup` | 桌面：左側 55% 的面板裡，線在面板中間慢慢飄；手機：表單上方 160px 的帶狀區 | 只有呼吸，無游標、無開場（線直接在） |
| `ribbon` | 創作者公開頁頂部 | 96px 高的帶，一條細線從左到右，中間經過頭像所在位置 | 只有呼吸；只在 `md` 以上且 `pointer: fine` 用 WebGL，手機一律 SVG |

## 7. 登入、註冊、Onboarding

- **版面**（`src/components/auth/AuthShell.tsx`）：桌面左右分欄：左 55% 是 `bg-bg` 上的 quiet 場景，左下角一句 serif 28px「每一次合作，都從一條線開始。」；右 45% 是 `bg-panel`，表單置中（最大寬 420px），表單本身在實心 `surface` 卡上（對比不受 3D 影響）。手機：頂列（字標＋回首頁）→ 160px 場景帶 → 表單卡。
- `/login` 標題「登入」，`/signup` 標題「加入 Kollink」；第 1 步身分選擇用兩張大卡（品牌／創作者，各一句說明），第 2 步表單上方顯示「以品牌身分註冊・更改」。
- AuthForm：表單 `noValidate`，Email 格式用自己的檢查與繁中錯誤（修 m6）；送驗證碼與驗證中按鈕文字變「寄送中…」「登入中…」（修 p10）；驗證碼欄位可貼上整串（既有 `toOtpCode`），送出成功後顯示「登入成功，正在帶你進去…」。「Google 登入（尚未設定）」在未設定時**不顯示**（只在本機會看到的停用按鈕沒有意義；m5）。
- **已登入者**造訪 `/login`、`/signup`：`proxy.ts` 直接導去 `/auth/continue`（保留 `role`、`next`），由既有的登入後去向決定（修 m4）。`/onboarding` 的 Gate 本來就會導走。
- Onboarding（`/onboarding/brand`、`/onboarding/creator`）：簡單頂列（字標）＋表單卡，不放 3D（填資料時不分心），表單一欄、步驟名稱寫清楚。

## 8. 創作者公開頁（`/c/[handle]`）與 OG

- 頂部 96px 的 ribbon（§6.4），往下是頭部：頭像（96px，外圈 2px `thread` 細環——頭像就是線上的一個結）、名字（serif 700 28/40px）、@handle、地區、類別標籤。數據（粉絲、互動率）用 Manrope tabular-nums 大字。
- 兩欄維持（桌面 2:3）；卡片只給真正獨立的區塊（頭部、作品、報價），其他用分隔線的段落。
- 品牌的「邀請合作／傳訊息」：手機固定底部列（保留 safe-area），桌面右欄 sticky。
- OG 圖（`opengraph-image.tsx`）：1200×630，夜靛底 `#0D1424`，左側頭像（外圈紅線環），右側名字與數據，一條 SVG 紅線（satori 支援 `<svg><path>`）從頭像環延伸到右下角的字標「Kollink」。不載入 serif 字型檔（OG 生成時間與大小優先）。

## 9. 後台設計系統（品牌、創作者、管理員）

### 9.1 殼

- 桌面：左側 88px 寬的直排導覽，底色 `panel`；最上方字標縮寫（紅結＋「K」）；項目是圖示＋12px 文字，選中時是 `bg-subtle` 圓角塊＋左側 3px 紅線（不是反白膠囊——反白膠囊在深色下太亮），未讀點是 `bg-primary`。底部：頭像、角色、`ThemeSelect`（精簡版，只顯示圖示＋目前選項）、「需要協助」、「登出」（44px）。
- 主內容區：`bg-bg`（不再是一塊圓角 panel 套在 bg 上——深色下兩層靛色太悶），內距桌面 40px、手機 16px，最大寬 1120px。
- 手機：底部導覽（`surface` 底、上緣 1px `line`、safe-area 保留），選中項目圖示與文字變 `ink` 並在上方有 2px 紅線；「即將推出」的項目不放在手機導覽（p12）。頂列：左邊頁面所在區名稱（品牌名／「管理後台」），右邊一個 44px 的帳號按鈕連到帳號頁（品牌 `/brand/settings`、創作者 `/creator/me`；管理員沒有帳號頁，頂列直接放主題與登出），登出移到帳號頁與側欄（修 m7「登出 24×16」）。
- 「跳到主要內容」連結（p4）：每個殼的第一個可聚焦元素，聚焦時才出現。

### 9.2 頁首與 `<title>`

- `PageHeader`：可選的返回連結（44px 高，「‹ 我的招募」）、h1（serif 700 28px）、可選的說明、右側（手機在下方）最多一個主要動作。
- 根 layout `metadata.title = { default: SITE_NAME, template: "%s｜Kollink" }`（用 `SITE_NAME` 組字串）。每個 `page.tsx` 都 `export const metadata = { title: "…" }`（詳情頁用固定的類別名稱，例如「合作案」「招募」，不為了 title 多查一次資料庫）。修 m2。

### 9.3 列表：列 vs 卡

- **列（row）**：同質、可掃描的清單——我的招募、合作案、訊息對話、報名者、後台所有列表、事件紀錄。`divide-y divide-line` 包在一個 `rounded-card border border-line bg-surface` 裡；每列整列可點（44px 以上），hover `bg-subtle`。
- **卡（card）**：獨立、有圖的物件——創作者卡（廣場）、招募卡（機會）、公開頁的頭部與作品。
- 手機廣場：預設**兩欄緊湊卡**（頭像或作品縮圖、名字、粉絲、互動率一位小數），一屏可見 4 張以上（修 p2）；桌面維持現在的卡片／表格切換。

### 9.4 按鈕（`src/components/ui/styles.ts` 的 `btn`）

| 變體 | 樣式 | 用在 |
|---|---|---|
| `btn.primary` | 實心 `bg-primary text-on-primary`，hover `bg-primary-hover`，高 44px（`btn.lg` 52px），全圓角，字重 700 | 每頁唯一的主要動作 |
| `btn.secondary` | `bg-surface`、1px `line-strong`、`text-ink`，hover `bg-subtle` | 次要動作、取消 |
| `btn.ghost` | 無框、`text-ink`，hover `bg-subtle` | 工具列、行內次要 |
| `btn.danger` | **描邊**：透明底、1px `danger`、`text-danger`，**一律帶圖示**（`Trash2`、`XCircle`、`Ban`、`LogOut`）＋明確動詞（「婉拒報名」「取消合作」「刪除草稿」），hover `bg-danger-soft` | 破壞性動作的第一顆按鈕 |
| `btn.dangerConfirm` | `bg-danger-soft`、1px `danger`、`text-danger`、字重 700、帶同一個圖示 | 確認區塊裡的「確定婉拒」 |

紅色主要按鈕與破壞性按鈕的區分**不靠顏色**：主要＝實心、無圖示；破壞性＝描邊＋圖示＋動詞，且一定先展開確認。共用：`disabled:opacity-50 disabled:cursor-not-allowed`、進行中文字換成「處理中…」並 `disabled`、焦點框（§9.13）。

### 9.5 表單

- 一欄；標籤在上（14px 700），提示在下（12px muted），錯誤取代提示（12px `text-danger`，前面加 `AlertCircle` 圖示，不只靠顏色）。
- 輸入框：高 44px、`text-base`（16px，手機不觸發 iOS 放大；修 m8）、`bg-surface`、1px `line-strong`、`rounded-input`；焦點 2px `focus` 框；錯誤時邊框 `danger`。textarea 一樣 16px。
- 所有表單 `noValidate`，不出現瀏覽器原生英文訊息（修 m6）；送出時依既有的 `validate*` 函式在欄位下方顯示繁中錯誤（`aria-describedby`＋`aria-invalid`）；招募精靈會跳到第一個有錯的步驟（既有行為）。
- 字數：有上限的欄位即時顯示「n / 上限」，超過時變 `danger` 且送出按鈕停用（修 m13 的訊息字數）。
- **檔案欄位**（修 m10）：`FilePicker` 元件——隱藏原生 input（`sr-only`，仍可聚焦），外觀是次要按鈕「選擇圖片」／「選擇檔案」＋選好的檔名（截斷）＋「移除」；聚焦時按鈕出現焦點框（`has-[:focus-visible]`）。用在頭像、作品、封面、Logo、交稿。

### 9.6 徽章（狀態）

12px、700、全圓角、高 24px、左側 6px 圓點：進行中＝`primary` 點＋`subtle` 底；成功＝`success` 點＋`success-soft` 底＋`success` 字；需要注意＝`danger` 點＋`danger-soft` 底；中性（草稿、已結束）＝`muted` 點＋`subtle` 底。徽章文字本身就說清楚狀態，不靠顏色。

### 9.7 合作案進度：紅線與結（`Stepper`）

- 7 步（既有 `COLLAB_STEPS`）。桌面：一條水平的線穿過 7 個結；已完成的段是 2px 實心 `thread`、未完成的段是 1px 虛線 `line-strong`；已完成的結＝實心 `thread` 小圓（12px）、目前的結＝16px 實心 `primary`＋6px `primary-soft` 光暈（狀態切換時光暈擴散一次，200ms；reduced-motion 不動）、之後的結＝空心 `line-strong`。結下方標籤（12px），目前步驟 700。
- 手機：同一條線的精簡版（7 個結，不放標籤），上方一行「目前狀態名稱・第 n / 7 步」。
- 婉拒、取消不顯示 stepper（維持現狀），改顯示「這個合作案已結束」的中性通知。
- 後台 `/admin/collabs/[id]` 共用同一個 Stepper，用語和前台一致（修 m17 的「確認（目前）」）。

### 9.8 骨架

`Skeleton` 元件：`bg-subtle` 的方塊，`animate-pulse`（reduced-motion 時不動）。每個 `<Suspense fallback>` 的骨架要和實際版面同結構（同樣的列數／卡片格、同樣的高度），不再用「載入中…」文字（文字留在 `sr-only`）。殼的 Gate fallback 是頁首骨架＋3 列。

### 9.9 空狀態

`EmptyState`：一條短的 SVG 紅線（未打結）、一句說明、**一個**動作。例：品牌沒有招募「還沒有招募。刊登第一個招募，讓創作者來報名。」＋「刊登招募」；創作者沒有合作「還沒有合作。看看最新的機會。」＋「看機會」。

### 9.10 通知與 toast

- `Notice`（頁內、持續存在）：`tone` = `info`（`subtle`）／`success`（`success-soft`＋`CheckCircle2`）／`warning`（`primary-soft`＋`AlertTriangle`）／`danger`（`danger-soft`＋`AlertCircle`）；有圖示＋文字；錯誤用 `role="alert"`，其他 `role="status"`。
- 不做浮動 toast（Server Action 結果都在動作所在位置就地顯示，螢幕閱讀器與手機都比較可靠）。「已儲存」之類的成功訊息：下次編輯任一欄位或出現錯誤時清掉（修 m11 的殘留）。
- 測試模式（綠界 stage）的提示改成 `info` 而不是紅色錯誤樣式（修 p6）。

### 9.11 確認規則（`ConfirmAction`）

**凡是不可復原、或會讓錢移動的動作，一律頁內確認**（不用 `confirm()`）：

| 動作 | 位置 | 現況 | 本次 |
|---|---|---|---|
| 婉拒報名 | 報名者列表 | 沒有確認（M1） | 加確認 |
| 審核通過 | 合作案（審核中） | 沒有確認（M3） | 加確認：「通過後就不能再要求修改，創作者發佈貼文後平台會撥款。」 |
| 送出貼文連結 | 合作案（待發佈） | 沒有確認 | 加確認：「送出後會進入撥款，連結不能再改。」 |
| 接受邀約／接受條件 | 合作案（邀約中，創作者） | 沒有確認 | 加確認：「接受後品牌就可以付款，付款後只有平台能取消。」 |
| 錄取 | 報名者列表 | 有表單（本身就是確認） | 維持 |
| 取消合作、撤回、退出、關閉招募、刪除草稿、後台各動作 | 各處 | 有確認 | 改用新樣式 |

`ConfirmAction` 新介面：`label`、`message`、`confirmLabel`、`danger?: boolean`（沒有時是主要按鈕樣式，用在審核通過、接受邀約這類不可復原但不是破壞性的動作）、`icon`（`trash`／`x`／`ban`／`leave`／`undo`／`check`／`send`，danger 沒給時用 `x`）、`block`、`onConfirm`。既有呼叫端不用改就能編譯。展開後焦點移到確認區塊的說明文字（`tabIndex={-1}`），Esc 收回並把焦點還給原按鈕。

### 9.12 觸控目標

所有可點的東西 ≥ 44×44px（修 m7）：按鈕、篩選標籤、底部導覽、登出、返回連結、行內文字連結（用 `inline-flex min-h-11 items-center` 或在列表中讓整列可點）、作品的上移／下移／刪除（改成 44px 圖示按鈕）。驗收用 E2E 腳本量測（計畫 Task 14）。

### 9.13 焦點

`globals.css` 的 base：`:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }`，按鈕與連結一致；既有的 `focus-visible:ring-*` 可以留著（兩者同時出現時以 ring 為準，不衝突）。不移除 outline。

### 9.14 找不到頁面與已結束

- `src/app/not-found.tsx`（全站，品牌化）：一條斷掉的 SVG 紅線、「這一頁不存在」、說明、「回首頁」主要按鈕；已登入時另一顆「回後台」。Next 預設英文 404 不再出現（修 m3）。
- 招募已結束：`src/app/creator/briefs/[id]/not-found.tsx`「這則招募已結束或不存在」＋「看其他機會」（`/creator`）。合作案不存在：`src/components/collabs` 所在兩個路由各一個 `not-found.tsx`「找不到這個合作案」＋回列表。
- HTTP 狀態（m1）：cacheComponents 下，`<Suspense>` 內的 `notFound()` 發生在外殼送出之後，狀態碼維持 200（Next 文件 loading.md「Status codes」），但 Next 會插入 `noindex`。本次只在 `proxy.ts` 對**格式不合法**的 `/c/[handle]`（不符合 handle 規則）直接回 404；「格式合法但不存在」需要在 proxy 查資料庫，延後（§15）。

### 9.15 動態元件在深色下的細節

- 圖片底（頭像、作品、封面沒圖時）用 `bg-subtle`；頭像沒上傳時字母頭像用 `bg-subtle text-ink`（不是反白）。
- 遮罩（FilterDrawer backdrop）：`backdrop:bg-bg/70`。
- 選中的篩選標籤維持 `bg-ink text-on-ink`（反白膠囊在深色下是亮底，夠醒目）。

## 10. 體驗改善（QA 前 10 大）

1. **確認規則**：§9.11。
2. **客服入口**（M4）：`src/lib/site.ts` 新增 `SUPPORT_EMAIL` 與 `SUPPORT_LINE_URL`（後者可為 `null`），值是**明顯的佔位**（`support@example.com`，`// TODO(owner)` 註解），README 上線前檢查清單加一條。新頁面 `/help`（公開、靜態）：聯絡方式、常見問題（帳號審核多久、被暫停怎麼辦、金額超過線上付款上限怎麼付、付款後多久撥款）。入口：首頁頁尾、後台側欄底部「需要協助」、手機帳號頁；所有「請聯絡客服／平台」的文字改成帶連結的 `SupportLink`（停權橫幅、金額上限、上傳數量上限、ATM 期間不能退出、線上付款尚未開放）。
3. **金額上限**（M2）：`PAYMENT_MAX_TWD`（200,000）在錄取／邀約表單就檢查：超過時欄位下方出現 `warning` 通知「超過線上付款上限 NT$200,000。建立後無法線上付款，需要由平台協助線下匯款（聯絡我們）。」並多一個必勾的核取方塊「我了解這筆要線下付款」；伺服器端 `validateOffer` 同樣要求（欄位 `offlineAck`）。合作案頁付款區遇到超過上限時，顯示同樣的說明＋聯絡方式，而不是只有錯誤字。
4. **收款帳戶提醒**（m19）：創作者在任何「已付款之後」的合作案（待交稿、審核中、待發佈、撥款處理中）沒有收款帳戶時，行動卡上方顯示 `warning`「還沒有收款帳戶，平台無法撥款給你。」＋「設定收款帳戶」；創作者首頁（機會）頂部也顯示同一個提醒（有任何進行中且已付款的合作案時）。「撥款處理中」的「你不用做任何事」只在有帳戶時顯示。
5. **合併「我的」與「公開頁」編輯**（m11、m12）：`/creator/me` 成為單一頁面，分段：公開頁（顯示名稱、頭像、自我介紹、風格、合作形式＋報價）、作品、帳號（IG、網址代稱、粉絲數、地區、類別）、收款帳戶（連結）、主題、登出。頭像與作品上傳後**立即儲存**（上傳成功＝寫入），文字欄位每段一個「儲存」並顯示「尚未儲存」標記（段落標題旁的點＋文字），離開頁面前有未儲存變更時提示（`beforeunload`）。合作形式與報價放在同一段：勾選合作形式時下方立即出現該形式的報價欄位；報價由資料庫依「已儲存的合作形式」檢查，所以剛勾、還沒存的形式欄位先停用並寫「按上方『儲存』後就能填」，儲存成功後自動啟用並聚焦（不改資料庫的前提下最少的一步）。`/creator/me/profile` 改成導向 `/creator/me#profile`（舊連結不壞）。
6. **手機廣場**（p2、p3、m7）：兩欄緊湊卡；篩選標籤 44px；篩選與排序列 sticky；篩選改成 `pushState`（上一頁逐步退回，p3）。篩選面板「查看 N 位創作者」已有即時計數；每個標籤上的筆數需要新的彙總查詢，延後（§15）。
7. **訊息**（m13、p7）：桌面 Enter 送出、Shift+Enter 換行（觸控裝置 Enter 換行、按鈕送出；以 `matchMedia("(pointer: fine)")` 判斷）；textarea 16px、`maxLength` 不設（中文以 code point 計），計數超過時停用送出；對話標頭 sticky（含返回、對方、合作案膠囊）；列表時間：今天顯示 HH:mm、今年顯示 M/D、更早顯示 YYYY/M/D；合作案都已結束的對話顯示中性提示「合作已結束，訊息仍會保留」。
8. **招募精靈**（m15）：步驟指示器在手機也顯示標籤（四步改成可橫捲的列）、可點擊跳到已到過的步驟（跳到之後的步驟仍要先通過目前步驟的檢查）；「存成草稿」需要至少有案名（前端停用＋伺服器 `validateBrief` 的 draft 模式要求案名）；步驟改用 `pushState`（瀏覽器上一頁回到上一步）；有未儲存變更時離開提示（`beforeunload`）。
9. **付款返回後自動更新**：從綠界回來（`recentCreditPending`）時，頁面每 5 秒 `router.refresh()`，最多 3 分鐘，分頁隱藏時暫停；顯示「正在確認付款…」狀態列與「手動重新整理」按鈕。付款確認後 stepper 的結點亮。
10. **其他一次修掉的**：報名者篩選寫進網址 `?applicants=`（m16）並以 `createdAt`、`id` 穩定排序；機會卡片「已報名 n 人」改「n 人報名」、我的狀態徽章改「你已報名」（m18）；互動率固定一位小數（p1）；交稿檔案的無障礙名稱改成「第 n 次交稿・圖片 1」這類完整說明（p5 的原始檔名需要資料庫存檔名，延後）；驗證碼旁「複製」按鈕（p9）。

## 11. 動態規則

- 唯一的編排時刻：首頁開場「牽線」（約 1.2s）。
- 其他都是回應操作：按鈕按下（`active:scale-[0.98]`，120ms）、確認區塊展開（高度不動畫，內容直接出現；焦點移入）、狀態切換（stepper 結光暈擴散一次 200ms）、訊息送出（新泡泡 120ms 淡入）。
- 不做：區塊 fade-up、卡片 hover 浮起、頁面轉場、視差。
- `prefers-reduced-motion: reduce`：3D 換成靜態 SVG、捲動紅線直接畫滿、`animate-pulse` 停止、所有 transition 時間設 0（`globals.css` 的 media query）。

## 12. 效能預算（首頁，Lighthouse 行動版，`next build && next start`，本機）

- Performance ≥ 90、Accessibility ≥ 95、Best Practices ≥ 95、SEO ≥ 95。
- LCP ≤ 2.5s（LCP 元素是大標文字，不是 canvas）；CLS = 0；TBT ≤ 200ms。
- 首頁首次載入的 JS（不含 three）不比改版前多 30KB gzip 以上；three 的 chunk ≤ ~170KB gzip，且在 `requestIdleCallback`（後備 `setTimeout 200ms`）後才 import。
- 字型：首頁首屏只下載 Manrope（preload）＋用到的 Noto 切片。
- 3D 執行時：桌面 60fps、中階手機 ≥ 45fps；每幀 JS ≤ 4ms（桌面）。

## 13. 無障礙清單

- [ ] 所有文字對比符合 §2.2；UI 元件邊界 ≥ 3:1（`line-strong`）。
- [ ] 焦點框全站可見（§9.13）；Tab 順序合理；「跳到主要內容」。
- [ ] canvas `aria-hidden="true"`、不可聚焦；SVG 後備 `aria-hidden`；首頁的意義全在 HTML 文字裡。
- [ ] 每頁唯一 h1、專屬 `<title>`；`lang="zh-Hant"`。
- [ ] 表單：標籤綁定、錯誤以 `aria-describedby` 連結＋`aria-invalid`、錯誤文字帶圖示。
- [ ] 確認區塊：焦點移入、Esc 收回、焦點歸還。
- [ ] 觸控 ≥ 44px；輸入 16px。
- [ ] 狀態不只靠顏色（徽章文字、錯誤圖示、破壞性按鈕圖示＋動詞）。
- [ ] `prefers-reduced-motion` 全面遵守（§11）。
- [ ] 主題切換控制有可見標籤「主題」；3 個選項都有文字。

## 14. QA 對照（每一條 Major、Minor 的去處）

| QA | 內容 | 處理 | 計畫 Task |
|---|---|---|---|
| M1 | 婉拒報名沒有確認 | §9.11 | 8 |
| M2 | 金額超過上限的死路 | §10.3 | 10 |
| M3 | 審核通過沒有確認 | §9.11 | 10 |
| M4 | 沒有客服管道 | §10.2 | 2（設定與 /help）、3（側欄入口）、9（停權橫幅）、10（付款） |
| m1 | 找不到創作者回 200 | 格式不合法回 404；其餘延後（§15） | 7 |
| m2 | 全站 title 相同 | §9.2 | 3 |
| m3 | 英文預設 404、已結束招募 | §9.14 | 2、9、10 |
| m4 | 已登入仍可進 /login 等；首頁不辨識登入 | §7、§5.1 | 3、4 |
| m5 | 「Google（尚未設定）」與 dev 按鈕；OTP 信件主旨 | Google 按鈕未設定時隱藏；dev 按鈕手機版修排版；**OTP 主旨延後**（Supabase 信件範本在 `supabase/config.toml`／正式專案後台，不是 UI，§15） | 6 |
| m6 | 原生英文驗證訊息 | §9.5 | 2、6、9 |
| m7 | 觸控 < 44px | §9.12 | 2、3、8、9、14 |
| m8 | 輸入 < 16px | §9.5 | 2、11 |
| m9 | success 對比不足 | §2.1 | 1 |
| m10 | 原生檔案欄位 | §9.5 `FilePicker` | 2、6、8、9、10 |
| m11 | 上傳後還要再按儲存；「已儲存」殘留 | §10.5、§9.10 | 9 |
| m12 | 報價要先存合作形式；帳號／公開頁拆兩頁 | §10.5 | 9 |
| m13 | Enter、字數、sticky、日期、停權公開頁連結 | §10.7；停權創作者不顯示「查看公開頁」 | 11 |
| m14 | （QA 報告沒有這個編號） | — | — |
| m15 | 招募精靈 | §10.8 | 8 |
| m16 | 報名者篩選不寫網址、排序不穩 | §10.10 | 8 |
| m17 | 後台 stepper 用語、已取消仍顯示補登、人工付款沒有金額核對、申請時間 | stepper 共用（§9.7）；已取消（`cancelled`／`declined`／`completed`）隱藏補登；人工標記已付款多一個「核對金額」欄位，必須等於報價才能送出（前端檢查，伺服器端 `admin_record_*` 不變）；**申請時間**需要 SQL 回傳最近送審時間，延後（§15） | 12 |
| m18 | 「已報名」文案重複 | §10.10 | 9 |
| m19 | 沒有收款帳戶的提醒 | §10.4 | 9、10 |

Polish：p1、p2、p3（pushState）、p4、p5（只做無障礙名稱）、p6、p7、p9、p10、p12 在本次處理（對應 §10、§9）；p8（Next Activity 保留隱藏的 `<main>`）是框架行為，E2E 改用 `:visible`；p11（Logo 預覽／裁切）延後。

## 15. 不在範圍內

- 「格式合法但不存在」的創作者頁回真正的 404（需要 proxy 查資料庫；目前已有 `noindex`）。
- 篩選標籤上的個別筆數（需要新的彙總 SQL）。
- 後台「申請時間」改成最近送審時間（需要 SQL 欄位）。
- OTP 信件主旨依登入／註冊區分（Supabase 信件範本設定，不是 App UI）。
- 交稿檔案顯示原始檔名（p5 後半；路徑是 UUID，需要資料庫存檔名）。
- Logo／頭像裁切（p11）、批次操作與鍵盤快捷、SLA 顯示、稽核紀錄頁面（QA 後台建議）。
- 訪客可瀏覽的公開廣場、範例創作者區塊（需要決定公開哪些資料）。
- 浮動 toast、頁面轉場動畫、PWA、多語系。
- 任何資料庫 migration、RLS、付款流程本身的改動。
- 真正的客服信箱與 LINE（擁有者提供後只改 `src/lib/site.ts`）。

## 16. 代替擁有者做的決定

1. 深色主題的主要按鈕紅用 `#D9392F`（方向稿 `#F0483E` 只留給 3D 與裝飾線），因為白字在 `#F0483E` 上只有 3.68:1。
2. 新增 `subtle`、`line-strong`、`accent`、`thread`、`danger-soft`、`focus` 等 token；`primary-soft` 只保留紅線語意。
3. 主題切換用原生 `<select>`（不是自製選單）。
4. 破壞性按鈕＝描邊＋圖示＋動詞；主要按鈕＝實心紅、無圖示。
5. 不做浮動 toast。
6. 公開頁的 3D ribbon 只在桌面；手機一律 SVG。
7. 「接受邀約」「送出貼文連結」也加確認（QA 只點名婉拒與審核通過）。
8. 金額超過上限不擋，但要勾選「我了解這筆要線下付款」。
9. 創作者「我的」合併成單頁，頭像與作品上傳即儲存。
10. 首頁大標預設 A「把對的品牌，牽到對的創作者。」，可在 `site.ts` 一行替換。
