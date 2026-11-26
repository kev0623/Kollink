import { describe, expect, it } from "vitest";
import { buildCsp, securityHeaders, supabaseOrigins } from "./security-headers";

const PROD = "https://abcdefgh.supabase.co";
const LOCAL = "http://127.0.0.1:54321";
const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

describe("supabaseOrigins", () => {
  it("https → wss、http → ws，只留來源", () => {
    expect(supabaseOrigins(`${PROD}/`)).toEqual({ http: PROD, ws: "wss://abcdefgh.supabase.co", secure: true });
    expect(supabaseOrigins(LOCAL)).toEqual({ http: LOCAL, ws: "ws://127.0.0.1:54321", secure: false });
  });
  it("沒設定或不合法 → null", () => {
    expect(supabaseOrigins(undefined)).toBeNull();
    expect(supabaseOrigins("not a url")).toBeNull();
    expect(supabaseOrigins("javascript:alert(1)")).toBeNull();
  });
});

describe("buildCsp（正式環境）", () => {
  const csp = buildCsp({ supabaseUrl: PROD });
  it("connect-src 允許 Supabase https 與 wss", () => {
    expect(directive(csp, "connect-src")).toBe(`connect-src 'self' ${PROD} wss://abcdefgh.supabase.co`);
  });
  it("img-src 允許 Storage、data:、blob:", () => {
    expect(directive(csp, "img-src")).toBe(`img-src 'self' data: blob: ${PROD}`);
  });
  it("form-action 含綠界正式與測試", () => {
    expect(directive(csp, "form-action")).toBe("form-action 'self' https://payment.ecpay.com.tw https://payment-stage.ecpay.com.tw");
  });
  it("script-src 沒有 eval（為之後的 three.js 留空間：不需要 eval，可以有內嵌主題腳本）", () => {
    expect(directive(csp, "script-src")).toBe("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("unsafe-eval");
  });
  it("防框住、base-uri、object-src、worker-src", () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("frame-src 'none'");
  });
  it("https 的 Supabase 才升級不安全請求", () => {
    expect(csp.endsWith("upgrade-insecure-requests")).toBe(true);
  });
  it("沒有萬用字元來源", () => {
    expect(csp).not.toMatch(/ \*[ ;]| \*$|https:(?= |;|$)/);
  });
});

describe("buildCsp（本機）", () => {
  it("next start 連本機 Supabase：http 與 ws，且不升級不安全請求", () => {
    const csp = buildCsp({ supabaseUrl: LOCAL });
    expect(directive(csp, "connect-src")).toBe(`connect-src 'self' ${LOCAL} ws://127.0.0.1:54321`);
    expect(directive(csp, "img-src")).toContain(LOCAL);
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
  it("next dev 另外允許 eval 與 HMR websocket", () => {
    const csp = buildCsp({ supabaseUrl: LOCAL, isDev: true });
    expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
    expect(directive(csp, "connect-src")).toContain("ws://localhost:*");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("buildCsp（其他）", () => {
  it("沒有 Supabase 網址：不放行任何 Supabase 來源", () => {
    const csp = buildCsp({});
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
  });
  it("Vercel 預覽才放行 vercel.live", () => {
    expect(buildCsp({ supabaseUrl: PROD })).not.toContain("vercel.live");
    expect(buildCsp({ supabaseUrl: PROD, vercelPreview: true })).toContain("https://vercel.live");
  });
});

describe("securityHeaders", () => {
  const h = Object.fromEntries(securityHeaders({ supabaseUrl: PROD }).map((x) => [x.key, x.value]));
  it("五個標頭", () => {
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Permissions-Policy"]).toContain("microphone=()");
    expect(h["Permissions-Policy"]).toContain("geolocation=()");
    expect(h["Permissions-Policy"]).not.toContain("interest-cohort");
    expect(h["Content-Security-Policy"]).toContain("default-src 'self'");
  });
});
