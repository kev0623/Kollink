export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs text-primary">{error}</span>}
    </label>
  );
}

export const inputClass = "w-full rounded-btn border border-line bg-surface px-3 py-2";
