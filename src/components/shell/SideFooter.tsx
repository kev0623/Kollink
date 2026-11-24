import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SignOutButton } from "./SignOutButton";

/** 側邊欄底部：頭像、角色、登出。會讀 session，所以放在 <Suspense> 內。 */
export function SideFooter() {
  return (
    <Suspense fallback={<div className="h-12 w-12 rounded-full bg-line" />}>
      <Who />
    </Suspense>
  );
}

async function Who() {
  const me = await getCurrentUser();
  const name = me?.brand?.brandName ?? me?.profile?.displayName ?? "";
  const role = me?.profile?.role === "brand" ? "品牌" : "創作者";
  return (
    <div className="flex flex-col items-center gap-2 pt-4">
      <div
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-lg font-semibold text-on-ink"
      >
        {name.slice(0, 1)}
      </div>
      <span className="rounded-btn bg-ink px-2 py-0.5 text-xs font-medium text-on-ink">{role}</span>
      <SignOutButton />
    </div>
  );
}
