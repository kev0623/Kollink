import { brandLogoUrl } from "@/lib/brand-logo";
import { briefCoverUrl } from "@/lib/brief-cover";
import { initialOf } from "@/lib/format";

/** 封面圖（2:1）；沒有封面時顯示品牌 Logo，再沒有就顯示品牌名稱第一個字。 */
export function BriefCover({ coverPath, brandName, brandLogoPath, className = "" }: {
  coverPath: string | null; brandName: string; brandLogoPath: string | null; className?: string;
}) {
  const cover = briefCoverUrl(coverPath);
  const logo = brandLogoUrl(brandLogoPath);
  return (
    <div className={`relative aspect-[2/1] overflow-hidden bg-primary-soft ${className}`}>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" loading="lazy" className="absolute inset-0 m-auto h-1/2 w-1/2 object-contain" />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-4xl font-semibold text-muted">
          {initialOf(brandName)}
        </div>
      )}
    </div>
  );
}
