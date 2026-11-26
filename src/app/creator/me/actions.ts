"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { mapAccountError, type FormState } from "@/lib/auth/account-errors";
import { validateCreatorInput } from "@/lib/validation/onboarding";
import { parseCreatorForm } from "@/lib/validation/form-data";

export async function updateCreatorAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("creator");
  if (!me.creator) return { formError: "找不到創作者資料，請重新登入" };
  const input = parseCreatorForm(fd);
  // handle 鎖定後表單不送 handle（readOnly），沿用原本的值；鎖定以資料庫的 handle_locked_at 為準
  if (me.creator.handleLocked) input.handle = me.creator.handle;
  const values = { ...input };
  const fieldErrors = validateCreatorInput(input);
  if (fieldErrors) return { fieldErrors, values };

  const supabase = await createClient();
  // 修改只能走 definer 函式：handle 審核通過後由資料庫鎖定，display_name 同一個 transaction 同步
  const { data: newCode, error } = await supabase.rpc("update_creator_account", {
    p_display_name: input.displayName,
    p_handle: input.handle,
    p_ig_username: input.igUsername,
    p_follower_count: Number(input.followerCount),
    p_region: input.region,
    p_categories: input.categories,
  });
  if (error) {
    const mapped = mapAccountError(error);
    return { ...(mapped.kind === "state" ? mapped.state : { formError: "發生錯誤，請稍後再試" }), values };
  }
  revalidatePath("/creator", "layout");
  // 回傳驗證碼代表更換了 IG 帳號，狀態已退回審核中（頁面頂端的 StatusBanner 會顯示新驗證碼）
  if (!newCode) return { ok: true };
  return {
    ok: true,
    notice: me.creator.status === "suspended"
      ? "已更換 IG 帳號。帳號目前暫停中，請聯絡客服"
      : "你更換了 IG 帳號，需要重新審核；新的驗證碼已顯示在頁面上方",
  };
}

/** 被退回後重新送審（rejected → pending，計畫 9）。 */
export async function requestReviewAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole("creator");
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_creator_review");
  if (error) {
    return { ok: false, error: error.message === "creator status changed" ? "狀態已經更新，請重新整理" : "發生錯誤，請稍後再試" };
  }
  revalidatePath("/creator", "layout");
  return { ok: true };
}
