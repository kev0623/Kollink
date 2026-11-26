"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "./NavIcon";
import { UnreadBadge } from "./UnreadBadge";
import { isActive, type NavItem } from "./nav";

export function BottomTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="主選單"
      className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-surface px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] text-[11px] md:hidden"
    >
      {items.filter((it) => it.href).map((it) => {
        const href = it.href as string;
        const active = isActive(href, pathname);
        return (
          <Link
            key={it.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-14 min-w-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 ${
              active ? "font-bold text-ink before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:rounded-full before:bg-thread" : "text-muted"
            }`}
          >
            <span className="relative inline-flex">
              <NavIcon name={it.icon} size={22} />
              {it.badge === "messages" && <UnreadBadge />}
            </span>
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
