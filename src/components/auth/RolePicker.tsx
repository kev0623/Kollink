import Link from "next/link";
import { Building2, Sparkles } from "lucide-react";

const card = "flex min-h-11 items-start gap-4 rounded-card border border-line-strong bg-surface p-5 hover:border-thread hover:bg-subtle";

export function RolePicker({ hrefFor }: { hrefFor: (r: "brand" | "creator") => string }) {
  return (
    <div className="grid gap-3">
      <Link href={hrefFor("brand")} className={card}>
        <Building2 size={24} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
        <span>
          <span className="block text-lg font-bold text-ink">我是品牌</span>
          <span className="mt-1 block text-sm text-muted">找創作者、刊登招募、付款與追蹤合作進度。</span>
        </span>
      </Link>
      <Link href={hrefFor("creator")} className={card}>
        <Sparkles size={24} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
        <span>
          <span className="block text-lg font-bold text-ink">我是創作者</span>
          <span className="mt-1 block text-sm text-muted">建立公開頁、接品牌合作、完成後收款。</span>
        </span>
      </Link>
    </div>
  );
}
