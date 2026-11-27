import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { rows } from "@/components/ui/styles";
import { Counterpart } from "@/components/collabs/Counterpart";
import {
  EMPTY_LIST_TEXT, listTimeLabel, messagesHref, previewText, unreadBadgeText,
  type ConversationListItem, type MessageSide,
} from "@/lib/messages/view";

type Props = { side: MessageSide; items: ConversationListItem[]; activeId: string | null; today: string };

/** 對話列表。目前打開的那一列用主色淡底（primary-soft）反白、不顯示未讀數（標記已讀與重新整理有先後）。 */
export function ConversationList({ side, items, activeId, today }: Props) {
  if (items.length === 0) {
    return (
      <EmptyState
        text={EMPTY_LIST_TEXT[side]}
        action={side === "brand" ? { href: "/brand", label: "去創作者廣場" } : { href: "/creator", label: "看機會" }}
      />
    );
  }
  return (
    <ul aria-label="對話列表" className={rows}>
      {items.map((it) => {
        const active = it.id === activeId;
        const unread = active ? null : unreadBadgeText(it.unread);
        return (
          <li key={it.id}>
            <Link
              href={messagesHref(side, it.id)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-start gap-3 p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${active ? "bg-primary-soft" : "hover:bg-subtle"}`}
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
                    <span className="shrink-0 rounded-btn bg-primary px-2 py-0.5 text-xs font-bold text-on-primary">
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
