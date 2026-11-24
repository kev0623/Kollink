import { afterEach, describe, expect, it, vi } from "vitest";
import { brandLogoUrl } from "./brand-logo";

afterEach(() => vi.unstubAllEnvs());

describe("brandLogoUrl", () => {
  it("null 或空字串回傳 null", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    expect(brandLogoUrl(null)).toBeNull();
    expect(brandLogoUrl("")).toBeNull();
  });
  it("組出公開網址", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    expect(brandLogoUrl("u1/a.png")).toBe("http://127.0.0.1:54321/storage/v1/object/public/brand-logos/u1/a.png");
  });
  it("網址結尾的斜線不重複，路徑各段會編碼", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co/");
    expect(brandLogoUrl("u1/a b#.png")).toBe("https://x.supabase.co/storage/v1/object/public/brand-logos/u1/a%20b%23.png");
  });
  it("沒設定網址時回傳 null", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(brandLogoUrl("u1/a.png")).toBeNull();
  });
});
