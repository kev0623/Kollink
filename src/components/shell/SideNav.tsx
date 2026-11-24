"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAME } from "@/lib/site";
import { isActive, type NavItem } from "./nav";

export function SideNav({ items, footer }: { items: NavItem[]; footer?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <nav aria-label="主選單" className="flex h-full w-56 flex-col border-r border-line bg-surface p-4">
      <p className="mb-6 text-lg font-bold">{SITE_NAME}</p>
      <ul className="flex-1 space-y-1">
        {items.map((it) => {
          const active = it.href !== null && isActive(it.href, pathname);
          return (
            <li key={it.label}>
              {it.href ? (
                <Link
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-btn px-3 hover:bg-primary-soft ${active ? "bg-primary-soft font-bold text-primary" : ""}`}
                >
                  {it.label}
                </Link>
              ) : (
                <span className="flex min-h-11 items-center justify-between px-3 text-muted">
                  {it.label}<span className="text-xs">即將推出</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {footer}
    </nav>
  );
}
