"use client";

import Link from "next/link";
import { closeBriefAction, deleteBriefAction } from "@/app/brand/briefs/actions";
import type { BriefDisplayStatus } from "@/lib/briefs/view";
import { btn } from "@/components/ui/styles";
import { ConfirmAction } from "./ConfirmAction";

/** 招募詳情上方的按鈕：草稿（編輯、發佈、刪除）、發佈中（編輯、關閉）；已結束沒有按鈕。 */
export function BriefOwnerActions({ briefId, display }: { briefId: string; display: BriefDisplayStatus }) {
  if (display === "draft") {
    return (
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-start">
        <Link href={`/brand/briefs/${briefId}/edit?step=1`} className={`${btn.secondary} w-full sm:w-auto`}>編輯</Link>
        <Link href={`/brand/briefs/${briefId}/edit?step=4`} className={`${btn.primary} w-full sm:w-auto`}>發佈</Link>
        <ConfirmAction
          label="刪除草稿" danger icon="trash" confirmLabel="確定刪除"
          message="刪除後無法復原，確定要刪除這則草稿嗎？"
          onConfirm={() => deleteBriefAction(briefId)}
        />
      </div>
    );
  }
  if (display === "open") {
    return (
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-start">
        <Link href={`/brand/briefs/${briefId}/edit?step=1`} className={`${btn.secondary} w-full sm:w-auto`}>編輯</Link>
        <ConfirmAction
          label="關閉招募" danger icon="ban" confirmLabel="確定關閉"
          message="關閉後創作者就看不到這則招募，也不能再報名；已報名的紀錄會保留，仍可以錄取或婉拒。關閉後不能重新開啟。"
          onConfirm={() => closeBriefAction(briefId)}
        />
      </div>
    );
  }
  return null;
}
