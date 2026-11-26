/** 段落標題旁的「尚未儲存」：點＋文字，不只靠顏色。 */
export function UnsavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-xs font-bold text-accent">
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />尚未儲存
    </span>
  );
}

/** 儲存成功的訊息：圖示＋文字。呼叫端負責在有新變更時隱藏它。 */
export function SavedMark({ show, children = "已儲存" }: { show: boolean; children?: React.ReactNode }) {
  if (!show) return null;
  return (
    <p role="status" className="inline-flex items-center gap-1.5 text-sm font-bold text-success">
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 10.5l3.5 3.5 7.5-8" /></svg>
      {children}
    </p>
  );
}
