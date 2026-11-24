// 規則與 supabase/migrations/20261123000100_accounts.sql 一致；資料庫是最後防線。

export const HANDLE_RE = /^[a-z0-9_.]{3,30}$/;
export const IG_RE = /^[A-Za-z0-9_.]{1,30}$/;

// 與資料庫 clean_text / has_bidi 必須是完全相同的集合（見 20261123000100_accounts.sql）。
// 1) 任何位置一律移除：U+200B、U+2060、U+FEFF（U+200C、U+200D 只在前後去除，以免拆散 emoji）
// 2) 去掉前後的空白與看不見的字元：ASCII 空白、U+0085、U+00A0、U+00AD、U+034F、U+061C、
//    U+115F、U+1160、U+1680、U+180E、U+2000–U+200F、U+2028、U+2029、U+202F、U+205F、
//    U+2060–U+2064、U+2800、U+3000、U+3164、U+FE0F、U+FEFF、U+FFA0
// 3) 雙向控制字元 U+202A–U+202E、U+2066–U+2069 出現在任何位置都視為無效
const INNER_ZERO_WIDTH = /[​⁠﻿]/g;
const EDGE_CHARS =
  "\\s\\u0085\\u00a0\\u00ad\\u034f\\u061c\\u115f\\u1160\\u1680\\u180e\\u2000-\\u200f" +
  "\\u2028\\u2029\\u202f\\u205f\\u2060-\\u2064\\u2800\\u3000\\u3164\\ufe0f\\ufeff\\uffa0";
const EDGE_WS = new RegExp(`^[${EDGE_CHARS}]+|[${EDGE_CHARS}]+$`, "g");
const BIDI = /[‪-‮⁦-⁩]/;
const BAD_CHAR_MESSAGE = "含有不允許的特殊字元";

export function cleanText(v: string): string {
  return v.replace(INNER_ZERO_WIDTH, "").replace(EDGE_WS, "");
}

export function hasBidi(v: string): boolean {
  return BIDI.test(v);
}

/** 字數（與 Postgres char_length 一致，以 code point 計算）。 */
function len(v: string): number {
  return [...v].length;
}

export function normalizeIgUsername(v: string): string {
  return cleanText(v).replace(/^@/, "");
}

export function suggestHandle(ig: string): string {
  return normalizeIgUsername(ig).toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 30);
}

export type BrandInput = { brandName: string; industry: string; logoPath: string | null };

export function validateBrandInput(i: BrandInput): Record<string, string> | null {
  const e: Record<string, string> = {};
  const name = cleanText(i.brandName);
  if (hasBidi(name)) e.brandName = BAD_CHAR_MESSAGE;
  else if (len(name) < 1 || len(name) > 60) e.brandName = "請填寫品牌名稱（60 字以內）";
  const industry = cleanText(i.industry);
  if (hasBidi(industry)) e.industry = BAD_CHAR_MESSAGE;
  else if (len(industry) < 1 || len(industry) > 30) e.industry = "請選擇產業";
  return Object.keys(e).length ? e : null;
}

export type CreatorInput = {
  displayName: string;
  handle: string;
  igUsername: string;
  followerCount: string;
  region: string;
  categories: string[];
};

export function validateCreatorInput(i: CreatorInput): Record<string, string> | null {
  const e: Record<string, string> = {};
  const name = cleanText(i.displayName);
  if (hasBidi(name)) e.displayName = BAD_CHAR_MESSAGE;
  else if (len(name) < 1 || len(name) > 40) e.displayName = "請填寫顯示名稱（40 字以內）";
  if (!HANDLE_RE.test(cleanText(i.handle))) e.handle = "網址只能用小寫英文、數字、底線和點，3–30 字";
  if (!IG_RE.test(normalizeIgUsername(i.igUsername))) e.igUsername = "請填寫正確的 IG 帳號";
  if (!/^\d{1,9}$/.test(cleanText(i.followerCount))) e.followerCount = "請填寫粉絲數（整數）";
  const region = cleanText(i.region);
  if (hasBidi(region)) e.region = BAD_CHAR_MESSAGE;
  else if (len(region) < 1 || len(region) > 30) e.region = "請選擇地區";
  const cats = i.categories.map(cleanText);
  if (cats.some(hasBidi)) {
    e.categories = BAD_CHAR_MESSAGE;
  } else if (
    cats.length < 1 || cats.length > 5 ||
    cats.some((c) => len(c) < 1 || len(c) > 20) ||
    new Set(cats).size !== cats.length
  ) {
    e.categories = "請選 1–5 個內容領域";
  }
  return Object.keys(e).length ? e : null;
}
