import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { avatarDataUri } from "./og-avatar";

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321"));
afterEach(() => vi.unstubAllEnvs());

const png = (body: BodyInit | null, init?: ResponseInit) =>
  new Response(body, { headers: { "content-type": "image/png" }, ...init });

describe("avatarDataUri", () => {
  it("PNG 轉成 data URI", async () => {
    const f = vi.fn(async () => png(new Uint8Array([1, 2, 3])));
    expect(await avatarDataUri("u1/avatar-a.png", f)).toBe("data:image/png;base64,AQID");
    expect(f).toHaveBeenCalledWith(
      "http://127.0.0.1:54321/storage/v1/object/public/creator-media/u1/avatar-a.png", expect.anything());
  });
  it("沒有頭像或是 webp 時不抓", async () => {
    const f = vi.fn();
    expect(await avatarDataUri(null, f)).toBeNull();
    expect(await avatarDataUri("u1/avatar-a.webp", f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("不跟隨轉址（redirect: error）", async () => {
    const f = vi.fn(async () => png(new Uint8Array([1])));
    await avatarDataUri("u1/avatar-a.png", f);
    expect(f).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ redirect: "error" }));
  });
  it("content-length 超過 5MB 時不讀 body", async () => {
    const res = png(new Uint8Array([1]), { headers: { "content-type": "image/png", "content-length": String(5 * 1024 * 1024 + 1) } });
    const spy = vi.spyOn(res, "arrayBuffer");
    expect(await avatarDataUri("u1/avatar-a.png", vi.fn(async () => res))).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
  it("回應不是 200、類型不對、空檔、抓取失敗都回傳 null", async () => {
    expect(await avatarDataUri("u1/avatar-a.png", vi.fn(async () => png(null, { status: 404 })))).toBeNull();
    expect(await avatarDataUri("u1/avatar-a.png", vi.fn(async () =>
      new Response(new Uint8Array([1]), { headers: { "content-type": "text/html" } })))).toBeNull();
    expect(await avatarDataUri("u1/avatar-a.png", vi.fn(async () => png(new Uint8Array([]))))).toBeNull();
    expect(await avatarDataUri("u1/avatar-a.jpg", vi.fn(async () => { throw new Error("down"); }))).toBeNull();
  });
});
