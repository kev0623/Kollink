"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/briefs/query";
import { collabErrorMessage, collabFieldError } from "@/lib/collabs/errors";
import { cleanLongText, parseAmount, parseOfferForm, validateOffer, validateRevisionNote } from "@/lib/validation/collab";

const BAD_INPUT = "資料格式不正確，請重新整理頁面";

export type OfferFormState = { fieldErrors?: Record<string, string>; formError?: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateCollab(id: string) {
  revalidatePath("/brand/collabs");
  revalidatePath("/creator/collabs");
  revalidatePath(`/brand/collabs/${id}`);
  revalidatePath(`/creator/collabs/${id}`);
}

/** 在創作者公開頁直接邀請（invited）。成功後導到合作案詳情。 */
export async function inviteCreatorAction(_prev: OfferFormState, fd: FormData): Promise<OfferFormState> {
  await requireRole("brand");
  const creatorId = fd.get("creatorId");
  if (!isUuid(creatorId)) return { formError: BAD_INPUT };
  const input = parseOfferForm(fd);
  const fieldErrors = validateOffer(input, true);
  if (fieldErrors) return { fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_creator", {
    p_creator_id: creatorId,
    p_title: input.title,
    p_deliverables: input.deliverables,
    p_amount_twd: parseAmount(input.amount)!,
  });
  if (error) {
    const fe = collabFieldError(error);
    return fe ? { fieldErrors: fe } : { formError: collabErrorMessage(error) };
  }
  const id = data as unknown as string;
  revalidateCollab(id);
  redirect(`/brand/collabs/${id}`);
}

const BRAND_ACTIONS: readonly string[] = ["cancel", "approve", "request_changes"];

/** 品牌的狀態動作：取消（邀約中／待付款）、審核通過、要求修改（說明必填）。 */
export async function brandCollabAction(collabId: unknown, action: unknown, note?: unknown): Promise<ActionResult> {
  await requireRole("brand");
  if (!isUuid(collabId) || typeof action !== "string" || !BRAND_ACTIONS.includes(action)) return { ok: false, error: BAD_INPUT };
  let cleanNote: string | null = null;
  if (action === "request_changes") {
    if (typeof note !== "string") return { ok: false, error: BAD_INPUT };
    cleanNote = cleanLongText(note);
    const err = validateRevisionNote(cleanNote);
    if (err) return { ok: false, error: err };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_collaboration", {
    p_collab_id: collabId,
    p_action: action,
    ...(cleanNote !== null ? { p_note: cleanNote } : {}),
  });
  if (error) return { ok: false, error: collabErrorMessage(error) };
  revalidateCollab(collabId);
  return { ok: true };
}
