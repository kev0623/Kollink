import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { isDevLoginEnabled } from "@/lib/auth/dev-login";
import { paymentAvailability } from "@/lib/payments/config";
import { isUuid } from "@/lib/briefs/query";
import { loadCollabDetail, loadMyCollabs } from "@/lib/collabs/load";
import { nowMs, parseCollabTab, type CollabSide } from "@/lib/collabs/view";
import { CollabDetail } from "./CollabDetail";
import { CollabList, CollabTabs } from "./CollabList";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** 列表頁的內容（在 <Suspense> 內）：layout 的 Gate 在用戶端換頁時不會重跑，這裡自己 requireRole。 */
export async function CollabListSection({ side, searchParams }: { side: CollabSide; searchParams: SearchParams }) {
  await requireRole(side);
  const tab = parseCollabTab((await searchParams).tab);
  const items = await loadMyCollabs(tab);
  return (
    <div>
      <CollabTabs side={side} tab={tab} />
      <CollabList side={side} tab={tab} items={items} />
    </div>
  );
}

/** 詳情頁的內容（在 <Suspense> 內）。不是參與者、不是這一區的視角、id 不是 UUID：一律 notFound()（soft 404）。 */
export async function CollabDetailSection({ side, params }: { side: CollabSide; params: Promise<{ id: string }> }) {
  const me = await requireRole(side);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await loadCollabDetail(id);
  if (!data || data.collab.side !== side) notFound();
  // requireRole 之後才能讀現在時間（getCurrentUser 已 await connection()）
  return (
    <CollabDetail
      data={data} side={side} uid={me.id} nowMs={nowMs()}
      devPaymentEnabled={isDevLoginEnabled()} payment={paymentAvailability()}
    />
  );
}

export function CollabListSkeleton() {
  return (
    <div aria-busy="true">
      <p className="sr-only">載入中…</p>
      <div className="h-9 w-64 rounded-full bg-surface" />
      <div className="mt-4 h-48 rounded-card border border-line bg-surface" />
    </div>
  );
}
