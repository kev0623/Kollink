import type { Metadata } from "next";
import Link from "next/link";
import { ThreadMark } from "@/components/ui/ThreadMark";
import { BackToConsole } from "@/components/ui/BackToConsole";
import { btn, h1 } from "@/components/ui/styles";

export const metadata: Metadata = { title: "找不到這一頁" };

/** 全站 404（規格 §9.14）。不在伺服器讀 session（not-found 可能在任何層級渲染）；已登入者的「回後台」由 BackToConsole 在瀏覽器端判斷。 */
export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <ThreadMark variant="broken" />
      <h1 className={`${h1} mt-6`}>這一頁不存在</h1>
      <p className="mt-3 text-sm text-muted">網址可能打錯了，或這個頁面已經移除。</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={btn.primary}>回首頁</Link>
        <Link href="/help" className={btn.secondary}>需要協助</Link>
        <BackToConsole />
      </div>
    </main>
  );
}
