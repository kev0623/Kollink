import Link from "next/link";
import type { NavItem } from "./nav";

export function BottomTabBar({ items }: { items: NavItem[] }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t border-line bg-surface py-2 text-xs md:hidden">
      {items.map((it) =>
        it.href ? (
          <Link key={it.label} href={it.href} className="px-2 py-1">{it.label}</Link>
        ) : (
          <span key={it.label} className="px-2 py-1 text-muted opacity-60">{it.label}</span>
        ),
      )}
    </nav>
  );
}
