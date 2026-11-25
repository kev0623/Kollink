import { requireRole } from "@/lib/auth/current-user";
import { loadMyCollabs } from "@/lib/collabs/load";
import { parseCollabTab, type CollabSide } from "@/lib/collabs/view";
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

export function CollabListSkeleton() {
  return (
    <div aria-busy="true">
      <p className="sr-only">載入中…</p>
      <div className="h-9 w-64 rounded-full bg-surface" />
      <div className="mt-4 h-48 rounded-card border border-line bg-surface" />
    </div>
  );
}
