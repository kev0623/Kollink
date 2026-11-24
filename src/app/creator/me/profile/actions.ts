"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { mapAccountError, type FormState, type FormValues } from "@/lib/auth/account-errors";
import { validatePublicProfileInput } from "@/lib/validation/creator-profile";
import { parsePublicProfileForm } from "@/lib/validation/form-data";

function failure(error: { code?: string; message?: string }, values?: FormValues): FormState {
  const mapped = mapAccountError(error);
  return { ...(mapped.kind === "state" ? mapped.state : { formError: "發生錯誤，請稍後再試" }), values };
}

function revalidateProfile(handle: string) {
  revalidatePath("/creator/me/profile");
  revalidatePath(`/c/${handle}`);
}

export async function updatePublicProfileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("creator");
  if (!me.creator) return { formError: "找不到創作者資料，請重新登入" };
  const input = parsePublicProfileForm(fd);
  const values: FormValues = {
    bio: input.bio,
    styleTags: input.styleTags.join("、"),
    collabTypes: input.collabTypes,
    engagementRate: input.engagementRate,
    audienceAge: input.audienceAge,
    avatarPath: input.avatarPath ?? "",
  };
  const fieldErrors = validatePublicProfileInput(input);
  if (fieldErrors) return { fieldErrors, values };

  const supabase = await createClient();
  // 修改只能走 definer 函式；空字串由資料庫轉成 null。
  // p_engagement_rate、p_avatar_path 傳 null 代表不填／移除頭像（產生的型別寫成非 null，所以要轉型）
  const { error } = await supabase.rpc("update_creator_public_profile", {
    p_bio: input.bio,
    p_style_tags: input.styleTags,
    p_collab_types: input.collabTypes,
    p_engagement_rate: (input.engagementRate === "" ? null : Number(input.engagementRate)) as number,
    p_audience_age: input.audienceAge,
    p_avatar_path: input.avatarPath as string,
  });
  if (error) return failure(error, values);
  revalidateProfile(me.creator.handle);
  return { ok: true };
}
