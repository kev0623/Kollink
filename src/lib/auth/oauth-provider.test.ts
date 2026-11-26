import { describe, expect, it, vi } from "vitest";
import { fetchProviderStatus, providerStatusFromSettings } from "./oauth-provider";

describe("providerStatusFromSettings", () => {
  it("external.google 是 true／false", () => {
    expect(providerStatusFromSettings({ external: { google: true } }, "google")).toBe("enabled");
    expect(providerStatusFromSettings({ external: { google: false } }, "google")).toBe("disabled");
  });
  it("沒有這個欄位或格式不對：unknown（不擋登入）", () => {
    expect(providerStatusFromSettings({ external: {} }, "google")).toBe("unknown");
    expect(providerStatusFromSettings({ external: { google: "yes" } }, "google")).toBe("unknown");
    expect(providerStatusFromSettings({}, "google")).toBe("unknown");
    expect(providerStatusFromSettings(null, "google")).toBe("unknown");
    expect(providerStatusFromSettings("x", "google")).toBe("unknown");
  });
});

describe("fetchProviderStatus", () => {
  const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

  it("帶 apikey 呼叫 /auth/v1/settings（網址結尾的斜線不重複）", async () => {
    const f = ok({ external: { google: true } });
    expect(await fetchProviderStatus("http://127.0.0.1:54321/", "pk", "google", f)).toBe("enabled");
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://127.0.0.1:54321/auth/v1/settings");
    expect((init as RequestInit).headers).toEqual({ apikey: "pk" });
  });
  it("沒開：disabled", async () => {
    expect(await fetchProviderStatus("https://x.supabase.co", "pk", "google", ok({ external: { google: false } }))).toBe("disabled");
  });
  it("非 200、網路錯誤、JSON 壞掉：unknown", async () => {
    const bad = vi.fn(async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    const boom = vi.fn(async () => { throw new TypeError("network"); }) as unknown as typeof fetch;
    const junk = vi.fn(async () => new Response("{not json", { status: 200 })) as unknown as typeof fetch;
    expect(await fetchProviderStatus("https://x.supabase.co", "pk", "google", bad)).toBe("unknown");
    expect(await fetchProviderStatus("https://x.supabase.co", "pk", "google", boom)).toBe("unknown");
    expect(await fetchProviderStatus("https://x.supabase.co", "pk", "google", junk)).toBe("unknown");
  });
});
