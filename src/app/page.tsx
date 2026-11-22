export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">Pollen</h1>
      <p className="mt-2 text-muted">品牌 × 創作者合作平台，即將推出。</p>
      <div className="mt-8 rounded-card bg-surface p-6 shadow-sm border border-line">
        <p className="font-bold text-primary">設計 token 檢查</p>
        <span className="mt-3 inline-block rounded-btn bg-primary px-4 py-2 font-bold text-white">
          主要按鈕
        </span>
        <span className="ml-2 inline-block rounded-full bg-success-soft px-3 py-1 text-sm text-success">
          ✓ 符合你的條件
        </span>
      </div>
    </main>
  );
}
