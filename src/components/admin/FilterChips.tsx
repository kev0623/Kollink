import Link from "next/link";

/** 篩選標籤（連結，寫進網址）。選到的那個 aria-current="page"。 */
export function FilterChips<T extends string>({ label, options, current, hrefFor }: {
  label: string; options: { value: T; label: string }[]; current: T; hrefFor: (v: T) => string;
}) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-2">
        {options.map((o) => {
          const active = o.value === current;
          return (
            <li key={o.value}>
              <Link
                href={hrefFor(o.value)} aria-current={active ? "page" : undefined}
                className={`inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${active ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-ink"}`}
              >
                {o.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
