import { afterEach, describe, expect, it, vi } from "vitest";
import { BRIEF_COVER_MAX_BYTES, briefCoverUrl, planCoverUpload } from "./brief-cover";

afterEach(() => vi.unstubAllEnvs());

describe("planCoverUpload", () => {
  it("產生 <uid>/cover-<id>.<副檔名>", () => {
    expect(planCoverUpload("u1", { type: "image/png", size: 10 }, "abc")).toEqual({ path: "u1/cover-abc.png" });
    expect(planCoverUpload("u1", { type: "image/jpeg", size: 10 }, "abc")).toEqual({ path: "u1/cover-abc.jpg" });
    expect(planCoverUpload("u1", { type: "image/webp", size: 10 }, "abc")).toEqual({ path: "u1/cover-abc.webp" });
  });
  it("只接受 JPG、PNG、WebP（原型鏈上的名稱也不行）", () => {
    expect(planCoverUpload("u1", { type: "image/gif", size: 10 }, "abc")).toEqual({ error: "只接受 JPG、PNG、WebP" });
    expect(planCoverUpload("u1", { type: "constructor", size: 10 }, "abc")).toEqual({ error: "只接受 JPG、PNG、WebP" });
  });
  it("檔案上限 5MB", () => {
    expect(planCoverUpload("u1", { type: "image/png", size: BRIEF_COVER_MAX_BYTES }, "abc")).toEqual({ path: "u1/cover-abc.png" });
    expect(planCoverUpload("u1", { type: "image/png", size: BRIEF_COVER_MAX_BYTES + 1 }, "abc")).toEqual({ error: "檔案不能超過 5MB" });
  });
});

describe("briefCoverUrl", () => {
  it("組出 brief-covers 的公開網址", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    expect(briefCoverUrl("u1/cover-a.png")).toBe("http://127.0.0.1:54321/storage/v1/object/public/brief-covers/u1/cover-a.png");
    expect(briefCoverUrl(null)).toBeNull();
  });
});
