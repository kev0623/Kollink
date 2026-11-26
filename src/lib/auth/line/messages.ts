// LINE 登入的錯誤代碼與畫面文字（/login?error=line_…）。只認得白名單內的代碼。

export const LINE_ERRORS = {
  line_unavailable: "LINE 登入目前無法使用，請先改用 Email 驗證碼登入。",
  line_cancelled: "你取消了 LINE 登入。可以再試一次，或改用 Email 驗證碼登入。",
  line_state: "LINE 登入逾時或已經完成過了，請重新按一次「使用 LINE 登入」。",
  line_failed: "LINE 登入沒有完成，請再試一次，或改用 Email 驗證碼登入。",
  line_no_email: "LINE 沒有提供 Email。請在 LINE 的授權畫面允許提供 Email，或改用 Email 驗證碼登入。",
} as const;

export type LineErrorCode = keyof typeof LINE_ERRORS;

export function isLineErrorCode(v: unknown): v is LineErrorCode {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(LINE_ERRORS, v);
}

export function lineErrorMessage(v: unknown): string | null {
  return isLineErrorCode(v) ? LINE_ERRORS[v] : null;
}

/** /login?line=verify：LINE 登入後要先用寄到 LINE Email 的驗證碼確認。新帳號與既有帳號用同一段文字（不透露帳號是否存在）。 */
export function lineVerifyNotice(email: string): string {
  return `我們寄了一組驗證碼到 LINE 提供的 Email（${email}）。輸入後就完成登入，並把 LINE 綁定到這個帳號。`;
}

/** 驗證碼畫面上「要綁定的 LINE 帳號」；沒有名稱時不顯示。 */
export function lineAccountLabel(name: string | null): string | null {
  return name ? `要綁定的 LINE 帳號：${name}` : null;
}

export function isLineVerifyState(v: unknown): v is "verify" {
  return v === "verify";
}

/** 驗證碼步驟（瀏覽器）與綁定 API（POST /auth/line/link）的錯誤 */
export const LINE_LINK_ERRORS = {
  code: "驗證碼錯誤或已過期，請重新取得",
  format: "請輸入信件裡的 6 到 8 位數驗證碼",
  expired: "確認時間已過，請重新用 LINE 登入",
  send: "無法寄出驗證碼，請稍後再試，或改用 Email 驗證碼登入",
  mismatch: "登入的帳號和 LINE 提供的 Email 不一致，已登出。請重新用 LINE 登入",
  failed: "沒有完成，請再試一次",
  bind: "你已經登入了，但 LINE 還沒有綁定；下次用 LINE 登入時會再試一次。",
} as const;

export type LineLinkError = keyof typeof LINE_LINK_ERRORS;

export function isLineLinkError(v: unknown): v is LineLinkError {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(LINE_LINK_ERRORS, v);
}
