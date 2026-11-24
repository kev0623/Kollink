import { brandLogoUrl } from "@/lib/brand-logo";
import { initialOf } from "@/lib/format";

const SIZE = { sm: "h-8 w-8 text-sm", md: "h-10 w-10 text-base" } as const;

/** 品牌 Logo；沒有時顯示品牌名稱第一個字。 */
export function BrandMark({ name, logoPath, size }: { name: string; logoPath: string | null; size: keyof typeof SIZE }) {
  const url = brandLogoUrl(logoPath);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${SIZE[size]} shrink-0 rounded-btn border border-line bg-surface object-contain`} />;
  }
  return (
    <div aria-hidden="true" className={`${SIZE[size]} flex shrink-0 items-center justify-center rounded-btn bg-ink font-semibold text-on-ink`}>
      {initialOf(name)}
    </div>
  );
}
