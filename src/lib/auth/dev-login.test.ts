import { describe, expect, it } from "vitest";
import { DEV_ACCOUNTS, isDevAccount, isDevLoginEnabled } from "./dev-login";

describe("isDevLoginEnabled", () => {
  it("開發模式 + 本機 Supabase → 開", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" })).toBe(true);
    expect(isDevLoginEnabled({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" })).toBe(true);
  });
  it("正式模式 + 本機 Supabase → 關", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" })).toBe(false);
  });
  it("開發模式 + 雲端 Supabase → 關", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" })).toBe(false);
    expect(isDevLoginEnabled({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "https://127.0.0.1.evil.com" })).toBe(false);
  });
  it("沒有網址或網址無效 → 關", () => {
    expect(isDevLoginEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(isDevLoginEnabled({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toBe(false);
  });
});

describe("測試帳號（計畫 9 加入管理員）", () => {
  it("只接受 brand、creator、admin", () => {
    expect(isDevAccount("admin")).toBe(true);
    expect(isDevAccount("brand")).toBe(true);
    expect(isDevAccount("root")).toBe(false);
    expect(isDevAccount(null)).toBe(false);
    expect(DEV_ACCOUNTS.admin).toBe("dev-admin@kollink.test");
  });
});
