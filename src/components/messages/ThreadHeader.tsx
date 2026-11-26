import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Counterpart } from "@/components/collabs/Counterpart";
import { COLLAB_STATUS_LABEL } from "@/lib/collabs/view";
import type { ConversationCollab } from "@/lib/messages/load";
import { counterpartOf, messagesHref, type Conversation, type MessageSide } from "@/lib/messages/view";

/** 對話標題區：對方、（品牌）公開頁連結、這個對話的合作案膠囊。手機另有回到列表的按鈕。 */
export function ThreadHeader({ side, c, collabs }: { side: MessageSide; c: Conversation; collabs: ConversationCollab[] }) {
  const other = counterpartOf(c, side);
  const collabBase = side === "brand" ? "/brand/collabs" : "/creator/collabs";
  return (
    <header className="shrink-0 rounded-card border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <Link href={messagesHref(side)} className="-ml-1 flex h-11 w-9 items-center justify-center rounded-btn text-ink md:hidden">
          <ChevronLeft size={22} strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">回到訊息列表</span>
        </Link>
        <Counterpart side={side} name={other.name} imagePath={other.imagePath} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-ink">{other.name}</h2>
          {other.handle && (
            <Link href={`/c/${other.handle}`} className="text-xs text-muted underline-offset-2 hover:underline">查看公開頁</Link>
          )}
        </div>
      </div>
      {collabs.length > 0 && (
        <ul aria-label="這個對話的合作案" className="relative mt-3 flex gap-2 overflow-x-auto pb-1">
          {collabs.map((k) => (
            <li key={k.id} className="shrink-0">
              <Link href={`${collabBase}/${k.id}`} className="block max-w-60 truncate rounded-btn bg-primary-soft px-3 py-1.5 text-xs text-ink">
                {k.title}・{COLLAB_STATUS_LABEL[k.status]}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
