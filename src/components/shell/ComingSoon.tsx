export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-8 text-center shadow-sm">
      <p className="text-lg font-bold">{title}</p>
      <p className="mt-2 text-muted">即將推出</p>
    </div>
  );
}
