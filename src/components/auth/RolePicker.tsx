import Link from "next/link";

export function RolePicker({ hrefFor }: { hrefFor: (role: "brand" | "creator") => string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Link href={hrefFor("brand")} className="rounded-card border border-line bg-surface p-6 hover:border-ink">
        <p className="text-lg font-bold">我是品牌</p>
        <p className="mt-1 text-sm text-muted">找創作者、發出合作邀約</p>
      </Link>
      <Link href={hrefFor("creator")} className="rounded-card border border-line bg-surface p-6 hover:border-ink">
        <p className="text-lg font-bold">我是創作者</p>
        <p className="mt-1 text-sm text-muted">接品牌合作、款項平台託管</p>
      </Link>
    </div>
  );
}
