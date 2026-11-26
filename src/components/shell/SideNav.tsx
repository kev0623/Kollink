"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAME } from "@/lib/site";
import { NavIcon } from "./NavIcon";
import { UnreadBadge } from "./UnreadBadge";
import { isActive, type NavItem } from "./nav";

// 選中：subtle 底＋左側 3px 紅線（規格 §9.1；反白膠囊在深色下太亮）
const itemBase = "relative flex min-h-[60px] w-[72px] flex-col items-center justify-center gap-1 rounded-nav px-1 text-center text-[11px] leading-tight";
const activeCls = "bg-subtle font-bold text-ink before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-full before:bg-thread";

export function SideNav({ items, footer }: { items: NavItem[]; footer?: React.ReactNode }) {
  const pathname = usePathname();
  const home = items.find((i) => i.href)?.href ?? "/";
  return (
    <nav aria-label="主選單" className="sticky top-0 flex h-screen w-[88px] flex-col items-center border-r border-line bg-panel py-5">
      <Link href={home} className="mb-6 flex h-11 items-center gap-1.5 rounded-btn px-2 text-lg font-extrabold tracking-tight text-ink">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />K<span className="sr-only">{SITE_NAME}</span>
      </Link>
      <ul className="flex flex-1 flex-col items-center gap-1.5 overflow-y-auto">
        {items.map((it) => {
          const active = it.href !== null && isActive(it.href, pathname);
          return (
            <li key={it.label}>
              {it.href ? (
                <Link
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={`${itemBase} ${active ? activeCls : "text-muted hover:bg-subtle hover:text-ink"}`}
                >
                  <span className="relative inline-flex">
                    <NavIcon name={it.icon} size={22} />
                    {it.badge === "messages" && <UnreadBadge />}
                  </span>
                  <span>{it.label}</span>
                </Link>
              ) : (
                <span className={`${itemBase} text-muted opacity-50`}>
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
