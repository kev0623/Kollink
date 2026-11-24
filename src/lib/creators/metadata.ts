import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import { formatNumber } from "@/lib/format";
import type { PublicCreator } from "./view";

const NOINDEX = { index: false, follow: false } as const;

/** 公開頁的 metadata。null（不存在或未公開）時不帶任何創作者資料。 */
export function profileMetadata(c: PublicCreator | null): Metadata {
  if (!c) return { title: `找不到這個頁面｜${SITE_NAME}`, robots: NOINDEX };
  const title = `${c.displayName}（@${c.handle}）｜${SITE_NAME}`;
  const description = [c.region, c.categories.join("、"), `IG 粉絲 ${formatNumber(c.followerCount)}`]
    .filter((s) => s)
    .join("・");
  const base: Metadata = { title, description, openGraph: { title, description, type: "profile" } };
  // 能拿到未審核的資料只有本人預覽一種情況
  return c.status === "approved" ? base : { ...base, robots: NOINDEX };
}
