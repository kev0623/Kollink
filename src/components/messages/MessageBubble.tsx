import { ShieldAlert } from "lucide-react";
import { messageTime, type Message } from "@/lib/messages/view";

/** 一則訊息：自己的靠右淡色底、對方的靠左白底。被標記的訊息雙方都看得到提示。 */
export function MessageBubble({ m, mine }: { m: Message; mine: boolean }) {
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-input px-3.5 py-2 text-sm text-ink md:max-w-[70%] ${mine ? "bg-subtle" : "border border-line bg-surface"}`}
      >
        <span className="sr-only">{mine ? "你：" : "對方："}</span>
        {m.body}
      </p>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
        {m.flagged && (
          <>
            <ShieldAlert size={12} strokeWidth={1.5} aria-hidden="true" />
            <span>可能含聯絡方式，平台已留存紀錄・</span>
          </>
        )}
        <time dateTime={m.createdAt}>{messageTime(m.createdAt)}</time>
      </p>
    </div>
  );
}
