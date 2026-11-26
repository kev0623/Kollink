/**
 * 本機測試快速登入的唯一開關：只有「開發模式」且「Supabase 指向本機」才會開。
 * 正式環境（NODE_ENV=production）或連到雲端專案時一律關閉。
 */
export function isDevLoginEnabled(
  env: { NODE_ENV?: string; NEXT_PUBLIC_SUPABASE_URL?: string } = process.env,
): boolean {
  if (env.NODE_ENV !== "development") return false;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

export const DEV_ACCOUNTS = {
  brand: "dev-brand@kollink.test",
  creator: "dev-creator@kollink.test",
  // 計畫 9：管理員（沒有 profile，只在 admins 表）
  admin: "dev-admin@kollink.test",
} as const;

export type DevAccount = keyof typeof DEV_ACCOUNTS;

export function isDevAccount(v: unknown): v is DevAccount {
  return v === "brand" || v === "creator" || v === "admin";
}
