import Link from "next/link";
import { chip } from "@/components/ui/styles";

/** 篩選標籤（連結，寫進網址）。選到的那個 aria-current="page"。 */
export function FilterChips<T extends string>({ label, options, current, hrefFor }: {
  label: string; options: { value: T; label: string }[]; current: T; hrefFor: (v: T) => string;
}) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-2 md:w-auto md:flex-wrap">
        {options.map((o) => {
          const active = o.value === current;
          return (
            <li key={o.value}>
              <Link href={hrefFor(o.value)} aria-current={active ? "page" : undefined} className={chip(active)}>
                {o.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
