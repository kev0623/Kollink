import Link from "next/link";
import { requireRole } from "@/lib/auth/current-user";
import { loadMyCollabsForTotals } from "@/lib/collabs/load";
import { loadHasPayoutAccount } from "@/lib/creators/payout-status";
import {
  BRAND_PAYMENTS_VIEWS, CREATOR_EARNINGS_VIEWS, brandPaymentsRows, creatorEarningsRows,
  parseBrandPaymentsView, parseCreatorEarningsView, summarizeBrandPayments, summarizeCreatorEarnings,
} from "@/lib/earnings";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { btn, textLink } from "@/components/ui/styles";
import { FilterEmpty, MoneyRows, SummaryCard, TruncatedNote, ViewChips } from "./EarningsParts";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** 創作者「收入」的內容（在 <Suspense> 內）：layout 的 Gate 在用戶端換頁時不會重跑，這裡自己 requireRole。 */
export async function CreatorEarningsSection({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireRole("creator");
  const view = parseCreatorEarningsView((await searchParams).view);
  const [{ items, maybeTruncated }, hasAccount] = await Promise.all([loadMyCollabsForTotals(), loadHasPayoutAccount(me.id)]);
  const s = summarizeCreatorEarnings(items);
  const all = creatorEarningsRows(items, "all");
  const shown = view === "all" ? all : creatorEarningsRows(items, view);

  return (
    <div>
      {all.length > 0 && (
        <>
          <SummaryCard
            label="收入摘要"
            figures={[
              { label: "已收到", amount: s.received, caption: "已完成合作的金額" },
              { label: "等待撥款", amount: s.awaiting, caption: "貼文發佈後，平台會以銀行轉帳撥款" },
              { label: "進行中", amount: s.inProgress, caption: "品牌已付款，還在交稿、審核或發佈" },
            ]}
          />
          {maybeTruncated && <TruncatedNote />}
        </>
      )}
      <div className="mt-4">
        {hasAccount ? (
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
            <span>收款帳戶已設定</span>
            <Link href="/creator/me/payout" className={textLink}>管理收款帳戶</Link>
          </p>
        ) : (
          <Notice tone="warning" title="還沒有收款帳戶，平台無法撥款給你">
            <p>填好帳戶後，合作完成就會撥款。只有你和平台看得到，品牌看不到。</p>
            <Link href="/creator/me/payout" className={`${btn.secondary} mt-3`}>設定收款帳戶</Link>
          </Notice>
        )}
      </div>
      {all.length === 0 ? (
        <div className="mt-6">
          <EmptyState text="還沒有收入紀錄" action={{ href: "/creator", label: "看看合作機會" }} />
        </div>
      ) : (
        <>
          <ViewChips basePath="/creator/earnings" views={CREATOR_EARNINGS_VIEWS} current={view} label="收入分類" />
          <MoneyRows side="creator" items={shown} empty={<FilterEmpty />} />
        </>
      )}
    </div>
  );
}

/** 品牌「付款紀錄」的內容（在 <Suspense> 內）。 */
export async function BrandPaymentsSection({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("brand");
  const view = parseBrandPaymentsView((await searchParams).view);
  const { items, maybeTruncated } = await loadMyCollabsForTotals();
  const s = summarizeBrandPayments(items);
  const all = brandPaymentsRows(items, "all");
  const shown = view === "all" ? all : brandPaymentsRows(items, view);

  if (all.length === 0) {
    return (
      <div>
        <Notice tone="info">目前付款由平台人工確認。發票功能尚未提供。</Notice>
        <div className="mt-6">
          <EmptyState text="還沒有付款紀錄" action={{ href: "/brand", label: "到創作者廣場找人" }} />
        </div>
      </div>
    );
  }
  return (
    <div>
      <SummaryCard
        label="付款摘要"
        figures={[
          { label: "已付款", amount: s.paid, caption: "平台已確認收到款項的合作案" },
          { label: "等待付款", amount: s.awaitingPayment, caption: "創作者已接受，等你付款" },
        ]}
      />
      {maybeTruncated && <TruncatedNote />}
      <Notice tone="info" className="mt-4">目前付款由平台人工確認。發票功能尚未提供。</Notice>
      <ViewChips basePath="/brand/payments" views={BRAND_PAYMENTS_VIEWS} current={view} label="付款分類" />
      <MoneyRows side="brand" items={shown} empty={<FilterEmpty />} />
    </div>
  );
}
