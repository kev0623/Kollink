"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mapAccountError, type FormState } from "@/lib/auth/account-errors";
import { validateBrandInput, validateCreatorInput } from "@/lib/validation/onboarding";
import { afterOnboardingPath, onboardingPath } from "@/lib/auth/post-login";
import { parseBrandForm, parseCreatorForm } from "@/lib/validation/form-data";

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

export async function createCreatorAccountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const input = parseCreatorForm(fd);
  const values = { ...input };
  const fieldErrors = validateCreatorInput(input);
  if (fieldErrors) return { fieldErrors, values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_creator_account", {
    p_display_name: input.displayName,
    p_handle: input.handle,
    p_ig_username: input.igUsername,
    p_follower_count: Number(input.followerCount),
    p_region: input.region,
    p_categories: input.categories,
  });
  if (error) {
    const mapped = mapAccountError(error);
    if (mapped.kind === "exists") redirect(onboardingPath(null, nextOf(fd)));
    return { ...mapped.state, values };
  }
  redirect(afterOnboardingPath("creator", nextOf(fd)));
}
