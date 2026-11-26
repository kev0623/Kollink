/**
 * 驗證碼輸入（Email OTP 與管理員 TOTP 共用）。
 * Email OTP 的長度由 Supabase 後台設定（本機 6 碼，正式環境預計改 8 碼），所以接受 6 到 8 位數；TOTP 固定 6 位。
 */
export const OTP_MIN_LENGTH = 6;
export const OTP_MAX_LENGTH = 8;

/** 全形數字轉半形，只留數字，最多 maxLength 碼。 */
export function toOtpCode(v: string, maxLength: number = OTP_MAX_LENGTH): string {
  return v
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\D/g, "")
    .slice(0, maxLength);
}

export function isValidOtpCode(v: string, min: number = OTP_MIN_LENGTH, max: number = OTP_MAX_LENGTH): boolean {
  return new RegExp(`^\\d{${min},${max}}$`).test(v);
}
