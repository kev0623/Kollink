import { ADMIN_STALE_MESSAGE } from "@/lib/admin/errors";
import { COLLAB_STALE_MESSAGE } from "@/lib/collabs/errors";

// 招募相關 definer 函式的錯誤（supabase/migrations/20261124000500_briefs.sql）→ 畫面文字。
type DbError = { code?: string; message?: string };

const MESSAGES: Record<string, string> = {
  "not authenticated": "登入已逾時，請重新登入",
  "not a brand": "這個帳號不是品牌，無法執行此操作",
  "not a creator": "這個帳號不是創作者，無法執行此操作",
  "creator not approved": "審核通過後即可報名",
  "not brief owner": "找不到這則招募",
  "brief not found": "找不到這則招募",
  "brief not editable": "這則招募已結束，不能再修改",
  "brief not open": "這則招募已經不是發佈中",
  "brief not draft": "只有草稿可以刪除",
  "brief closed": "這則招募已結束，無法報名",
  "already applied": "你已經報名過這則招募",
  "application not found": "找不到這筆報名",
  "application not pending": "這筆報名已經處理過了",
};

const FIELD_BY_DB: Record<string, string> = {
  title: "title",
  description: "description",
  collab_types: "collabTypes",
  categories: "categories",
  region: "region",
  min_followers: "minFollowers",
  budget_min_twd: "budgetMin",
  budget_max_twd: "budgetMax",
  reward: "reward",
  deadline: "deadline",
  cover_path: "coverPath",
  message: "message",
  proposed_price_twd: "proposedPrice",
};

const FIELD_MESSAGE: Record<string, string> = {
  reward: "預算和產品至少要有一項",
  deadline: "截止日要在今天到 90 天內",
};

export function briefErrorMessage(error: DbError): string {
  const m = error.message ?? "";
  return Object.hasOwn(MESSAGES, m) ? MESSAGES[m] : "發生錯誤，請稍後再試";
}

/** 22023 invalid <欄位> → 表單欄位錯誤；其他錯誤回傳 null。 */
export function briefFieldError(error: DbError): Record<string, string> | null {
  if (error.code !== "22023") return null;
  const key = (error.message ?? "").replace(/^invalid /, "");
  if (!Object.hasOwn(FIELD_BY_DB, key)) return null;
  const field = FIELD_BY_DB[key];
  return { [field]: Object.hasOwn(FIELD_MESSAGE, field) ? FIELD_MESSAGE[field] : "格式不正確" };
}

/** 連點或另一個分頁已處理過：狀態已經變了，畫面重新整理即可，不必當成錯誤。 */
export function isStaleStateMessage(message: string): boolean {
  return message === MESSAGES["brief not open"] || message === MESSAGES["application not pending"]
    || message === COLLAB_STALE_MESSAGE || message === ADMIN_STALE_MESSAGE;
}
