import { afterEach, describe, expect, it, vi } from "vitest";
import { CREATOR_MEDIA_MAX_BYTES, creatorMediaUrl, planMediaUpload } from "./creator-media";

afterEach(() => vi.unstubAllEnvs());

describe("planMediaUpload", () => {
  it("產生 <uid>/<kind>-<id>.<副檔名>", () => {
    expect(planMediaUpload("u1", "avatar", { type: "image/png", size: 10 }, "abc")).toEqual({ path: "u1/avatar-abc.png" });
    expect(planMediaUpload("u1", "portfolio", { type: "image/jpeg", size: 10 }, "abc")).toEqual({ path: "u1/portfolio-abc.jpg" });
    expect(planMediaUpload("u1", "portfolio", { type: "image/webp", size: 10 }, "abc")).toEqual({ path: "u1/portfolio-abc.webp" });
  });
  it("只接受 JPG、PNG、WebP（原型鏈上的名稱也不行）", () => {
    expect(planMediaUpload("u1", "avatar", { type: "image/gif", size: 10 }, "abc")).toEqual({ error: "只接受 JPG、PNG、WebP" });
    expect(planMediaUpload("u1", "avatar", { type: "constructor", size: 10 }, "abc")).toEqual({ error: "只接受 JPG、PNG、WebP" });
  });
  it("檔案上限 5MB", () => {
    expect(planMediaUpload("u1", "avatar", { type: "image/png", size: CREATOR_MEDIA_MAX_BYTES }, "abc")).toEqual({ path: "u1/avatar-abc.png" });
    expect(planMediaUpload("u1", "avatar", { type: "image/png", size: CREATOR_MEDIA_MAX_BYTES + 1 }, "abc")).toEqual({ error: "檔案不能超過 5MB" });
  });
});

describe("creatorMediaUrl", () => {
  it("組出 creator-media 的公開網址", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    expect(creatorMediaUrl("u1/avatar-a.png")).toBe("http://127.0.0.1:54321/storage/v1/object/public/creator-media/u1/avatar-a.png");
    expect(creatorMediaUrl(null)).toBeNull();
  });
});
