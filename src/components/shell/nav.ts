/** 圖示用名稱而不是元件：導覽資料從伺服器元件傳到客戶端元件，函式不能跨過去。 */
export type NavIconName = "Compass" | "FileText" | "Handshake" | "MessageCircle" | "Receipt" | "Settings" | "Sparkles" | "Wallet" | "UserRound";

export type NavItem = { label: string; href: string | null; icon: NavIconName }; // href 為 null 代表「即將推出」

export const BRAND_NAV: NavItem[] = [
  { label: "創作者廣場", href: "/brand", icon: "Compass" },
  { label: "我的招募", href: null, icon: "FileText" },
  { label: "合作案", href: null, icon: "Handshake" },
  { label: "訊息", href: null, icon: "MessageCircle" },
  { label: "付款與發票", href: null, icon: "Receipt" },
  { label: "設定", href: "/brand/settings", icon: "Settings" },
];

export const CREATOR_NAV: NavItem[] = [
  { label: "機會", href: "/creator", icon: "Sparkles" },
  { label: "合作", href: null, icon: "Handshake" },
  { label: "訊息", href: null, icon: "MessageCircle" },
  { label: "收入", href: null, icon: "Wallet" },
  { label: "我的", href: "/creator/me", icon: "UserRound" },
];

/** 目前路徑是否屬於這個項目；首頁（/brand、/creator）只比對完全相同，避免子頁面時首頁也亮起。 */
export function isActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  if (href === "/brand" || href === "/creator") return false;
  return pathname.startsWith(`${href}/`);
}
