import Link from "next/link";
import { ThreadMark } from "@/components/ui/ThreadMark";
import { btn, h1 } from "@/components/ui/styles";

export default function CreatorNotFound() {
  return (
    <div className="mx-auto mt-10 flex max-w-md flex-col items-center rounded-card border border-line bg-surface p-8 text-center">
      <ThreadMark variant="broken" />
      <h1 className={`${h1} mt-4`}>找不到這位創作者</h1>
      <p className="mt-2 text-sm text-muted">網址可能有誤，或這個頁面還沒有公開。</p>
      <Link href="/" className={`${btn.primary} mt-6`}>回首頁</Link>
    </div>
  );
}
