import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ThemeSelect } from "@/components/theme/ThemeSelect";
import { HelpLink } from "./HelpLink";
import { SignOutButton } from "./SignOutButton";

/** 側邊欄底部：頭像、角色、主題、協助、登出。會讀 session，所以頭像放在 <Suspense> 內。 */
export function SideFooter() {
  return (
    <div className="flex w-full flex-col items-center gap-2 border-t border-line pt-3">
      <Suspense fallback={<div aria-hidden="true" className="h-10 w-10 rounded-full bg-subtle" />}>
        <Who />
      </Suspense>
      <ThemeSelect compact />
      <HelpLink compact />
      <SignOutButton />
    </div>
  );
}

async function Who() {
  const me = await getCurrentUser();
  const name = me?.brand?.brandName ?? me?.profile?.displayName ?? "";
  const role = me?.profile?.role === "brand" ? "品牌" : "創作者";
  return (
    <div className="flex flex-col items-center gap-1">
      <div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full border border-thread bg-subtle text-base font-bold text-ink">
        {name.slice(0, 1)}
      </div>
      <span className="text-[11px] text-muted">{role}</span>
    </div>
  );
}
