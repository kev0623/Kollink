"use client";

import { useLinkStatus } from "next/link";

/**
 * 放在 <Link> 裡面：點下去到新內容出現之前，輸出一個看不見的標記（螢幕報讀器會讀「載入中」）。
 * 外層用 has-[[data-pending]]: 變化樣式（styles.ts 的 chip、Pagination 已經加了），不佔位置、版面不跳動。
 * 篩選與分頁現在是伺服器換頁，沒有這個回饋的話按下去會像沒反應。
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <span data-pending role="status" className="sr-only">載入中</span> : null;
}
