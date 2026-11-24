"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { BRIEF_COVER_BUCKET } from "@/lib/brief-cover";
import { todayTw } from "@/lib/briefs/dates";
import { briefErrorMessage, briefFieldError } from "@/lib/briefs/errors";
import { isUuid, parseBriefStep } from "@/lib/briefs/query";
import { parseBriefForm, toSaveBriefArgs, validateBrief } from "@/lib/validation/brief";

const BAD_INPUT = "資料格式不正確，請重新整理頁面";

export type BriefFormState = { fieldErrors?: Record<string, string>; formError?: string; saved?: boolean };
export type ActionResult = { ok: true } | { ok: false; error: string };

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

/**
 * 存成草稿或發佈（intent = draft | publish）。id 空白代表新增。
 * 發佈 → redirect 到招募詳情。新增的草稿 → redirect 到編輯頁同一步（之後重新整理會從資料庫讀回來）；
 * 已存在的草稿 → 留在原頁，回傳 { saved: true } 顯示「已存成草稿」。
 */
export async function saveBriefAction(_prev: BriefFormState, fd: FormData): Promise<BriefFormState> {
  await requireRole("brand");
  const id = str(fd, "id");
  const intent = fd.get("intent");
  if ((id !== "" && !isUuid(id)) || (intent !== "draft" && intent !== "publish")) return { formError: BAD_INPUT };
  const step = parseBriefStep(str(fd, "step"));
  const input = parseBriefForm(fd);
  const fieldErrors = validateBrief(input, intent, todayTw());
  if (fieldErrors) return { fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_brief", toSaveBriefArgs(id || null, input, intent === "publish"));
  if (error) {
    const fe = briefFieldError(error);
    return fe ? { fieldErrors: fe } : { formError: briefErrorMessage(error) };
  }
  const savedId = data as unknown as string;
  revalidatePath("/brand/briefs");
  if (intent === "publish") redirect(`/brand/briefs/${savedId}`);
  if (!id) redirect(`/brand/briefs/${savedId}/edit?step=${step}&saved=1`);
  revalidatePath(`/brand/briefs/${savedId}`);
  return { saved: true };
}

/** 關閉發佈中的招募。 */
export async function closeBriefAction(id: unknown): Promise<ActionResult> {
  await requireRole("brand");
  if (!isUuid(id)) return { ok: false, error: BAD_INPUT };
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_brief", { p_id: id });
  if (error) return { ok: false, error: briefErrorMessage(error) };
  revalidatePath("/brand/briefs");
  revalidatePath(`/brand/briefs/${id}`);
  return { ok: true };
}

/** 刪除草稿，並盡力刪除封面檔（失敗就留給孤兒檔排程）；成功後回到列表。 */
export async function deleteBriefAction(id: unknown): Promise<ActionResult> {
  await requireRole("brand");
  if (!isUuid(id)) return { ok: false, error: BAD_INPUT };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_brief", { p_id: id });
  if (error) return { ok: false, error: briefErrorMessage(error) };
  const cover = data as unknown as string | null;
  if (cover) {
    try {
      await supabase.storage.from(BRIEF_COVER_BUCKET).remove([cover]);
    } catch {
      // 忽略
    }
  }
  revalidatePath("/brand/briefs");
  redirect("/brand/briefs?tab=draft");
}

/** 錄取（accept = true）或婉拒。招募關閉或截止後也可以。 */
export async function decideApplicationAction(applicationId: unknown, briefId: unknown, accept: unknown): Promise<ActionResult> {
  await requireRole("brand");
  if (!isUuid(applicationId) || !isUuid(briefId) || typeof accept !== "boolean") return { ok: false, error: BAD_INPUT };
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_application", { p_id: applicationId, p_accept: accept });
  if (error) return { ok: false, error: briefErrorMessage(error) };
  revalidatePath(`/brand/briefs/${briefId}`);
  revalidatePath("/brand/briefs");
  return { ok: true };
}
