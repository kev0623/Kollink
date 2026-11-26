/** 從綠界付款頁回來後，每 5 秒重新整理一次合作案，最多 3 分鐘（綠界通知通常幾秒到幾分鐘）。 */
export const POLL_INTERVAL_MS = 5000;
export const POLL_MAX_ATTEMPTS = 36;

export function nextPollDelay(attempt: number): number | null {
  return attempt < POLL_MAX_ATTEMPTS ? POLL_INTERVAL_MS : null;
}
