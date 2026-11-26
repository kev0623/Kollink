// 站內訊息的顯示規則與 Row → 顯示物件。RPC 的回傳型別把欄位都標成非 null，實際上可能是 null，
// 所以這裡的 Row 型別欄位都可為 null，呼叫端先轉成 unknown 再轉型。
import { formatDateTimeTw } from "@/lib/briefs/dates";
import { textLength } from "@/lib/validation/brief";
import { cleanMessageBody } from "@/lib/validation/message";

export type MessageSide = "brand" | "creator";

/** 開啟對話時第一頁、與每次「載入較早的訊息」的則數。 */
export const MESSAGE_PAGE_SIZE = 50;
/** 標記已讀成功後在 window 發出的事件；導覽列的未讀徽章收到後重新查詢。 */
export const MESSAGES_READ_EVENT = "kollink:messages-read";
const PREVIEW_MAX = 40;

function toSide(v: unknown): MessageSide {
  return v === "brand" ? "brand" : "creator";
}

// ── 列表 ──

export type ConversationListItem = {
  id: string;
  side: MessageSide;
  counterpartName: string;
  counterpartImagePath: string | null;
  counterpartHandle: string | null;
  lastBody: string | null;
  lastSenderIsMe: boolean;
  lastAt: string;
  unread: number;
  closed: boolean;
};

export type ConversationListRow = {
  id: string;
  my_side: string | null;
  counterpart_name: string | null;
  counterpart_image_path: string | null;
  counterpart_handle: string | null;
  last_body: string | null;
  last_sender_is_me: boolean | null;
  last_at: string | null;
  unread_count: number | null;
  closed: boolean | null;
};

export function toConversationListItem(r: ConversationListRow): ConversationListItem {
  return {
    id: r.id,
    side: toSide(r.my_side),
    counterpartName: r.counterpart_name ?? "",
    counterpartImagePath: r.counterpart_image_path ?? null,
    counterpartHandle: r.counterpart_handle ?? null,
    lastBody: r.last_body ?? null,
    lastSenderIsMe: r.last_sender_is_me ?? false,
    lastAt: r.last_at ?? "",
    unread: r.unread_count ?? 0,
    closed: r.closed ?? false,
  };
}

/** 列表的預覽：換行改成空白、最多 40 字（以 code point 計），自己送的加「你：」。 */
export function previewText(it: Pick<ConversationListItem, "lastBody" | "lastSenderIsMe">): string {
  if (!it.lastBody) return "還沒有訊息";
  const flat = it.lastBody.replace(/\s+/g, " ").trim();
  const cps = [...flat];
  const short = cps.length > PREVIEW_MAX ? `${cps.slice(0, PREVIEW_MAX).join("")}…` : flat;
  return it.lastSenderIsMe ? `你：${short}` : short;
}

/** 列表的時間：台灣今天顯示 HH:mm，今年顯示 MM/DD，更早顯示 YYYY/MM/DD。today 是伺服器算好的 YYYY-MM-DD。 */
export function listTimeLabel(iso: string, today: string): string {
  if (Number.isNaN(Date.parse(iso))) return "";
  const t = formatDateTimeTw(iso); // YYYY/MM/DD HH:mm
  if (t.slice(0, 10) === today.replaceAll("-", "/")) return t.slice(11);
  return t.slice(0, 4) === today.slice(0, 4) ? t.slice(5, 10) : t.slice(0, 10);
}

/** 輸入框按鍵：桌面（精準指標）Enter 送出、Shift+Enter 換行；觸控裝置 Enter 換行；Ctrl／⌘+Enter 一律送出；選字中（注音、倉頡等）不處理。 */
export function composerKeyAction(e: { key: string; shift: boolean; composing: boolean; finePointer: boolean; mod: boolean }): "send" | "newline" | null {
  if (e.key !== "Enter" || e.composing) return null;
  if (e.mod) return "send";
  if (e.shift || !e.finePointer) return "newline";
  return "send";
}

/** 輸入框的字數：和送出驗證用同一套（先 cleanMessageBody、以 code point 計），所以計數超過上限就等於送出會被擋。 */
export function composerCount(body: string): number {
  return textLength(cleanMessageBody(body));
}

/** 未讀徽章：0 不顯示、超過 9 顯示 9+。 */
export function unreadBadgeText(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 9 ? "9+" : String(Math.floor(n));
}

export function messagesHref(side: MessageSide, id?: string): string {
  return id ? `/${side}/messages/${id}` : `/${side}/messages`;
}

export const EMPTY_LIST_TEXT: Record<MessageSide, string> = {
  brand: "還沒有對話。到創作者的公開頁按「傳訊息」開始聊聊。",
  creator: "還沒有對話。品牌傳訊息、錄取或邀請你之後，對話會出現在這裡。",
};

// ── 對話 ──

export type Conversation = {
  id: string;
  side: MessageSide | "admin";
  brandId: string;
  brandName: string;
  brandLogoPath: string | null;
  creatorId: string;
  creatorName: string;
  creatorHandle: string | null;
  creatorAvatarPath: string | null;
  closed: boolean;
};

export type ConversationRow = {
  id: string;
  my_side: string | null;
  brand_id: string | null;
  brand_name: string | null;
  brand_logo_path: string | null;
  creator_id: string | null;
  creator_name: string | null;
  creator_handle: string | null;
  creator_avatar_path: string | null;
  closed: boolean | null;
};

export function toConversation(r: ConversationRow): Conversation {
  return {
    id: r.id,
    side: r.my_side === "brand" || r.my_side === "creator" ? r.my_side : "admin",
    brandId: r.brand_id ?? "",
    brandName: r.brand_name ?? "",
    brandLogoPath: r.brand_logo_path ?? null,
    creatorId: r.creator_id ?? "",
    creatorName: r.creator_name ?? "",
    creatorHandle: r.creator_handle ?? null,
    creatorAvatarPath: r.creator_avatar_path ?? null,
    closed: r.closed ?? false,
  };
}

/** 對方：品牌視角是創作者，創作者視角是品牌。 */
export function counterpartOf(c: Conversation, side: MessageSide): { name: string; imagePath: string | null; handle: string | null } {
  return side === "brand"
    ? { name: c.creatorName, imagePath: c.creatorAvatarPath, handle: c.creatorHandle }
    : { name: c.brandName, imagePath: c.brandLogoPath, handle: null };
}

/** 對話暫停（創作者不是 approved）時輸入區的說明。 */
export function closedNotice(side: MessageSide): string {
  return side === "brand" ? "這位創作者的帳號目前停權，對話暫停。" : "你的帳號目前停權，暫時無法傳送訊息。";
}

// ── 訊息 ──

export type Message = { id: string; senderId: string; body: string; flagged: boolean; createdAt: string };

export type MessageRow = {
  id: string;
  sender_id: string | null;
  body: string | null;
  flagged_contact: boolean | null;
  created_at: string | null;
};

export function toMessage(r: MessageRow): Message {
  return {
    id: r.id,
    senderId: r.sender_id ?? "",
    body: r.body ?? "",
    flagged: r.flagged_contact ?? false,
    createdAt: r.created_at ?? "",
  };
}

function compareMessages(a: Message, b: Message): number {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  if (ta !== tb) return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** 合併兩批訊息：依 id 去重（後者優先），依 (createdAt, id) 由舊到新。 */
export function mergeMessages(a: Message[], b: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const m of a) byId.set(m.id, m);
  for (const m of b) byId.set(m.id, m);
  return [...byId.values()].sort(compareMessages);
}

/** 訊息下方的時間（台灣時間 HH:mm）。 */
export function messageTime(iso: string): string {
  if (Number.isNaN(Date.parse(iso))) return "";
  return formatDateTimeTw(iso).slice(11);
}

export type ThreadEntry =
  | { kind: "day"; key: string; label: string }
  | { kind: "message"; key: string; message: Message };

/** 在台灣日期改變的地方插入日期分隔線（2026/11/26）。 */
export function withDaySeparators(messages: Message[]): ThreadEntry[] {
  const out: ThreadEntry[] = [];
  let lastDay = "";
  for (const m of messages) {
    const day = Number.isNaN(Date.parse(m.createdAt)) ? "" : formatDateTimeTw(m.createdAt).slice(0, 10);
    if (day && day !== lastDay) {
      out.push({ kind: "day", key: `day-${day}`, label: day });
      lastDay = day;
    }
    out.push({ kind: "message", key: m.id, message: m });
  }
  return out;
}
