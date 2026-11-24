"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "./NavIcon";
import { isActive, type NavItem } from "./nav";

export function BottomTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="主選單"
      className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-line bg-surface px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-xs md:hidden"
    >
      {items.map((it) => {
        const base = "flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-nav px-3";
        if (!it.href) {
          return (
            <span key={it.label} className={`${base} text-muted opacity-60`}>
              <NavIcon name={it.icon} size={20} />
              <span>{it.label}</span><span className="sr-only">（即將推出）</span>
            </span>
          );
        }
        const active = isActive(it.href, pathname);
        return (
          <Link
            key={it.label}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`${base} ${active ? "bg-ink font-medium text-on-ink" : "text-ink"}`}
          >
            <NavIcon name={it.icon} size={20} />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
