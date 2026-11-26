const nf = new Intl.NumberFormat("en-US");

export function formatNumber(n: number): string {
  return nf.format(n);
}

export function formatTwd(n: number): string {
  return `NT$${nf.format(n)}`;
}

/** 互動率；沒填顯示「—」。固定一位小數（QA p1）。 */
export function formatPercent(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}%`;
}

/** 頭像沒上傳時顯示名字第一個字（以 code point 計算，避免拆壞 emoji）。 */
export function initialOf(name: string): string {
  return Array.from(name.trim())[0] ?? "?";
}
