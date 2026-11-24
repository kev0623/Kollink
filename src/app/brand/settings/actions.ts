"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { mapAccountError, type FormState } from "@/lib/auth/account-errors";
import { validateBrandInput } from "@/lib/validation/onboarding";
import { parseBrandForm } from "@/lib/validation/form-data";

export async function updateBrandAction(_prev: FormState, fd: FormData): Promise<FormState> {
  // 未登入或角色不符會直接導向登入頁或自己的首頁（redirect 會中斷這個函式）
  await requireRole("brand");
  const input = parseBrandForm(fd);
  const values = { ...input, logoPath: input.logoPath ?? "" };
  const fieldErrors = validateBrandInput(input);
  if (fieldErrors) return { fieldErrors, values };

  const supabase = await createClient();
  // 修改只能走 definer 函式（同一個 transaction 同步 profiles.display_name）；資料表沒有直接 UPDATE 權限
  // p_logo_path 是必填參數，null 代表移除 Logo（產生的型別寫成 string，所以要轉型）
  const { error } = await supabase.rpc("update_brand_account", {
    p_brand_name: input.brandName,
    p_industry: input.industry,
    p_logo_path: input.logoPath as string,
  });
  if (error) {
    const mapped = mapAccountError(error);
    return { ...(mapped.kind === "state" ? mapped.state : { formError: "發生錯誤，請稍後再試" }), values };
  }
  revalidatePath("/brand", "layout");
  return { ok: true };
}
