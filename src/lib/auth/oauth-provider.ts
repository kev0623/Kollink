// 社群登入前先問 Supabase Auth 這個登入方式有沒有開。
// 沒開時 signInWithOAuth 仍會把瀏覽器導到 Supabase，畫面只剩一段 JSON 錯誤（"provider is not enabled"）；
// 例如 Vercel 已設 NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true，但 Supabase 後台還沒開 Google。先檢查就能留在登入頁顯示友善的訊息。

export type ProviderStatus = "enabled" | "disabled" | "unknown";

/** 解析 GET /auth/v1/settings 的回應：external[provider] 明確是 false 才算「沒開」；格式不對一律 unknown（不擋登入）。 */
export function providerStatusFromSettings(settings: unknown, provider: string): ProviderStatus {
  if (!settings || typeof settings !== "object") return "unknown";
  const external = (settings as { external?: unknown }).external;
  if (!external || typeof external !== "object") return "unknown";
  const value = (external as Record<string, unknown>)[provider];
  if (value === true) return "enabled";
  if (value === false) return "disabled";
  return "unknown";
}

/** 查詢失敗（網路、逾時、非 200）回 unknown：照常導去登入，由回呼處理錯誤，不因為檢查失敗就擋住使用者。 */
export async function fetchProviderStatus(
  supabaseUrl: string,
  publishableKey: string,
  provider: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 4000,
): Promise<ProviderStatus> {
  try {
    const res = await fetchImpl(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/settings`, {
      headers: { apikey: publishableKey },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return "unknown";
    return providerStatusFromSettings(await res.json(), provider);
  } catch {
    return "unknown";
  }
}
