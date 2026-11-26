import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { formatDateTimeTw } from "@/lib/briefs/dates";
import { maskAccount } from "@/lib/payout-account";
import { createClient } from "@/lib/supabase/server";
import { PayoutAccountForm } from "./PayoutAccountForm";

export default function CreatorPayoutPage() {
  return (
    <div>
      <Link href="/creator/me" className="text-sm text-muted">← 我的</Link>
      <h1 className="mt-2 text-[32px] font-bold text-ink">收款帳戶</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        合作完成後，平台把款項轉到這個帳戶（全額，不收手續費）。只有你和平台看得到，品牌看不到。
      </p>
      <Suspense fallback={<p className="mt-6 text-muted">載入中…</p>}>
        <Section />
      </Suspense>
    </div>
  );
}

async function Section() {
  const me = await requireRole("creator");
  const supabase = await createClient();
  // 完整帳號不開放讀取（欄位權限）；這裡只拿得到末四碼
  const { data, error } = await supabase.from("creator_payout_accounts")
    .select("bank_code, branch_code, account_last4, account_name, updated_at")
    .eq("user_id", me.id).maybeSingle();
  if (error) throw error;
  return (
    <div className="mt-6 space-y-6">
      {data ? (
        <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-card border border-line bg-surface p-5 text-sm">
          <dt className="text-muted">銀行代碼</dt><dd>{data.bank_code}{data.branch_code ? `（分行 ${data.branch_code}）` : ""}</dd>
          <dt className="text-muted">帳號</dt><dd className="font-mono">{maskAccount(data.account_last4 ?? "")}</dd>
          <dt className="text-muted">戶名</dt><dd className="min-w-0 break-words">{data.account_name}</dd>
          <dt className="text-muted">更新時間</dt><dd>{data.updated_at ? formatDateTimeTw(data.updated_at) : "—"}</dd>
        </dl>
      ) : (
        <p className="max-w-xl rounded-card border border-line bg-surface p-5 text-sm text-ink">還沒填收款帳戶。沒有帳戶時平台無法撥款。</p>
      )}
      <PayoutAccountForm hasAccount={data !== null} />
    </div>
  );
}
