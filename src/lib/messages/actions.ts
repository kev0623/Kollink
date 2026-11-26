"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/briefs/query";
import { cleanMessageBody, validateMessageBody } from "@/lib/validation/message";
import { messageErrorMessage } from "./errors";
import { loadOlderMessages } from "./load";
import { toMessage, type Message, type MessageRow } from "./view";

// 品牌與創作者共用的訊息 actions。requireRole 只能指定一種角色，所以這裡用 getCurrentUser 確認是品牌或創作者；
// 是不是這個對話的參與者由資料庫函式檢查。不 revalidate：畫面由 ThreadView 自己更新、列表由 Realtime 觸發 refresh。

const BAD_INPUT = "資料格式不正確，請重新整理頁面";
const SIGNED_OUT = "登入已逾時，請重新登入";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SendResult = { ok: true; message: Message } | { ok: false; error: string };
export type OlderResult = { ok: true; messages: Message[]; hasMore: boolean } | { ok: false; error: string };

async function isMessagingUser(): Promise<boolean> {
  const role = (await getCurrentUser())?.profile?.role;
  return role === "brand" || role === "creator";
}

/** 送出訊息。回傳資料庫寫入的那一則（含 trigger 算好的 flagged_contact）。 */
export async function sendMessageAction(conversationId: unknown, body: unknown): Promise<SendResult> {
  if (!(await isMessagingUser())) return { ok: false, error: SIGNED_OUT };
  if (!isUuid(conversationId) || typeof body !== "string") return { ok: false, error: BAD_INPUT };
  const clean = cleanMessageBody(body);
  const err = validateMessageBody(clean);
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_message", { p_conversation_id: conversationId, p_body: clean });
  if (error) return { ok: false, error: messageErrorMessage(error) };
  const row = ((data ?? []) as unknown as MessageRow[])[0];
  if (!row) return { ok: false, error: messageErrorMessage({}) };
  return { ok: true, message: toMessage(row) };
}

/** 標記已讀（開啟對話、收到對方訊息時由 ThreadView 呼叫）。 */
export async function markReadAction(conversationId: unknown): Promise<ActionResult> {
  if (!(await isMessagingUser())) return { ok: false, error: SIGNED_OUT };
  if (!isUuid(conversationId)) return { ok: false, error: BAD_INPUT };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
  if (error) return { ok: false, error: messageErrorMessage(error) };
  return { ok: true };
}

/** 載入比目前最早一則更早的 50 則。 */
export async function loadOlderMessagesAction(conversationId: unknown, beforeAt: unknown, beforeId: unknown): Promise<OlderResult> {
  if (!(await isMessagingUser())) return { ok: false, error: SIGNED_OUT };
  if (!isUuid(conversationId) || !isUuid(beforeId) || typeof beforeAt !== "string" || Number.isNaN(Date.parse(beforeAt))) {
    return { ok: false, error: BAD_INPUT };
  }
  try {
    const page = await loadOlderMessages(conversationId, beforeAt, beforeId);
    return { ok: true, ...page };
  } catch (e) {
    return { ok: false, error: messageErrorMessage(e as { message?: string }) };
  }
}
