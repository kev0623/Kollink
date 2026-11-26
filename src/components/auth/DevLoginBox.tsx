import { isDevLoginEnabled } from "@/lib/auth/dev-login";

/** 只在本機開發顯示（見 isDevLoginEnabled）；其他環境不會輸出任何內容。 */
export function DevLoginBox() {
  if (!isDevLoginEnabled()) return null;
  return (
    <form method="post" action="/auth/dev-login" className="mt-6 rounded-card border border-dashed border-line p-4">
      <p className="mb-3 text-sm text-muted">測試快速登入（只在本機）</p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="account" value="brand" className="h-11 flex-1 rounded-btn border border-line bg-surface px-4 font-semibold text-ink">
          測試品牌
        </button>
        <button type="submit" name="account" value="creator" className="h-11 flex-1 rounded-btn border border-line bg-surface px-4 font-semibold text-ink">
          測試創作者
        </button>
        <button type="submit" name="account" value="admin" className="h-11 flex-1 rounded-btn border border-line bg-surface px-4 font-semibold text-ink">
          測試管理員
        </button>
      </div>
    </form>
  );
}
