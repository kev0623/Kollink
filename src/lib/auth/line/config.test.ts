import { describe, expect, it } from "vitest";
import { lineButtonEnabled, lineOrigin, readLineConfig, secureCookie } from "./config";

const ok = { NEXT_PUBLIC_LINE_AUTH_ENABLED: "true", LINE_CHANNEL_ID: "1234567890", LINE_CHANNEL_SECRET: "0123456789abcdef0123456789abcdef" };

describe("readLineConfig", () => {
  it("三個都有才算設定好", () => {
    expect(readLineConfig(ok)).toEqual({ channelId: "1234567890", channelSecret: "0123456789abcdef0123456789abcdef" });
    expect(readLineConfig({ ...ok, NEXT_PUBLIC_LINE_AUTH_ENABLED: "false" })).toBeNull();
    expect(readLineConfig({ ...ok, LINE_CHANNEL_ID: "" })).toBeNull();
    expect(readLineConfig({ ...ok, LINE_CHANNEL_ID: "abc" })).toBeNull();
    expect(readLineConfig({ ...ok, LINE_CHANNEL_SECRET: "short" })).toBeNull();
  });
  it("按鈕開關", () => {
    expect(lineButtonEnabled({ NEXT_PUBLIC_LINE_AUTH_ENABLED: "true" })).toBe(true);
    expect(lineButtonEnabled({})).toBe(false);
  });
});

describe("lineOrigin（redirect_uri 的來源只來自伺服器設定）", () => {
  const req = (u: string) => new URL(u);
  it("有 SITE_URL 就用它，不管請求的主機", () => {
    expect(lineOrigin("https://kollink.vercel.app", req("https://evil.example/auth/line/start"))).toBe("https://kollink.vercel.app");
    expect(lineOrigin("https://kollink.vercel.app/", req("http://127.0.0.1:3000/"))).toBe("https://kollink.vercel.app");
    expect(lineOrigin("http://localhost:3000", req("http://127.0.0.1:3000/"))).toBe("http://localhost:3000");
  });
  it("SITE_URL 不合法：null（不退回請求來源）", () => {
    expect(lineOrigin("http://kollink.vercel.app", req("http://localhost:3000/"))).toBeNull();
    expect(lineOrigin("https://kollink.vercel.app/app", req("http://localhost:3000/"))).toBeNull();
    expect(lineOrigin("not a url", req("http://localhost:3000/"))).toBeNull();
  });
  it("沒有 SITE_URL：只接受本機", () => {
    expect(lineOrigin(undefined, req("http://127.0.0.1:3000/auth/line/start"))).toBe("http://127.0.0.1:3000");
    expect(lineOrigin("", req("http://localhost:3000/"))).toBe("http://localhost:3000");
    expect(lineOrigin(undefined, req("https://kollink.vercel.app/"))).toBeNull();
    expect(lineOrigin(undefined, req("https://evil.example/"))).toBeNull();
  });
  it("Secure cookie 只在 https", () => {
    expect(secureCookie("https://kollink.vercel.app")).toBe(true);
    expect(secureCookie("http://localhost:3000")).toBe(false);
  });
});
