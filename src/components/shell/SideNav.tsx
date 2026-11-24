import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import type { NavItem } from "./nav";

export function SideNav({ items, footer }: { items: NavItem[]; footer?: React.ReactNode }) {
  return (
    <nav className="flex h-full w-56 flex-col border-r border-line bg-surface p-4">
      <p className="mb-6 text-lg font-bold">{SITE_NAME}</p>
      <ul className="flex-1 space-y-1">
        {items.map((it) => (
          <li key={it.label}>
            {it.href ? (
              <Link href={it.href} className="block rounded-btn px-3 py-2 hover:bg-primary-soft">{it.label}</Link>
            ) : (
              <span className="flex items-center justify-between px-3 py-2 text-muted">
                {it.label}<span className="text-xs">即將推出</span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {footer}
    </nav>
  );
}
