import Link from "next/link";
import { eventText, eventTime, type CollabEvent } from "@/lib/collabs/view";

/** 對話與紀錄：系統事件（audit log）；訊息在對話頁，標題右邊連過去（計畫 7）。 */
export function EventList({ events, chatHref, fromApplication }: { events: CollabEvent[]; chatHref: string | null; fromApplication: boolean }) {
  return (
    <section aria-labelledby="events-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="events-title" className="text-lg font-bold text-ink">對話與紀錄</h2>
        {chatHref && <Link href={chatHref} className="shrink-0 text-sm font-semibold text-ink underline-offset-2 hover:underline">前往對話 →</Link>}
      </div>
      <ol className="mt-3 space-y-2 rounded-card border border-line bg-surface p-4 md:p-5">
        {events.map((e) => (
          <li key={e.id} className="flex gap-3 text-sm">
            <span className="w-24 shrink-0 text-xs leading-5 text-muted">{eventTime(e.createdAt)}</span>
            <span className="min-w-0 whitespace-pre-line break-words text-ink">{eventText(e, fromApplication)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
