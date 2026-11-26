import { SignOutButton } from "@/components/shell/SignOutButton";

/** 管理後台側邊欄底部：身分標籤與登出（不讀 session，管理員不一定有 profile）。 */
export function AdminSideFooter() {
  return (
    <div className="flex flex-col items-center gap-2 pt-4">
      <span className="rounded-btn bg-ink px-2 py-0.5 text-xs font-medium text-on-ink">管理員</span>
      <SignOutButton />
    </div>
  );
}
