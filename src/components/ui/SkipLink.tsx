/** 「跳到主要內容」（QA p4）：聚焦時才出現。目標是殼的 <main id="main" tabIndex={-1}>。 */
export function SkipLink() {
  return (
    <a href="#main" className="sr-only z-50 rounded-btn bg-surface px-4 py-3 font-bold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
      跳到主要內容
    </a>
  );
}
