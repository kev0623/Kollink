import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toCollabStatus, type CollabStatus } from "@/lib/collabs/view";
import {
  MESSAGE_PAGE_SIZE, toConversation, toConversationListItem, toMessage,
  type Conversation, type ConversationListItem, type ConversationListRow, type ConversationRow,
  type Message, type MessageRow,
} from "./view";

// 站內訊息的伺服器端讀取。全部用使用者自己的 client（definer 函式與 RLS 自己檢查身分）。
// 會讀 cookie：只能在 requireRole 之後呼叫。不快取。

/** 我的對話（最後一則訊息由新到舊；最多 200 筆）。 */
export async function loadMyConversations(): Promise<ConversationListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_conversations");
  if (error) throw error;
  return ((data ?? []) as unknown as ConversationListRow[]).map(toConversationListItem);
}

export type ConversationCollab = { id: string; title: string; status: CollabStatus };
export type ThreadData = { conversation: Conversation; messages: Message[]; hasMore: boolean; collabs: ConversationCollab[] };
export type MessagePage = { messages: Message[]; hasMore: boolean };

/** list_messages 是由新到舊；多拿一則判斷還有沒有更早的，回傳由舊到新。 */
async function fetchPage(id: string, before: { at: string; id: string } | null): Promise<MessagePage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_messages", {
    p_conversation_id: id,
    p_limit: MESSAGE_PAGE_SIZE + 1,
    ...(before ? { p_before_at: before.at, p_before_id: before.id } : {}),
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown as MessageRow[];
  return {
    messages: rows.slice(0, MESSAGE_PAGE_SIZE).map(toMessage).reverse(),
    hasMore: rows.length > MESSAGE_PAGE_SIZE,
  };
}

/** 一個對話：標題、最新 50 則訊息、這個對話的合作案。不是參與者（也不是管理員）或不存在回傳 null。 */
export async function loadThread(id: string): Promise<ThreadData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_conversation", { p_id: id });
  if (error) throw error;
  const row = ((data ?? []) as unknown as ConversationRow[])[0];
  if (!row) return null;

  const [page, collabs] = await Promise.all([
    fetchPage(id, null),
    supabase.from("collaborations").select("id, title, status").eq("conversation_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (collabs.error) throw collabs.error;
  return {
    conversation: toConversation(row),
    messages: page.messages,
    hasMore: page.hasMore,
    collabs: (collabs.data ?? []).map((c) => ({ id: c.id, title: c.title, status: toCollabStatus(c.status) })),
  };
}

/** 比 (beforeAt, beforeId) 更早的 50 則（由舊到新）。 */
export async function loadOlderMessages(id: string, beforeAt: string, beforeId: string): Promise<MessagePage> {
  return fetchPage(id, { at: beforeAt, id: beforeId });
}
