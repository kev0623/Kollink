/** 送出失敗時回傳使用者填的值，讓表單在 React 重設後仍能還原。 */
export type FormValues = Record<string, string | string[]>;

export type FormState = {
  fieldErrors?: Record<string, string>;
  formError?: string;
  ok?: boolean;
  notice?: string;
  values?: FormValues;
};

const FIELD_BY_DB: Record<string, string> = {
  brand_name: "brandName",
  industry: "industry",
  logo_path: "logoPath",
  display_name: "displayName",
  handle: "handle",
  ig_username: "igUsername",
  follower_count: "followerCount",
  region: "region",
  categories: "categories",
};

/** 把建立 / 更新帳號時的資料庫錯誤轉成表單錯誤。 */
export function mapAccountError(error: { code?: string; message?: string }):
  | { kind: "exists" }
  | { kind: "state"; state: FormState } {
  const message = error.message ?? "";
  if (error.code === "23505") {
    if (message === "account already exists") return { kind: "exists" };
    if (message === "handle taken" || message.includes("creator_profiles_handle_key")) {
      return { kind: "state", state: { fieldErrors: { handle: "這個網址已經有人使用" } } };
    }
  }
  if (error.code === "42501" && message === "handle locked after approval") {
    return { kind: "state", state: { fieldErrors: { handle: "審核通過後不能修改網址" } } };
  }
  if (error.code === "42501" && message === "not authenticated") {
    return { kind: "state", state: { formError: "登入已逾時，請重新登入" } };
  }
  if (error.code === "42501" && message === "not a brand") {
    return { kind: "state", state: { formError: "這個帳號不是品牌，無法執行此操作" } };
  }
  if (error.code === "42501" && message === "not a creator") {
    return { kind: "state", state: { formError: "這個帳號不是創作者，無法執行此操作" } };
  }
  if (error.code === "22023") {
    const key = message.replace(/^invalid /, "");
    const field = Object.hasOwn(FIELD_BY_DB, key) ? FIELD_BY_DB[key] : undefined;
    if (field) return { kind: "state", state: { fieldErrors: { [field]: "格式不正確" } } };
  }
  if (error.code === "23514") {
    return { kind: "state", state: { formError: "資料格式不正確，請檢查後再送出" } };
  }
  return { kind: "state", state: { formError: "發生錯誤，請稍後再試" } };
}
