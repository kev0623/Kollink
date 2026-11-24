"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, type NavItem } from "./nav";

export function BottomTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="主選單"
      className="fixed inset-x-0 bottom-0 flex justify-around border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] text-xs md:hidden"
    >
      {items.map((it) => {
        if (!it.href) {
          return (
            <span key={it.label} className="flex min-h-11 min-w-11 items-center justify-center px-2 text-muted opacity-60">
              {it.label}<span className="sr-only">（即將推出）</span>
            </span>
          );
        }
        const active = isActive(it.href, pathname);
        return (
          <Link
            key={it.label}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 min-w-11 items-center justify-center px-2 ${active ? "font-bold text-primary" : ""}`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
