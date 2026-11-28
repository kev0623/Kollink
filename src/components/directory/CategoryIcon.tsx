import {
  Baby, Coffee, Dumbbell, Droplets, Home, LayoutGrid, PawPrint, Plane, Shirt, Smartphone, Sparkles, Utensils, type LucideIcon,
} from "lucide-react";

// 類別的圖示（首頁捷徑與 /creators 的類別列）。清單以外的值用通用圖示。
const ICONS: Record<string, LucideIcon> = {
  美妝: Sparkles, 保養: Droplets, 美食: Utensils, 旅遊: Plane, 寵物: PawPrint, "3C": Smartphone,
  親子: Baby, 穿搭: Shirt, 居家: Home, 運動: Dumbbell, 生活: Coffee,
};

/** category 為 null 代表「全部」。圖示只是裝飾，文字另外寫。 */
export function CategoryIcon({ category, size = 20 }: { category: string | null; size?: number }) {
  const Icon = category === null ? LayoutGrid : ICONS[category] ?? LayoutGrid;
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" />;
}
