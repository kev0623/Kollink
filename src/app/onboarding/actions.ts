"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mapAccountError, type FormState } from "@/lib/auth/account-errors";
import { HANDLE_RE, cleanText, validateBrandInput, validateCreatorInput } from "@/lib/validation/onboarding";
import { afterOnboardingPath, onboardingPath } from "@/lib/auth/post-login";
import { parseBrandForm, parseCreatorForm, parseRatesForm } from "@/lib/validation/form-data";
import { validateRates } from "@/lib/validation/creator-profile";
import { COLLAB_TYPES } from "@/lib/options";
import { getCurrentUser } from "@/lib/auth/current-user";

/** 表單帶著的「填完要回去的頁面」。不信任內容：由 afterOnboardingPath／onboardingPath 檢查。 */
function nextOf(fd: FormData): string | null {
  const v = fd.get("next");
  return typeof v === "string" && v ? v : null;
}

export async function createBrandAccountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const input = parseBrandForm(fd);
  const values = { ...input, logoPath: input.logoPath ?? "" };
  const fieldErrors = validateBrandInput(input);
  if (fieldErrors) return { fieldErrors, values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_brand_account", {
    p_brand_name: input.brandName,
    p_industry: input.industry,
    p_logo_path: input.logoPath ?? undefined,
  });
  if (error) {
    const mapped = mapAccountError(error);
    // 帳號已存在：回到 /onboarding，由 layout 依實際身分導向
    if (mapped.kind === "exists") redirect(onboardingPath(null, nextOf(fd)));
    return { ...mapped.state, values };
  }
  redirect(afterOnboardingPath("brand", nextOf(fd)));
}

/** 創作者註冊完成後的說明頁（審核中、接下來要做什麼）。 */
const CREATOR_WELCOME = "/creator/welcome";

/** 註冊第一步：公開頁網址能不能用。只是提示，真正的唯一性在送出時由資料庫決定。 */
export async function checkHandleAction(raw: string): Promise<{ ok: true; handle: string } | { error: string }> {
  const handle = cleanText(typeof raw === "string" ? raw : "");
  if (!HANDLE_RE.test(handle)) return { error: "網址只能用小寫英文、數字、底線和點，3–30 字" };
  if (!(await getCurrentUser())) return { error: "登入已逾時，請重新登入" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("handle_available", { p_handle: handle });
  if (error) return { error: "現在無法確認，請稍後再試" };
  return data ? { ok: true, handle } : { error: "這個網址已經有人使用" };
}

export async function createCreatorAccountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const input = parseCreatorForm(fd);
  const rates = parseRatesForm(fd, [...COLLAB_TYPES]);
  const values: Record<string, string | string[]> = { ...input };
  const fieldErrors: Record<string, string> = { ...validateCreatorInput(input), ...validateRates(rates) };
  if (rates.length === 0) fieldErrors.rates = "至少填一種合作形式的報價";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_creator_with_rates", {
    p_display_name: input.displayName,
    p_handle: input.handle,
    p_ig_username: input.igUsername,
    p_follower_count: Number(input.followerCount),
    p_region: input.region,
    p_categories: input.categories,
    p_rates: rates.map((r) => ({ collab_type: r.collabType, price_twd: Number(r.price) })),
  });
  if (error) {
    const mapped = mapAccountError(error);
    if (mapped.kind === "exists") redirect(onboardingPath(null, nextOf(fd)));
    return { ...mapped.state, values };
  }
  // 有原本要去的頁面（例如從招募頁註冊）就回去；否則到說明頁
  const target = afterOnboardingPath("creator", nextOf(fd));
  redirect(target === "/creator" ? CREATOR_WELCOME : target);
}
