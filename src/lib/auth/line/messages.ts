// LINE 登入的錯誤代碼與畫面文字（/login?error=line_…）。只認得白名單內的代碼。

export const LINE_ERRORS = {
  line_unavailable: "LINE 登入目前無法使用，請先改用 Email 驗證碼登入。",
  line_cancelled: "你取消了 LINE 登入。可以再試一次，或改用 Email 驗證碼登入。",
  line_state: "LINE 登入逾時或已經完成過了，請重新按一次「使用 LINE 登入」。",
  line_failed: "LINE 登入沒有完成，請再試一次，或改用 Email 驗證碼登入。",
  line_no_email: "LINE 沒有提供 Email。請在 LINE 的授權畫面允許提供 Email，或改用 Email 驗證碼登入。",
  line_otp_rate: "驗證碼寄送太頻繁，請稍等一分鐘再用 LINE 登入。",
} as const;

export type LineErrorCode = keyof typeof LINE_ERRORS;

export function isLineErrorCode(v: unknown): v is LineErrorCode {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(LINE_ERRORS, v);
}

export function lineErrorMessage(v: unknown): string | null {
  return isLineErrorCode(v) ? LINE_ERRORS[v] : null;
}

/** /login?line=existing|new：LINE 登入後要用 Email 驗證碼確認，畫面上的說明。 */
export const LINE_LINK_NOTICE = {
  existing: "這個 Email 已經有 Kollink 帳號。輸入我們寄到你信箱的驗證碼，就會把 LINE 綁定到這個帳號。",
  new: "為了確認 LINE 提供的 Email 是你的，我們寄了一組驗證碼到你的信箱。輸入後就會完成註冊，之後用 LINE 就能直接登入。",
} as const;

export type LineLinkKind = keyof typeof LINE_LINK_NOTICE;

export function isLineLinkKind(v: unknown): v is LineLinkKind {
  return v === "existing" || v === "new";
}

/** 綁定 API（POST /auth/line/link）回給畫面的錯誤 */
export const LINE_LINK_ERRORS = {
  code: "驗證碼錯誤或已過期，請重新取得",
  format: "請輸入信件裡的 6 到 8 位數驗證碼",
  expired: "確認時間已過，請重新用 LINE 登入",
  rate: "寄送太頻繁，請稍後再試",
  failed: "沒有完成，請再試一次",
} as const;

export type LineLinkError = keyof typeof LINE_LINK_ERRORS;
