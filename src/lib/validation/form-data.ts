import { cleanText, normalizeIgUsername, type BrandInput, type CreatorInput } from "./onboarding";

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
