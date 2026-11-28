"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { LangToggle } from "@/components/i18n/LangToggle";
import { T } from "@/components/i18n/T";
import { useLang } from "@/components/i18n/useLang";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NAV_GROUPS, NAV_LINKS } from "@/lib/site-nav";

const item = "inline-flex h-11 items-center gap-1 rounded-btn px-3 text-sm font-bold text-ink hover:bg-subtle outline-none focus-visible:ring-2 focus-visible:ring-focus";

/**
 * 頂列的主導覽。桌面：兩個下拉選單（功能、適合誰）加上直接連結；手機：一顆選單按鈕展開全部。
 * 一次只開一個；按 Esc、點外面、點選單裡的連結都會關。account 是伺服器渲染的登入／進入後台（會讀 session）。
 */
export function SiteNav({ account }: { account: React.ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const lang = useLang();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const which = open;
      setOpen(null);
      root.current?.querySelector<HTMLButtonElement>(`[data-nav="${which}"]`)?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const toggle = (key: string) => setOpen((cur) => (cur === key ? null : key));

  return (
    <div ref={root} className="flex min-w-0 flex-1 items-center justify-end gap-1 lg:justify-between lg:gap-3">
      <nav aria-label={lang === "en" ? "Main" : "主要"} className="hidden items-center gap-1 lg:ml-6 lg:flex">
        {NAV_GROUPS.map((g) => (
          <div key={g.key} className="relative">
            <button
              type="button" data-nav={g.key} aria-expanded={open === g.key} aria-controls={`nav-${g.key}`}
              onClick={() => toggle(g.key)} className={item}
            >
              <T {...g.label} />
              <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className={`transition-transform ${open === g.key ? "rotate-180" : ""}`} />
            </button>
            {open === g.key && (
              <ul id={`nav-${g.key}`} className="absolute left-0 top-full z-20 mt-3 w-[300px] origin-top-left rounded-card border border-line bg-surface p-2 elev-pop motion-safe:animate-[fade-in_140ms_ease-out]">
                {g.items.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} onClick={() => setOpen(null)} className="block rounded-input px-3 py-2.5 outline-none hover:bg-subtle focus-visible:ring-2 focus-visible:ring-focus">
                      <span className="block text-sm font-bold text-ink"><T {...it.label} /></span>
                      {it.note && <span className="mt-0.5 block text-xs text-muted"><T {...it.note} /></span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={pathname === l.href ? "page" : undefined} className={item}><T {...l.label} /></Link>
        ))}
      </nav>

      <div className="flex items-center gap-1 sm:gap-2">
        <div className="flex items-center">
          <ThemeToggle />
          <LangToggle />
        </div>
        {account}
        <Link href="/signup" className="hidden h-11 items-center rounded-btn bg-primary px-5 text-sm font-bold text-on-primary hover:bg-primary-hover sm:inline-flex"><T zh="免費註冊" en="Sign up free" /></Link>
        <button
          type="button" data-nav="mobile" aria-expanded={open === "mobile"} aria-controls="nav-mobile"
          onClick={() => toggle("mobile")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-btn text-ink hover:bg-subtle outline-none focus-visible:ring-2 focus-visible:ring-focus lg:hidden"
        >
          {open === "mobile" ? <X size={22} strokeWidth={1.5} aria-hidden="true" /> : <Menu size={22} strokeWidth={1.5} aria-hidden="true" />}
          <span className="sr-only">{open === "mobile" ? (lang === "en" ? "Close menu" : "關閉選單") : (lang === "en" ? "Open menu" : "開啟選單")}</span>
        </button>
      </div>

      {open === "mobile" && (
        <nav id="nav-mobile" aria-label={lang === "en" ? "Main" : "主要"} className="absolute inset-x-0 top-full z-20 mt-2 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-[22px] border border-line bg-surface px-5 py-4 elev-pop lg:hidden">
          {NAV_GROUPS.map((g) => (
            <div key={g.key} className="border-b border-line pb-3 pt-1">
              <p className="py-2 text-xs font-bold text-muted"><T {...g.label} /></p>
              <ul>
                {g.items.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} onClick={() => setOpen(null)} className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-base font-bold text-ink">
                      <span className="shrink-0"><T {...it.label} /></span>
                      {it.note && <span className="min-w-0 truncate text-xs font-normal text-muted"><T {...it.note} /></span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <ul className="pt-2">
            {NAV_LINKS.map((l) => (
              <li key={l.href}><Link href={l.href} onClick={() => setOpen(null)} className="flex min-h-11 items-center text-base font-bold text-ink"><T {...l.label} /></Link></li>
            ))}
            <li className="pt-3 sm:hidden"><Link href="/signup" onClick={() => setOpen(null)} className="flex h-11 items-center justify-center rounded-btn bg-primary font-bold text-on-primary"><T zh="免費註冊" en="Sign up free" /></Link></li>
          </ul>
        </nav>
      )}
    </div>
  );
}
