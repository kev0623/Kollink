import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ECPAY_CHECKOUT_URL, paymentAvailability, readEcpayConfig } from "./config";

const STAGE = {
  ECPAY_ENV: "stage", ECPAY_MERCHANT_ID: "3002607", ECPAY_HASH_KEY: "k", ECPAY_HASH_IV: "i",
  SITE_URL: "https://kollink.vercel.app",
};

describe("readEcpayConfig", () => {
  it("stage：測試環境網址、只取 origin", () => {
    expect(readEcpayConfig({ ...STAGE, SITE_URL: "https://kollink.vercel.app/" })).toEqual({
      env: "stage", merchantId: "3002607", hashKey: "k", hashIV: "i",
      siteUrl: "https://kollink.vercel.app", checkoutUrl: ECPAY_CHECKOUT_URL.stage,
    });
  });
  it("少任何一個變數就是 null（按鈕停用）", () => {
    for (const k of Object.keys(STAGE)) {
      expect(readEcpayConfig({ ...STAGE, [k]: undefined })).toBeNull();
      expect(readEcpayConfig({ ...STAGE, [k]: "" })).toBeNull();
    }
  });
  it("ECPAY_ENV 只接受 stage／prod", () => {
    expect(readEcpayConfig({ ...STAGE, ECPAY_ENV: "production" })).toBeNull();
  });
  it("prod 不能用公開的測試商店", () => {
    expect(readEcpayConfig({ ...STAGE, ECPAY_ENV: "prod" })).toBeNull();
    expect(readEcpayConfig({ ...STAGE, ECPAY_ENV: "prod", ECPAY_MERCHANT_ID: "1234567" })?.checkoutUrl)
      .toBe(ECPAY_CHECKOUT_URL.prod);
  });
  it("http 只允許 stage 的 localhost", () => {
    expect(readEcpayConfig({ ...STAGE, SITE_URL: "http://localhost:3000" })?.siteUrl).toBe("http://localhost:3000");
    expect(readEcpayConfig({ ...STAGE, SITE_URL: "http://kollink.vercel.app" })).toBeNull();
    expect(readEcpayConfig({ ...STAGE, ECPAY_ENV: "prod", ECPAY_MERCHANT_ID: "1234567", SITE_URL: "http://localhost:3000" })).toBeNull();
  });
  it("SITE_URL 不能有路徑或查詢字串", () => {
    expect(readEcpayConfig({ ...STAGE, SITE_URL: "https://kollink.vercel.app/brand" })).toBeNull();
    expect(readEcpayConfig({ ...STAGE, SITE_URL: "https://kollink.vercel.app/?a=1" })).toBeNull();
    expect(readEcpayConfig({ ...STAGE, SITE_URL: "kollink.vercel.app" })).toBeNull();
  });
  it("MerchantID 必須是數字", () => {
    expect(readEcpayConfig({ ...STAGE, ECPAY_MERCHANT_ID: "30026O7" })).toBeNull();
  });
});

describe("paymentAvailability", () => {
  it("不含金鑰", () => {
    expect(paymentAvailability(STAGE)).toEqual({ enabled: true, env: "stage" });
    expect(paymentAvailability({})).toEqual({ enabled: false, env: null });
  });
});

// 使用者決定（2026-11-26）：Vercel Production 拿到綠界正式金鑰前不開付款
describe("VERCEL_ENV=production 防護", () => {
  const PROD_REAL = { ...STAGE, ECPAY_ENV: "prod", ECPAY_MERCHANT_ID: "1234567" };
  it("production + stage → 停用", () => {
    expect(readEcpayConfig({ ...STAGE, VERCEL_ENV: "production" })).toBeNull();
    expect(paymentAvailability({ ...STAGE, VERCEL_ENV: "production" })).toEqual({ enabled: false, env: null });
  });
  it("production + prod + 測試商店 3002607 → 停用", () => {
    expect(readEcpayConfig({ ...STAGE, ECPAY_ENV: "prod", VERCEL_ENV: "production" })).toBeNull();
  });
  it("production + prod + 正式商店 → 啟用", () => {
    expect(readEcpayConfig({ ...PROD_REAL, VERCEL_ENV: "production" })?.env).toBe("prod");
  });
  it("preview／本機 + stage → 啟用", () => {
    expect(readEcpayConfig({ ...STAGE, VERCEL_ENV: "preview" })?.env).toBe("stage");
    expect(readEcpayConfig({ ...STAGE, VERCEL_ENV: "development" })?.env).toBe("stage");
    expect(readEcpayConfig(STAGE)?.env).toBe("stage");
  });
});
