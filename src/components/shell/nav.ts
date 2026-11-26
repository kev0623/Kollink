/** 圖示用名稱而不是元件：導覽資料從伺服器元件傳到客戶端元件，函式不能跨過去。 */
export type NavIconName =
  | "Compass" | "FileText" | "Handshake" | "MessageCircle" | "Receipt" | "Settings" | "Sparkles" | "Wallet" | "UserRound"
  | "LayoutDashboard" | "UserCheck" | "Banknote" | "ShieldAlert";

/** href 為 null 代表「即將推出」；badge 為 "messages" 時在圖示右上角顯示未讀對話數（計畫 7）。 */
export type NavItem = { label: string; href: string | null; icon: NavIconName; badge?: "messages" };

export const BRAND_NAV: NavItem[] = [
  { label: "創作者廣場", href: "/brand", icon: "Compass" },
  { label: "我的招募", href: "/brand/briefs", icon: "FileText" },
  { label: "合作案", href: "/brand/collabs", icon: "Handshake" },
  { label: "訊息", href: "/brand/messages", icon: "MessageCircle", badge: "messages" },
  { label: "付款與發票", href: null, icon: "Receipt" },
  { label: "設定", href: "/brand/settings", icon: "Settings" },
];

export const CREATOR_NAV: NavItem[] = [
  { label: "機會", href: "/creator", icon: "Sparkles" },
  { label: "合作", href: "/creator/collabs", icon: "Handshake" },
  { label: "訊息", href: "/creator/messages", icon: "MessageCircle", badge: "messages" },
  { label: "收入", href: null, icon: "Wallet" },
  { label: "我的", href: "/creator/me", icon: "UserRound" },
];

/** 管理後台（計畫 9）：手機底部導覽列也是這 5 項。 */
export const ADMIN_NAV: NavItem[] = [
  { label: "總覽", href: "/admin", icon: "LayoutDashboard" },
  { label: "創作者審核", href: "/admin/creators", icon: "UserCheck" },
  { label: "合作案", href: "/admin/collabs", icon: "Handshake" },
  { label: "款項", href: "/admin/payments", icon: "Banknote" },
  { label: "違規訊息", href: "/admin/messages", icon: "ShieldAlert" },
];

/** 目前路徑是否屬於這個項目；首頁（/brand、/creator、/admin）只比對完全相同，避免子頁面時首頁也亮起。 */
export function isActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  if (href === "/brand" || href === "/creator" || href === "/admin") return false;
  return pathname.startsWith(`${href}/`);
}
