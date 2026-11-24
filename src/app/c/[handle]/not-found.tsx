import Link from "next/link";

export default function CreatorNotFound() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-card border border-line bg-surface p-8 text-center">
      <h1 className="text-xl font-bold text-ink">找不到這位創作者</h1>
      <p className="mt-2 text-sm text-muted">網址可能有誤，或這個頁面還沒有公開。</p>
      <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-btn bg-ink px-6 font-semibold text-on-ink">回首頁</Link>
    </div>
  );
}
