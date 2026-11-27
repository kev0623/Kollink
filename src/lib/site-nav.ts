// 公開頁的主導覽（頂列的下拉選單、手機選單、頁尾共用）。server 與 client 都能 import。
export type NavLink = { href: string; label: string; note?: string };
export type NavGroup = { key: string; label: string; items: NavLink[] };

export const FEATURES_PAGE = "/features";
export const PRICING_PAGE = "/pricing";
export const FOR_BRANDS_PAGE = "/for-brands";
export const FOR_CREATORS_PAGE = "/for-creators";

/** 功能頁的各段（id 就是 /features 上的錨點） */
export const FEATURE_SECTIONS = [
  { id: "find", label: "找創作者", note: "搜尋通過審核的創作者" },
  { id: "briefs", label: "刊登招募", note: "讓創作者自己來報名" },
  { id: "chat", label: "訊息與條件", note: "站內討論，條件寫成合作案" },
  { id: "pay", label: "款項保管", note: "付款後由平台保管到發佈" },
  { id: "review", label: "交稿審核", note: "在平台上交稿與審核" },
  { id: "reviews", label: "雙向評價", note: "完成合作後互相評價" },
] as const;

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "features", label: "功能",
    items: FEATURE_SECTIONS.map((s) => ({ href: `${FEATURES_PAGE}#${s.id}`, label: s.label, note: s.note })),
  },
  {
    key: "audience", label: "適合誰",
    items: [
      { href: FOR_BRANDS_PAGE, label: "品牌", note: "找人、發案、付款到驗收" },
      { href: FOR_CREATORS_PAGE, label: "創作者", note: "接案、交稿、收款" },
    ],
  },
];

export const NAV_LINKS: NavLink[] = [
  { href: "/creators", label: "找創作者" },
  { href: PRICING_PAGE, label: "收費" },
];
