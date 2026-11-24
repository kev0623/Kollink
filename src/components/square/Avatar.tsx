import { creatorMediaUrl } from "@/lib/creator-media";
import { initialOf } from "@/lib/format";

const SIZE = { sm: "h-9 w-9 text-sm", md: "h-12 w-12 text-lg" } as const;

/** 頭像；沒上傳時顯示名字第一個字。 */
export function Avatar({ path, name, size }: { path: string | null; name: string; size: keyof typeof SIZE }) {
  const url = creatorMediaUrl(path);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${SIZE[size]} shrink-0 rounded-full border border-line object-cover`} />;
  }
  return (
    <div aria-hidden="true" className={`${SIZE[size]} flex shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-on-ink`}>
      {initialOf(name)}
    </div>
  );
}
