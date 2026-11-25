import { eventText, eventTime, type CollabEvent } from "@/lib/collabs/view";

/** 對話區：目前只列系統事件（audit log）。計畫 7 會在這裡加上訊息與輸入框。 */
export function EventList({ events }: { events: CollabEvent[] }) {
  return (
    <section aria-labelledby="events-title">
      <h2 id="events-title" className="text-lg font-bold text-ink">對話與紀錄</h2>
      <ol className="mt-3 space-y-2 rounded-card border border-line bg-surface p-4 md:p-5">
        {events.map((e) => (
          <li key={e.id} className="flex gap-3 text-sm">
            <span className="w-24 shrink-0 text-xs leading-5 text-muted">{eventTime(e.createdAt)}</span>
            <span className="min-w-0 whitespace-pre-line break-words text-ink">{eventText(e)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted">站內訊息即將推出。</p>
    </section>
  );
}
