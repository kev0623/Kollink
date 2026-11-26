"use client";

import { useState } from "react";
import { inviteCreatorAction } from "@/app/brand/collabs/actions";
import { btn } from "@/components/ui/styles";
import { useKeyboardPanel } from "@/components/ui/useKeyboardInset";
import { MessageButton } from "@/components/messages/MessageButton";
import { OfferForm } from "./OfferForm";

/**
 * 公開頁的「邀請合作」（品牌）：按下後在頁面內展開表單（案名、交付內容、金額）；旁邊是「傳訊息」（計畫 7）。
 * 手機固定在底部、可捲動；桌面在右欄上方 sticky。
 */
export function InvitePanel({ creatorId, creatorName }: { creatorId: string; creatorName: string }) {
  const [open, setOpen] = useState(false);
  // 鍵盤彈出時（手機）：面板移到鍵盤上方、高度縮到看得到的範圍
  const panel = useKeyboardPanel(0);
  return (
    <div style={open ? panel.style : undefined} onFocus={panel.onFocus} className="fixed inset-x-0 bottom-0 z-10 max-h-[80dvh] overflow-y-auto overscroll-contain border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:sticky md:inset-x-auto md:bottom-auto md:top-4 md:max-h-none md:overflow-visible md:rounded-card md:border md:p-5">
      {!open ? (
        <div key="open" className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setOpen(true)}
            className={`${btn.primary} w-full`}>
            邀請合作
          </button>
          <MessageButton creatorId={creatorId} />
        </div>
      ) : (
        <div key="form">
          <p className="mb-3 font-semibold text-ink">邀請 {creatorName} 合作</p>
          <OfferForm
            action={inviteCreatorAction} hidden={{ creatorId }} withTitle
            defaults={{ title: "", amount: "", deliverables: "" }} submitLabel="送出邀約" onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
