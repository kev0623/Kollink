import Link from "next/link";
import { Counterpart } from "@/components/collabs/Counterpart";
import {
  EMPTY_LIST_TEXT, listTimeLabel, messagesHref, previewText, unreadBadgeText,
  type ConversationListItem, type MessageSide,
} from "@/lib/messages/view";

type Props = { side: MessageSide; items: ConversationListItem[]; activeId: string | null; today: string };

/** 對話列表。目前打開的那一列反白、不顯示未讀數（標記已讀與重新整理有先後）。 */
export function ConversationList({ side, items, activeId, today }: Props) {
  if (items.length === 0) {
    return <p className="rounded-card border border-line bg-surface p-6 text-center text-sm text-muted">{EMPTY_LIST_TEXT[side]}</p>;
  }
  return (
    <ul aria-label="對話列表" className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {items.map((it) => {
        const active = it.id === activeId;
        const unread = active ? null : unreadBadgeText(it.unread);
        return (
          <li key={it.id}>
            <Link
              href={messagesHref(side, it.id)}
              aria-current={active ? "page" : undefined}
              className={`flex items-start gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink ${active ? "bg-subtle" : "hover:bg-bg"}`}
            >
              <Counterpart side={side} name={it.counterpartName} imagePath={it.counterpartImagePath} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`min-w-0 truncate text-ink ${unread ? "font-bold" : "font-semibold"}`}>{it.counterpartName}</p>
                  <span className="shrink-0 text-xs text-muted">{listTimeLabel(it.lastAt, today)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className={`min-w-0 flex-1 truncate text-sm ${unread ? "text-ink" : "text-muted"}`}>{previewText(it)}</p>
                  {it.closed && <span className="shrink-0 rounded-btn bg-subtle px-2 py-0.5 text-xs text-muted">暫停</span>}
                  {unread && (
                    <span className="shrink-0 rounded-btn bg-ink px-2 py-0.5 text-xs font-semibold text-on-ink">
                      {unread}<span className="sr-only"> 則未讀</span>
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
