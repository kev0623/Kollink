/** 骨架（規格 §9.8）：尺寸由 className 給，與實際版面一致。 */
export function Skeleton({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-input bg-subtle ${className}`} />;
}

/** 列表頁的骨架：頁首＋n 列。 */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true">
      <p className="sr-only">載入中…</p>
      <Skeleton className="h-8 w-40" />
      <div className="mt-6 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-4 md:px-5">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 表單頁的骨架：n 個「標籤＋輸入框」。外框與 cardPad 的表單卡片一致。 */
export function FormSkeleton({ fields = 4, steps = false }: { fields?: number; steps?: boolean }) {
  return (
    <div aria-busy="true" className="space-y-6">
      <p className="sr-only">載入中…</p>
      {steps && (
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11 w-32 shrink-0 rounded-btn md:w-full" />)}
        </div>
      )}
      <div className="space-y-5 rounded-card border border-line bg-surface p-5 md:p-8">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className={i === 1 ? "h-32 w-full" : "h-11 w-full"} />
          </div>
        ))}
        <Skeleton className="h-11 w-32 rounded-btn" />
      </div>
    </div>
  );
}

/** 詳情頁的骨架：標題、說明、進度條、內容卡。 */
export function DetailSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <p className="sr-only">載入中…</p>
      <div className="space-y-3">
        <Skeleton className="h-9 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-1/2 max-w-sm" />
      </div>
      <Skeleton className="h-16 w-full rounded-card" />
      <div className="space-y-3 rounded-card border border-line bg-surface p-5 md:p-8">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-11 w-40 rounded-btn" />
      </div>
    </div>
  );
}
