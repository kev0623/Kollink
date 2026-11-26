import Link from "next/link";
import { ThreadMark } from "@/components/ui/ThreadMark";
import { btn, h1 } from "@/components/ui/styles";

/** 招募關閉、過期、還是草稿或不存在：創作者看不到內容（RLS），一律說「已結束或不存在」。 */
export default function BriefNotFound() {
  return (
    <div className="mx-auto mt-6 flex max-w-md flex-col items-center rounded-card border border-line bg-surface p-8 text-center">
      <ThreadMark variant="broken" />
      <h1 className={`${h1} mt-4`}>這則招募已結束或不存在</h1>
      <p className="mt-2 text-sm text-muted">品牌可能已經關閉招募，或連結有誤。看看其他正在招募的機會吧。</p>
      <Link href="/creator" className={`${btn.primary} mt-6`}>看其他機會</Link>
    </div>
  );
}
