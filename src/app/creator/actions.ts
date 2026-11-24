"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { listOpportunities } from "@/lib/briefs/creator";
import { briefErrorMessage, briefFieldError } from "@/lib/briefs/errors";
import { isUuid, parseOpportunityQuery } from "@/lib/briefs/query";
import type { Opportunity } from "@/lib/briefs/view";
import { parseApplicationForm, validateApplication } from "@/lib/validation/brief";

const BAD_INPUT = "資料格式不正確，請重新整理頁面";
const MAX_OFFSET = 10_000;
const MAX_QUERY_LENGTH = 500;

export type LoadMoreOpportunitiesResult = { ok: true; items: Opportunity[]; hasMore: boolean } | { ok: false; error: string };
export type ApplyFormState = { ok?: boolean; fieldErrors?: Record<string, string>; formError?: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

/** 「載入更多」：query 是目前網址的查詢字串，在伺服器重新解析，不信任 client 傳來的物件。 */
export async function loadMoreOpportunitiesAction(query: unknown, offset: unknown): Promise<LoadMoreOpportunitiesResult> {
  await requireRole("creator");
  if (
    typeof query !== "string" || query.length > MAX_QUERY_LENGTH
    || typeof offset !== "number" || !Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET
  ) {
    return { ok: false, error: BAD_INPUT };
  }
  const q = parseOpportunityQuery(new URLSearchParams(query));
  if (q.tab === "applied") return { ok: false, error: BAD_INPUT };
  try {
    const page = await listOpportunities(q, offset);
    return { ok: true, items: page.items, hasMore: page.hasMore };
  } catch {
    return { ok: false, error: "載入失敗，請稍後再試" };
  }
}

/** 報名。未審核在這裡先擋（資料庫也會擋）。 */
export async function applyToBriefAction(_prev: ApplyFormState, fd: FormData): Promise<ApplyFormState> {
  const me = await requireRole("creator");
  if (me.creator?.status !== "approved") return { formError: "審核通過後即可報名" };
  const input = parseApplicationForm(fd);
  if (!isUuid(input.briefId)) return { formError: BAD_INPUT };
  const fieldErrors = validateApplication(input);
  if (fieldErrors) return { fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_to_brief", {
    p_brief_id: input.briefId,
    p_message: input.message,
    ...(input.proposedPrice === "" ? {} : { p_proposed_price: Number(input.proposedPrice) }),
  });
  if (error) {
    const fe = briefFieldError(error);
    return fe ? { fieldErrors: fe } : { formError: briefErrorMessage(error) };
  }
  revalidatePath(`/creator/briefs/${input.briefId}`);
  revalidatePath("/creator");
  return { ok: true };
}

/** 撤回待回覆的報名（撤回後不能再報名同一則）。 */
export async function withdrawApplicationAction(applicationId: unknown, briefId: unknown): Promise<ActionResult> {
  await requireRole("creator");
  if (!isUuid(applicationId) || !isUuid(briefId)) return { ok: false, error: BAD_INPUT };
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_application", { p_id: applicationId });
  if (error) return { ok: false, error: briefErrorMessage(error) };
  revalidatePath(`/creator/briefs/${briefId}`);
  revalidatePath("/creator");
  return { ok: true };
}
