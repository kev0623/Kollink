"use client";

import { setCreatorStatusAction } from "@/app/admin/actions";
import { ConfirmAction } from "@/components/briefs/ConfirmAction";
import type { CreatorReviewAction } from "@/lib/admin/view";
import { NoteAction } from "./NoteAction";

/** 一位創作者的審核按鈕：核准／解除停權用確認區塊，退回／停權要寫原因（創作者看得到）。 */
export function CreatorReviewActions({ userId, handle, actions }: { userId: string; handle: string; actions: CreatorReviewAction[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.includes("approve") && (
        <ConfirmAction
          label="核准" confirmLabel="確定核准"
          message={`核准 @${handle}：公開頁立刻上線、可以報名招募與接案，網址代稱之後不能再改。`}
          onConfirm={() => setCreatorStatusAction(userId, "approve")}
        />
      )}
      {actions.includes("reject") && (
        <NoteAction
          label="退回" fieldLabel="退回原因（創作者看得到）" noteName="原因" confirmLabel="確定退回" danger
          message="創作者會在頁面上方看到原因，修正後可以重新送審。"
          onSubmit={(reason) => setCreatorStatusAction(userId, "reject", reason)}
        />
      )}
      {actions.includes("suspend") && (
        <NoteAction
          label="停權" fieldLabel="停權原因（創作者看得到）" noteName="原因" confirmLabel="確定停權" danger
          message="停權後公開頁下架、所有對話暫停（雙方都不能再傳訊息），進行中的合作案不受影響。"
          onSubmit={(reason) => setCreatorStatusAction(userId, "suspend", reason)}
        />
      )}
      {actions.includes("unsuspend") && (
        <ConfirmAction
          label="解除停權" confirmLabel="確定解除"
          message={`解除 @${handle} 的停權：公開頁重新上線、對話恢復。`}
          onConfirm={() => setCreatorStatusAction(userId, "unsuspend")}
        />
      )}
    </div>
  );
}
