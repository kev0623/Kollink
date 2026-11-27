// 公開頁的主導覽（頂列的下拉選單、手機選單、頁尾共用）。server 與 client 都能 import。
import type { L } from "@/lib/lang";

export type NavLink = { href: string; label: L; note?: L };
export type NavGroup = { key: string; label: L; items: NavLink[] };

export const FEATURES_PAGE = "/features";
export const PRICING_PAGE = "/pricing";
export const FOR_BRANDS_PAGE = "/for-brands";
export const FOR_CREATORS_PAGE = "/for-creators";

/** 功能頁的各段（id 就是 /features 上的錨點） */
export const FEATURE_SECTIONS: { id: string; label: L; note: L }[] = [
  { id: "find", label: { zh: "找創作者", en: "Find creators" }, note: { zh: "搜尋通過審核的創作者", en: "Search vetted creators" } },
  { id: "briefs", label: { zh: "刊登招募", en: "Post a brief" }, note: { zh: "讓創作者自己來報名", en: "Let creators apply to you" } },
  { id: "chat", label: { zh: "訊息與條件", en: "Chat & terms" }, note: { zh: "站內討論，條件寫成合作案", en: "Talk it through, then write it down" } },
  { id: "pay", label: { zh: "款項保管", en: "Held payments" }, note: { zh: "付款後由平台保管到發佈", en: "We hold the money until the post is live" } },
  { id: "review", label: { zh: "交稿審核", en: "Delivery & approval" }, note: { zh: "在平台上交稿與審核", en: "Submit and approve work in one place" } },
  { id: "reviews", label: { zh: "雙向評價", en: "Two-way reviews" }, note: { zh: "完成合作後互相評價", en: "Both sides rate each other afterwards" } },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "features", label: { zh: "功能", en: "Features" },
    items: FEATURE_SECTIONS.map((s) => ({ href: `${FEATURES_PAGE}#${s.id}`, label: s.label, note: s.note })),
  },
  {
    key: "audience", label: { zh: "適合誰", en: "Who it's for" },
    items: [
      { href: FOR_BRANDS_PAGE, label: { zh: "品牌", en: "Brands" }, note: { zh: "找人、發案、付款到驗收", en: "Find, hire, pay and approve" } },
      { href: FOR_CREATORS_PAGE, label: { zh: "創作者", en: "Creators" }, note: { zh: "接案、交稿、收款", en: "Get hired, deliver, get paid" } },
    ],
  },
];

export const NAV_LINKS: NavLink[] = [
  { href: "/creators", label: { zh: "找創作者", en: "Find creators" } },
  { href: PRICING_PAGE, label: { zh: "收費", en: "Pricing" } },
];
