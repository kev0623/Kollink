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
