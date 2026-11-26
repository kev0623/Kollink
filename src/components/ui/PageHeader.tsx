import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { h1 } from "./styles";

/** 頁首（規格 §9.2）：返回連結（44px）、h1（serif）、說明、最多一個主要動作。 */
export function PageHeader({ title, back, description, action, tight }: {
  title: string; back?: { href: string; label: string }; description?: React.ReactNode; action?: React.ReactNode;
  /** 下面緊接著一排動作按鈕時：縮小下方間距 */
  tight?: boolean;
}) {
  return (
    <div className={tight ? "mb-3 md:mb-4" : "mb-6 md:mb-8"}>
      {back && (
        <Link href={back.href} className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-btn px-2 text-sm text-muted hover:text-ink">
          <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />{back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={`${h1} break-words`}>{title}</h1>
          {description && <div className="mt-2 max-w-2xl text-sm text-muted">{description}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
