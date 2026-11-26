"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/briefs/query";
import { collabErrorMessage, collabFieldError } from "@/lib/collabs/errors";
import { cleanLongText, isValidPostUrl, validateSubmission } from "@/lib/validation/collab";
import { cleanText } from "@/lib/validation/onboarding";

const BAD_INPUT = "資料格式不正確，請重新整理頁面";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SubmitResult = { ok: true } | { ok: false; error?: string; fieldErrors?: Record<string, string> };

function revalidateCollab(id: string) {
  revalidatePath("/brand/collabs");
  revalidatePath("/creator/collabs");
  revalidatePath(`/brand/collabs/${id}`);
  revalidatePath(`/creator/collabs/${id}`);
}

/** 創作者回覆邀約：接受或婉拒。 */
export async function creatorCollabAction(collabId: unknown, action: unknown): Promise<ActionResult> {
  await requireRole("creator");
  if (!isUuid(collabId) || (action !== "accept" && action !== "decline")) return { ok: false, error: BAD_INPUT };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_collaboration", { p_collab_id: collabId, p_action: action });
  if (error) return { ok: false, error: collabErrorMessage(error) };
  revalidateCollab(collabId);
  return { ok: true };
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.length <= 20 && v.every((x) => typeof x === "string");
}

/** 交稿：檔案已在瀏覽器上傳到 deliverables；這裡驗證後呼叫 submit_deliverables（同時推進到審核）。 */
export async function submitDeliverablesAction(collabId: unknown, input: unknown): Promise<SubmitResult> {
  const me = await requireRole("creator");
  if (!isUuid(collabId) || typeof input !== "object" || input === null) return { ok: false, error: BAD_INPUT };
  const { note, links, filePaths } = input as Record<string, unknown>;
  if (typeof note !== "string" || !isStringArray(links) || !isStringArray(filePaths)) return { ok: false, error: BAD_INPUT };
  const clean = { note: cleanLongText(note), links: links.map(cleanText).filter((l) => l !== ""), filePaths };
  const fieldErrors = validateSubmission(clean, collabId, me.id);
  if (fieldErrors) return { ok: false, fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_deliverables", {
    p_collab_id: collabId,
    p_note: clean.note === "" ? undefined : clean.note,
    p_links: clean.links,
    p_file_paths: clean.filePaths,
  });
  if (error) {
    const fe = collabFieldError(error);
    return fe ? { ok: false, fieldErrors: fe } : { ok: false, error: collabErrorMessage(error) };
  }
  revalidateCollab(collabId);
  return { ok: true };
}

/** 填入貼文連結（awaiting_publish → awaiting_payout）。前端與這裡都先用 new URL() 檢查，資料庫 regex 再擋一次。 */
export async function publishCollabAction(collabId: unknown, url: unknown): Promise<ActionResult> {
  await requireRole("creator");
  if (!isUuid(collabId) || typeof url !== "string") return { ok: false, error: BAD_INPUT };
  const clean = cleanText(url);
  if (!isValidPostUrl(clean)) return { ok: false, error: "請貼上完整的貼文網址（https:// 開頭、含路徑）" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_collaboration", {
    p_collab_id: collabId, p_action: "publish", p_published_url: clean,
  });
  if (error) return { ok: false, error: collabErrorMessage(error) };
  revalidateCollab(collabId);
  return { ok: true };
}
