export const SITE_NAME = "Kollink";
export const SITE_TAGLINE = "台灣品牌 × 創作者合作平台";

/** 首頁大標（規格 §5.2；B「一條紅線，從品牌牽到創作者。」、C「好的合作，從牽對線開始。」） */
export const HERO_HEADLINE = "把對的品牌，牽到對的創作者。";

// ─────────────────────────────────────────────────────────────
// TODO(owner)：上線前改成真實的客服信箱與 LINE 官方帳號網址（README「上線前檢查」）。
// 目前是佔位值：example.com 是保留網域，寄不出去。LINE 沒有就保持 null（畫面不顯示）。
export const SUPPORT_EMAIL = "support@example.com";
export const SUPPORT_LINE_URL: string | null = null;
// ─────────────────────────────────────────────────────────────

export const SUPPORT_PAGE = "/help";

/** 寄信連結；subject 會帶進信件主旨（例如「帳號暫停」）。 */
export function supportMailto(subject?: string): string {
  return subject ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[${SITE_NAME}] ${subject}`)}` : `mailto:${SUPPORT_EMAIL}`;
}

/** 客服信箱是否還是佔位值（/help 與 README 用；正式上線前必須為 false）。 */
export function isSupportPlaceholder(): boolean {
  return SUPPORT_EMAIL.endsWith("@example.com");
}
