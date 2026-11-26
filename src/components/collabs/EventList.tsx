import Link from "next/link";
import { h2, rows } from "@/components/ui/styles";
import { eventText, eventTime, type CollabEvent } from "@/lib/collabs/view";

/** 對話與紀錄：系統事件（audit log）；訊息在對話頁，標題右邊連過去（計畫 7）。 */
export function EventList({ events, chatHref, fromApplication }: { events: CollabEvent[]; chatHref: string | null; fromApplication: boolean }) {
  return (
    <section aria-labelledby="events-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="events-title" className={h2}>對話與紀錄</h2>
        {chatHref && <Link href={chatHref} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-accent">前往對話</Link>}
      </div>
      <ol className={`${rows} mt-3`}>
        {events.map((e) => (
          <li key={e.id} className="flex gap-3 px-4 py-3 text-sm md:px-5">
            <span className="w-24 shrink-0 text-xs leading-5 text-muted">{eventTime(e.createdAt)}</span>
            <span className="min-w-0 whitespace-pre-line break-words text-ink">{eventText(e, fromApplication)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
