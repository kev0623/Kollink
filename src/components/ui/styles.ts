// 共用 class（server 與 client 元件都能 import）。規格 §9。
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-btn font-bold transition-colors active:scale-[0.98] " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export const btn = {
  /** 每頁唯一的主要動作：實心紅、無圖示 */
  primary: `${btnBase} h-11 px-6 bg-primary text-on-primary hover:bg-primary-hover`,
  /** 首頁入口等大按鈕 */
  primaryLg: `${btnBase} h-[52px] px-7 text-base bg-primary text-on-primary hover:bg-primary-hover`,
  secondary: `${btnBase} h-11 px-5 border border-line-strong bg-surface text-ink hover:bg-subtle`,
  secondaryLg: `${btnBase} h-[52px] px-7 text-base border border-line-strong bg-transparent text-ink hover:bg-subtle`,
  ghost: `${btnBase} h-11 px-4 text-ink hover:bg-subtle`,
  /** 破壞性動作的第一顆按鈕：描邊＋圖示＋動詞（一定接 ConfirmAction） */
  danger: `${btnBase} h-11 px-5 border border-danger bg-transparent text-danger hover:bg-danger-soft`,
  /** 確認區塊裡的「確定…」 */
  dangerConfirm: `${btnBase} h-11 px-5 border border-danger bg-danger-soft text-danger hover:bg-danger-soft/70`,
  /** 44×44 的圖示按鈕（記得加 aria-label 或 sr-only 文字） */
  icon: "inline-flex h-11 w-11 items-center justify-center rounded-btn text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50",
} as const;

export const input =
  "h-11 w-full min-w-0 rounded-input border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-muted " +
  "outline-none focus-visible:ring-2 focus-visible:ring-focus aria-[invalid=true]:border-danger disabled:opacity-60";

export const textarea =
  "block w-full min-w-0 rounded-input border border-line-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-muted " +
  "outline-none focus-visible:ring-2 focus-visible:ring-focus aria-[invalid=true]:border-danger disabled:opacity-60";

export const card = "rounded-card border border-line bg-surface";
export const cardPad = "rounded-card border border-line bg-surface p-5 md:p-8";
/** 列表外框：裡面的每列用 row */
export const rows = "divide-y divide-line overflow-hidden rounded-card border border-line bg-surface";
export const row = "block min-h-11 px-4 py-3 hover:bg-subtle md:px-5 md:py-4";

/** 篩選標籤（44px）；選中時反白膠囊 */
export function chip(active: boolean): string {
  return `inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-btn border px-4 text-sm font-semibold ${
    active ? "border-ink bg-ink text-on-ink" : "border-line-strong bg-surface text-ink hover:bg-subtle"
  }`;
}

/** 頁面標題（serif） */
export const h1 = "font-serif text-[28px] font-bold leading-tight text-ink";
export const h2 = "text-lg font-bold text-ink";
/** 行內文字連結（加大點擊範圍） */
export const textLink = "inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4 hover:text-accent";
