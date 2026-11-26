import { BrandMark } from "@/components/briefs/BrandMark";
import { Avatar } from "@/components/square/Avatar";
import type { CollabSide } from "@/lib/collabs/view";

/** 對方的頭像：品牌視角看到創作者頭像（creator-media），創作者視角看到品牌 Logo（brand-logos）。 */
export function Counterpart({ side, name, imagePath }: { side: CollabSide; name: string; imagePath: string | null }) {
  return side === "brand"
    ? <Avatar path={imagePath} name={name} size="md" />
    : <BrandMark name={name} logoPath={imagePath} size="md" />;
}
