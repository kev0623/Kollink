// 規則與 supabase/migrations/20261124000200_creator_public_profile.sql 一致；資料庫是最後防線。
import { cleanText, hasBidi } from "./onboarding";

export const IG_URL_RE = /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._~%/?=&+-]+$/;
export const MAX_PORTFOLIO = 6;
export const MAX_PRICE_TWD = 10_000_000;
const BAD_CHAR_MESSAGE = "含有不允許的特殊字元";

/** 字數（與 Postgres char_length 一致，以 code point 計算）。 */
function len(v: string): number {
  return [...v].length;
}

function hasDuplicates(list: string[]): boolean {
  return new Set(list).size !== list.length;
}

export function isInstagramUrl(v: string): boolean {
  if (len(v) > 300 || hasBidi(v) || !IG_URL_RE.test(v)) return false;
  try {
    return new URL(v).hostname.replace(/^www\./, "") === "instagram.com";
  } catch {
    return false;
  }
}

/** 風格標籤輸入框：用半形逗號、全形逗號或頓號分隔，逐項清理並去掉空白項目。 */
export function splitTags(raw: string): string[] {
  return raw.split(/[,，、]/).map(cleanText).filter((t) => t.length > 0);
}

export type PublicProfileInput = {
  bio: string;
  styleTags: string[];
  collabTypes: string[];
  engagementRate: string;
  audienceAge: string;
  avatarPath: string | null;
};

export function validatePublicProfileInput(i: PublicProfileInput): Record<string, string> | null {
  const e: Record<string, string> = {};
  if (hasBidi(i.bio)) e.bio = BAD_CHAR_MESSAGE;
  else if (len(i.bio) > 300) e.bio = "自我介紹最多 300 字";
  if (i.styleTags.some(hasBidi)) {
    e.styleTags = BAD_CHAR_MESSAGE;
  } else if (
    i.styleTags.length > 8 || i.styleTags.some((t) => len(t) < 1 || len(t) > 12) || hasDuplicates(i.styleTags)
  ) {
    e.styleTags = "最多 8 個標籤，每個 12 字以內，不可重複";
  }
  if (
    i.collabTypes.length > 6 ||
    i.collabTypes.some((t) => hasBidi(t) || len(t) < 1 || len(t) > 20) ||
    hasDuplicates(i.collabTypes)
  ) {
    e.collabTypes = "請重新選擇想接的合作";
  }
  if (i.engagementRate !== "" && !(/^\d{1,3}(\.\d{1,2})?$/.test(i.engagementRate) && Number(i.engagementRate) <= 100)) {
    e.engagementRate = "請填 0–100 的數字（最多兩位小數）";
  }
  if (hasBidi(i.audienceAge) || len(i.audienceAge) > 10) e.audienceAge = "請重新選擇受眾年齡";
  return Object.keys(e).length ? e : null;
}

export type PortfolioItemInput = { imagePath: string; linkUrl: string };

export function validatePortfolio(items: PortfolioItemInput[]): Record<string, string> | null {
  if (items.length > MAX_PORTFOLIO) return { portfolio: `最多 ${MAX_PORTFOLIO} 張作品` };
  if (items.some((it) => it.imagePath === "")) return { portfolio: "有作品還沒上傳完成" };
  const bad = items.findIndex((it) => it.linkUrl !== "" && !isInstagramUrl(it.linkUrl));
  if (bad >= 0) return { portfolio: `第 ${bad + 1} 張的連結必須是 https://www.instagram.com/ 開頭的網址` };
  return null;
}

export type RateInput = { collabType: string; price: string };

/** 錯誤的 key 是 price:<合作形式>，對應表單欄位名稱。 */
export function validateRates(rates: RateInput[]): Record<string, string> | null {
  const e: Record<string, string> = {};
  for (const r of rates) {
    if (!/^\d{1,8}$/.test(r.price) || Number(r.price) > MAX_PRICE_TWD) {
      e[`price:${r.collabType}`] = "請填 0 到 10,000,000 的整數";
    }
  }
  return Object.keys(e).length ? e : null;
}
