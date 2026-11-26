import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { SUPPORT_PAGE } from "@/lib/site";

/** 側欄／帳號頁的「需要協助」（QA M4）。 */
export function HelpLink({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href={SUPPORT_PAGE}
      className={compact
        ? "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-nav px-2 text-[11px] text-muted hover:bg-subtle hover:text-ink"
        : "inline-flex min-h-11 items-center gap-1.5 rounded-btn px-3 text-sm text-muted hover:bg-subtle hover:text-ink"}
    >
      <LifeBuoy size={compact ? 18 : 16} strokeWidth={1.5} aria-hidden="true" />
      {compact ? "協助" : "需要協助"}
    </Link>
  );
}
