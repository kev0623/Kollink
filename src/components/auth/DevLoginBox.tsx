import { isDevLoginEnabled } from "@/lib/auth/dev-login";
import { btn } from "@/components/ui/styles";

/** 只在本機開發顯示（見 isDevLoginEnabled）；其他環境不會輸出任何內容。 */
export function DevLoginBox() {
  if (!isDevLoginEnabled()) return null;
  return (
    <form method="post" action="/auth/dev-login" className="mt-6 rounded-card border border-dashed border-line p-4">
      <p className="mb-3 text-sm text-muted">測試快速登入（只在本機）</p>
      <div className="grid gap-2">
        <button type="submit" name="account" value="brand" className={`${btn.secondary} w-full whitespace-nowrap`}>測試品牌</button>
        <button type="submit" name="account" value="creator" className={`${btn.secondary} w-full whitespace-nowrap`}>測試創作者</button>
        <button type="submit" name="account" value="admin" className={`${btn.secondary} w-full whitespace-nowrap`}>測試管理員</button>
      </div>
    </form>
  );
}
