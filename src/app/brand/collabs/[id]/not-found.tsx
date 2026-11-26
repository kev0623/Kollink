import Link from "next/link";
import { ThreadMark } from "@/components/ui/ThreadMark";
import { btn, h1 } from "@/components/ui/styles";

export default function CollabNotFound() {
  return (
    <div className="mx-auto mt-6 flex max-w-md flex-col items-center rounded-card border border-line bg-surface p-8 text-center">
      <ThreadMark variant="broken" />
      <h1 className={`${h1} mt-4`}>找不到這個合作案</h1>
      <p className="mt-2 text-sm text-muted">連結可能有誤，或你不是這個合作案的參與者。</p>
      <Link href="/brand/collabs" className={`${btn.primary} mt-6`}>回合作案列表</Link>
    </div>
  );
}
