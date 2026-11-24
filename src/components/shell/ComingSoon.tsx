export function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-[32px] font-bold text-ink">{title}</h1>
      <div className="mt-6 rounded-card border border-line bg-surface p-8 text-center">
        <p className="text-muted">即將推出</p>
      </div>
    </div>
  );
}
