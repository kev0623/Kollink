// 寄 Email 驗證碼失敗時要顯示什麼。重點是讓使用者知道「是不是我的問題」以及「現在可以怎麼做」。

export type OtpSendFailure = "rate" | "mail-down" | "rejected" | "network";

type AuthErrorLike = { status?: number; code?: string; message?: string; name?: string };

/**
 * 分類 Supabase signInWithOtp 的錯誤：
 * rate：寄太頻繁（429）；mail-down：寄信服務出錯（5xx，例如 "Error sending confirmation email"）——不是使用者的問題；
 * network：連不到伺服器（沒有 status）；rejected：其他（多半是 Email 不被接受）。
 */
export function classifyOtpSendError(e: AuthErrorLike | null | undefined): OtpSendFailure | null {
  if (!e) return null;
  const status = typeof e.status === "number" ? e.status : 0;
  const code = e.code ?? "";
  if (status === 429 || code.startsWith("over_")) return "rate";
  if (status >= 500 || code === "unexpected_failure" || /error sending/i.test(e.message ?? "")) return "mail-down";
  if (status === 0 || e.name === "AuthRetryableFetchError") return "network";
  return "rejected";
}

export type SocialOptions = { google: boolean; line: boolean };

function socialNames(s: SocialOptions): string | null {
  if (s.google && s.line) return "LINE 或 Google";
  if (s.google) return "Google";
  if (s.line) return "LINE";
  return null;
}

/** 登入／註冊表單（上方有社群登入按鈕）。 */
export function otpSendErrorMessage(kind: OtpSendFailure, social: SocialOptions): string {
  const names = socialNames(social);
  switch (kind) {
    case "rate":
      return "剛剛已經寄過驗證碼，請先查看信箱（含垃圾信件匣），一分鐘後可以再寄。";
    case "mail-down":
      return names
        ? `驗證碼信件目前寄不出去，不是你的 Email 有問題。請改用上方的 ${names} 登入，或稍後再試。`
        : "驗證碼信件目前寄不出去，不是你的 Email 有問題。請稍後再試。";
    case "network":
      return "連不上伺服器，請確認網路連線後再試一次。";
    case "rejected":
      return "這個 Email 無法寄送驗證碼，請確認有沒有打錯，或換一個信箱。";
  }
}

/** LINE 登入後確認 Email 的步驟：這裡不能改用別的 Email，出路是稍後再試，或取消後改用 Google。 */
export function lineLinkSendErrorMessage(kind: OtpSendFailure, googleEnabled: boolean): string {
  switch (kind) {
    case "mail-down":
      return googleEnabled
        ? "驗證碼信件目前寄不出去，不是你的問題。請稍後再試；想現在就登入的話，可以取消後改用 Google。"
        : "驗證碼信件目前寄不出去，不是你的問題。請稍後再試。";
    case "network":
      return "連不上伺服器，請確認網路連線後再試一次。";
    default:
      return "無法寄出驗證碼，請稍後再試，或取消後改用其他方式登入。";
  }
}
