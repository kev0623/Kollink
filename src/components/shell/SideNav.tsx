"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAME } from "@/lib/site";
import { NavIcon } from "./NavIcon";
import { UnreadBadge } from "./UnreadBadge";
import { isActive, type NavItem } from "./nav";

const itemBase = "flex h-[60px] w-16 flex-col items-center justify-center gap-1 rounded-nav px-1 text-center text-[11px] leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2";

export function SideNav({ items, footer }: { items: NavItem[]; footer?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <nav aria-label="主選單" className="sticky top-0 flex h-screen w-24 flex-col items-center bg-bg py-6">
      <p className="mb-6 text-sm font-bold tracking-tight text-ink">{SITE_NAME}</p>
      <ul className="flex flex-1 flex-col items-center gap-2 overflow-y-auto">
        {items.map((it) => {
          const active = it.href !== null && isActive(it.href, pathname);
          return (
            <li key={it.label}>
              {it.href ? (
                <Link
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={`${itemBase} ${active ? "bg-ink font-medium text-on-ink" : "text-ink hover:bg-line"}`}
                >
                  <span className="relative inline-flex">
                    <NavIcon name={it.icon} size={22} />
                    {it.badge === "messages" && <UnreadBadge />}
                  </span>
                  <span>{it.label}</span>
                </Link>
              ) : (
                <span className={`${itemBase} text-muted opacity-60`}>
                  <NavIcon name={it.icon} size={22} />
                  <span>{it.label}</span>
                  <span className="sr-only">（即將推出）</span>
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
