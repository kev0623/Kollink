import { cleanText, normalizeIgUsername, type BrandInput, type CreatorInput } from "./onboarding";
import { splitTags, type PortfolioItemInput, type PublicProfileInput, type RateInput } from "./creator-profile";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export function parseBrandForm(fd: FormData): BrandInput {
  const logo = cleanText(str(fd, "logoPath"));
  return { brandName: cleanText(str(fd, "brandName")), industry: cleanText(str(fd, "industry")), logoPath: logo || null };
}

export function parseCreatorForm(fd: FormData): CreatorInput {
  return {
    displayName: cleanText(str(fd, "displayName")),
    handle: cleanText(str(fd, "handle")),
    igUsername: normalizeIgUsername(str(fd, "igUsername")),
    followerCount: cleanText(str(fd, "followerCount")),
    region: cleanText(str(fd, "region")),
    categories: fd.getAll("categories").filter((v): v is string => typeof v === "string").map(cleanText),
  };
}

function strings(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === "string");
}

export function parsePublicProfileForm(fd: FormData): PublicProfileInput {
  const avatar = cleanText(str(fd, "avatarPath"));
  return {
    bio: cleanText(str(fd, "bio")),
    styleTags: splitTags(str(fd, "styleTags")),
    collabTypes: strings(fd, "collabTypes").map(cleanText),
    engagementRate: cleanText(str(fd, "engagementRate")).replace(/%$/, "").trim(),
    audienceAge: cleanText(str(fd, "audienceAge")),
    avatarPath: avatar || null,
  };
}

/** 作品表單把清單序列化成 JSON 放在隱藏欄位 items；格式不對回傳 null。 */
export function parsePortfolioForm(fd: FormData): PortfolioItemInput[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(str(fd, "items"));
  } catch {
    return null;
  }
  if (!Array.isArray(raw)) return null;
  return raw.map((it: unknown) => {
    const o = (typeof it === "object" && it !== null ? it : {}) as Record<string, unknown>;
    return {
      imagePath: typeof o.imagePath === "string" ? cleanText(o.imagePath) : "",
      linkUrl: typeof o.linkUrl === "string" ? cleanText(o.linkUrl) : "",
    };
  });
}

/** 只讀 collabTypes 內的合作形式（price:<合作形式>）；空白代表不提供這項報價。 */
export function parseRatesForm(fd: FormData, collabTypes: string[]): RateInput[] {
  return collabTypes
    .map((t) => ({ collabType: t, price: cleanText(str(fd, `price:${t}`)).replace(/[,，\s]/g, "") }))
    .filter((r) => r.price !== "");
}
