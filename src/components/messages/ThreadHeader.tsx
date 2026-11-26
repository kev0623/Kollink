import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { btn } from "@/components/ui/styles";
import { Counterpart } from "@/components/collabs/Counterpart";
import { COLLAB_STATUS_LABEL } from "@/lib/collabs/view";
import type { ConversationCollab } from "@/lib/messages/load";
import { counterpartOf, messagesHref, type Conversation, type MessageSide } from "@/lib/messages/view";

/** 對話標題區：對方、（品牌）公開頁連結、這個對話的合作案膠囊。手機另有回到列表的按鈕。 */
export function ThreadHeader({ side, c, collabs }: { side: MessageSide; c: Conversation; collabs: ConversationCollab[] }) {
  const other = counterpartOf(c, side);
  const collabBase = side === "brand" ? "/brand/collabs" : "/creator/collabs";
  return (
    <header className="sticky top-0 z-10 -mx-4 shrink-0 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:rounded-card md:border md:bg-surface md:p-4">
      <div className="flex items-center gap-3">
        <Link href={messagesHref(side)} className={`${btn.icon} -ml-2 md:hidden`}>
          <ChevronLeft size={22} strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">回到訊息列表</span>
        </Link>
        <Counterpart side={side} name={other.name} imagePath={other.imagePath} />
        <h2 className="min-w-0 flex-1 truncate font-semibold text-ink">{other.name}</h2>
        {other.handle && !c.closed && (
          <Link href={`/c/${other.handle}`} className="inline-flex min-h-11 shrink-0 items-center text-xs text-muted underline-offset-2 hover:underline">查看公開頁</Link>
        )}
      </div>
      {collabs.length > 0 && (
        <ul aria-label="這個對話的合作案" className="relative mt-1 flex gap-2 overflow-x-auto">
          {collabs.map((k) => (
            <li key={k.id} className="shrink-0">
              <Link href={`${collabBase}/${k.id}`} className="inline-flex min-h-11 max-w-60 items-center truncate rounded-btn bg-subtle px-3 text-xs text-ink hover:bg-line">
                <span className="truncate">{k.title}・{COLLAB_STATUS_LABEL[k.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
