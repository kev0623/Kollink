"use client";

import { useActionState } from "react";
import { MessageCircle } from "lucide-react";
import { startConversationAction, type StartState } from "@/app/brand/messages/actions";

/** 公開頁的「傳訊息」（只有品牌看得到）：開啟或找到既有的對話後導過去。 */
export function MessageButton({ creatorId }: { creatorId: string }) {
  const [state, action, pending] = useActionState<StartState, FormData>(startConversationAction, {});
  return (
    <form action={action} className="min-w-0">
      <input type="hidden" name="creatorId" value={creatorId} />
      <button type="submit" disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-btn border border-line bg-surface font-semibold text-ink disabled:opacity-60">
        <MessageCircle size={18} strokeWidth={1.5} aria-hidden="true" />
        {pending ? "開啟中…" : "傳訊息"}
      </button>
      {state.error && <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
