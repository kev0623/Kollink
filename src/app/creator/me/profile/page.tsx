import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "公開頁" };

/** 公開頁編輯已併入「我的」（QA m12）。 */
export default function CreatorProfileEditPage() {
  return (
    <Suspense fallback={null}>
      <Go />
    </Suspense>
  );
}

async function Go(): Promise<null> {
  await requireRole("creator");
  redirect("/creator/me#profile");
}
