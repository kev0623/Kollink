import { ThemeSelect } from "@/components/theme/ThemeSelect";
import { SignOutButton } from "@/components/shell/SignOutButton";

/** 管理後台側邊欄底部：身分標籤、主題、登出（不讀 session，管理員不一定有 profile）。 */
export function AdminSideFooter() {
  return (
    <div className="flex w-full flex-col items-center gap-2 border-t border-line pt-3">
      <span className="text-[11px] font-bold text-muted">管理員</span>
      <ThemeSelect compact />
      <SignOutButton />
    </div>
  );
}
