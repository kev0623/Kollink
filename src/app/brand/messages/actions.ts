"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/briefs/query";
import { messageErrorMessage } from "@/lib/messages/errors";

export type StartState = { error?: string };

/** 公開頁的「傳訊息」：開啟（或找到既有的）對話後導過去。 */
export async function startConversationAction(_prev: StartState, fd: FormData): Promise<StartState> {
  await requireRole("brand");
  const creatorId = fd.get("creatorId");
  if (!isUuid(creatorId)) return { error: "資料格式不正確，請重新整理頁面" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_conversation", { p_creator_id: creatorId });
  if (error) return { error: messageErrorMessage(error) };
  if (!isUuid(data)) return { error: "發生錯誤，請稍後再試" };
  redirect(`/brand/messages/${data}`);
}
