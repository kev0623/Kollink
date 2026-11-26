> 視覺已由 2026-11-27-ui-upgrade-design.md 取代（本文件只保留歷史）。

# UI 改版設計（參考 tools.mixxin.tw 的風格）

使用者決定：計畫 3 之前先把現有頁面全部換成新風格；手機版改用底部導覽列，桌面版用左側直排導覽。

只沿用視覺風格。不可使用 MIXXIN 的 logo、名稱或任何品牌素材，因為 Kollink 是獨立產品。

## 設計 token（`src/app/globals.css` 的 `@theme`）

| token | 值 | 用途 |
|---|---|---|
| `--color-bg` | `#F3F3F2` | 頁面背景（暖灰） |
| `--color-panel` | `#EEEEEC` | 主內容區背景（桌面版側邊導覽右邊那一大塊） |
| `--color-surface` | `#FFFFFF` | 卡片 |
| `--color-line` | `#E4E4E7` | 邊框（1px） |
| `--color-ink` | `#18181B` | 主要文字、主要按鈕、選中狀態 |
| `--color-muted` | `#71717A` | 次要文字（在白底與 `#F3F3F2` 上對比度要 ≥ 4.5:1） |
| `--color-on-ink` | `#FFFFFF` | 黑底上的文字（取代目前的 `text-white`） |
| `--color-primary` | `#18181B` | 主要按鈕或強調。改成黑色，跟參考站一致 |
| `--color-primary-soft` | `#F4F4F5` | 淡色強調底 |
| `--color-success` | `#3E8E6A` | 保留 |
| `--color-success-soft` | `#E6F2EC` | 保留 |
| `--color-danger` | `#DC2626` | 錯誤文字（新增；目前錯誤文字若用了 primary，要改用這個） |
| `--radius-card` | `32px` | 大卡片 |
| `--radius-btn` | `9999px` | 按鈕、膠囊標籤 |
| `--radius-nav` | `24px` | 導覽項目 |
| `--radius-input` | `12px` | 輸入框、下拉選單 |

字體：`next/font/google` 載入 Rubik（400/500/600/700）和 Noto Sans TC。`--font-sans` 為 `Rubik, Noto Sans TC, system-ui, sans-serif`，英數用 Rubik，中文退回 Noto Sans TC。

## 元件與版面

- **頁面標題**：32px、粗體 700、`text-ink`。
- **卡片**：白底，1px `border-line`，`rounded-card`，不加陰影，內距 32px（手機 20px）。
- **主要按鈕**：`bg-ink`、`text-on-ink`、`rounded-btn`、高 44px、字重 600。**次要按鈕**：白底、1px `border-line`、`text-ink`。
- **膠囊標籤**（例如審核狀態、角色）：`bg-ink text-on-ink`、12px、字重 500、全圓角；淡色版是 `bg-primary-soft text-ink`。
- **輸入框**：白底、1px `border-line`、`rounded-input`、focus 時 2px `ring-ink`。
- **登入後的外框**（`brand/layout.tsx`、`creator/layout.tsx`、`onboarding/layout.tsx` 與 `components/shell/*`）：
  - 桌面（`md` 以上）：左側 96px 寬的直排導覽，背景 `bg`。最上方是 Kollink 字標或簡單圖形（不要用 MIXXIN logo）。每個項目是圖示在上、12px 文字在下，選中時是 64×60 的 `bg-ink` 膠囊，圖示和文字為白色；未選中是 `text-ink`，hover 時淡灰底。底部放頭像（48px 圓形，取名字第一個字）、角色膠囊、登出。右側主內容區用 `bg-panel`，內距 `32px 28px 32px 32px`，頁面標題在左上。
  - 手機（`md` 以下）：沒有側邊欄，改用底部固定導覽列（沿用 `BottomTabBar`，要保留 `env(safe-area-inset-bottom)`）。導覽列白底、上方 1px `border-line`，選中的項目是黑色膠囊。
- **未登入的頁面**（首頁、`/login`、`/signup`）：背景 `bg`，內容放在置中的白色大圓角卡片；首頁的 hero 用黑白配色，按鈕用新的主要和次要樣式。
- 圖示：專案若已有圖示套件就沿用；沒有的話用 `lucide-react`，線條粗細 1.5。

## 不在範圍內

- 不改任何資料流程、server action、文案內容、路由。
- 暗色模式這次不做（參考站有，之後再說）。

## 驗收

- `npm run lint`、`npx tsc --noEmit`、`npm test`、`npm run build` 全部通過。
- 桌面寬度 1280 和手機寬度 390 各截圖，涵蓋首頁、`/login`、`/signup`、onboarding（品牌、創作者）、`/brand`、`/creator`、`/creator/me`、`/brand/settings`。外觀要符合上面的規格，手機版不能出現水平捲軸。
- 原始碼不可再出現 `text-white`（改用 `text-on-ink`），也不可出現已刪除的舊色碼（`#E8684A`、`#FBF7F2` 等）。
