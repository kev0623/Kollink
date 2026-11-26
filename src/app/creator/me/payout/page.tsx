import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/current-user";
import { formatDateTimeTw } from "@/lib/briefs/dates";
import { maskAccount } from "@/lib/payout-account";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { cardPad } from "@/components/ui/styles";
import { PayoutAccountForm } from "./PayoutAccountForm";

export const metadata: Metadata = { title: "收款帳戶" };

export default function CreatorPayoutPage() {
  return (
    <div>
      <PageHeader
        title="收款帳戶" back={{ href: "/creator/me", label: "我的" }}
        description="合作完成後，平台把款項轉到這個帳戶（全額，不收手續費）。只有你和平台看得到，品牌看不到。"
      />
      <Suspense fallback={<div className="space-y-6"><Skeleton className="h-40 max-w-2xl" /><Skeleton className="h-96 max-w-2xl" /></div>}>
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
    <div className="max-w-2xl space-y-6">
      {data ? (
        <dl className={`${cardPad} grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm`}>
          <dt className="text-muted">銀行代碼</dt><dd className="text-ink">{data.bank_code}{data.branch_code ? `（分行 ${data.branch_code}）` : ""}</dd>
          <dt className="text-muted">帳號</dt><dd className="font-mono text-ink">{maskAccount(data.account_last4 ?? "")}</dd>
          <dt className="text-muted">戶名</dt><dd className="min-w-0 break-words text-ink">{data.account_name}</dd>
          <dt className="text-muted">更新時間</dt><dd className="text-ink">{data.updated_at ? formatDateTimeTw(data.updated_at) : "—"}</dd>
        </dl>
      ) : (
        <Notice tone="warning" title="還沒填收款帳戶">沒有帳戶時平台無法撥款。</Notice>
      )}
      <PayoutAccountForm hasAccount={data !== null} />
    </div>
  );
}
