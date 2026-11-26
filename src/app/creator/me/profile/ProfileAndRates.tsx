"use client";

import { useState } from "react";
import type { Rate } from "@/lib/creators/view";
import type { OwnPublicProfile } from "@/lib/creators/own-profile";
import { PublicProfileForm } from "./PublicProfileForm";
import { RatesForm } from "./RatesForm";

/**
 * 公開頁與報價同一段（QA m12）：PublicProfileForm 勾選合作形式時回報目前勾選（live），
 * RatesForm 依 live 顯示欄位；已儲存的形式（saved）才能填（資料庫依已儲存的合作形式檢查報價）。
 */
export function ProfileAndRates({ userId, displayName, profile, rates }: {
  userId: string; displayName: string; profile: OwnPublicProfile["profile"]; rates: Rate[];
}) {
  const [live, setLive] = useState<string[]>(profile.collabTypes);
  return (
    <div className="space-y-4">
      <PublicProfileForm userId={userId} displayName={displayName} initial={profile} onCollabTypesChange={setLive} />
      <RatesForm collabTypes={live} savedCollabTypes={profile.collabTypes} initial={rates} />
    </div>
  );
}
