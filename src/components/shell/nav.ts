export type NavItem = { label: string; href: string | null }; // href 為 null 代表「即將推出」

export const BRAND_NAV: NavItem[] = [
  { label: "創作者廣場", href: "/brand" },
  { label: "我的招募", href: null },
  { label: "合作案", href: null },
  { label: "訊息", href: null },
  { label: "付款與發票", href: null },
  { label: "設定", href: "/brand/settings" },
];

export const CREATOR_NAV: NavItem[] = [
  { label: "機會", href: "/creator" },
  { label: "合作", href: null },
  { label: "訊息", href: null },
  { label: "收入", href: null },
  { label: "我的", href: "/creator/me" },
];

/** 目前路徑是否屬於這個項目；首頁（/brand、/creator）只比對完全相同，避免子頁面時首頁也亮起。 */
export function isActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  if (href === "/brand" || href === "/creator") return false;
  return pathname.startsWith(`${href}/`);
}
