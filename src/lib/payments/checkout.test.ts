import { describe, expect, it } from "vitest";
import { buildCheckoutForm, ecpayTradeDate, isPaymentMethod } from "./checkout";
import { verifyCheckMacValue } from "./ecpay";

// 綠界公開測試商店（https://developers.ecpay.com.tw/2856/）
const CONFIG = {
  merchantId: "3002607", hashKey: "pwFHCqoQZGmho4w6", hashIV: "EkRm7iFT261dpevs",
  siteUrl: "https://kollink.vercel.app", checkoutUrl: "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5",
};
const ID = "1a2b3c4d-0000-4000-8000-000000000001";
const BASE = { config: CONFIG, merchantTradeNo: "KL2611270123456789AB", amountTwd: 4500, collabId: ID,
  createdAt: new Date("2026-11-27T04:05:06Z") };

describe("ecpayTradeDate", () => {
  it("台灣時間 yyyy/MM/dd HH:mm:ss", () => {
    expect(ecpayTradeDate(new Date("2026-11-27T04:05:06Z"))).toBe("2026/11/27 12:05:06");
    expect(ecpayTradeDate(new Date("2026-12-31T16:00:00Z"))).toBe("2027/01/01 00:00:00");
  });
});

describe("isPaymentMethod", () => {
  it("只有 credit／atm", () => {
    expect(isPaymentMethod("credit")).toBe(true);
    expect(isPaymentMethod("atm")).toBe(true);
    expect(isPaymentMethod("ALL")).toBe(false);
    expect(isPaymentMethod(null)).toBe(false);
  });
});

describe("buildCheckoutForm", () => {
  it("信用卡：OrderResultURL 帶合作案 id、沒有 ATM 參數、簽章正確", () => {
    const f = buildCheckoutForm({ ...BASE, method: "credit" });
    expect(f.action).toBe(CONFIG.checkoutUrl);
    expect(f.fields).toMatchObject({
      MerchantID: "3002607", MerchantTradeNo: "KL2611270123456789AB", MerchantTradeDate: "2026/11/27 12:05:06",
      PaymentType: "aio", TotalAmount: "4500", ChoosePayment: "Credit", EncryptType: "1", NeedExtraPaidInfo: "N",
      ItemName: "Kollink 合作案 1a2b3c4d",
      ReturnURL: "https://kollink.vercel.app/api/payments/ecpay/notify",
      OrderResultURL: `https://kollink.vercel.app/api/payments/ecpay/result?c=${ID}`,
      ClientBackURL: `https://kollink.vercel.app/brand/collabs/${ID}`,
    });
    expect(f.fields).not.toHaveProperty("PaymentInfoURL");
    expect(f.fields).not.toHaveProperty("HashKey");
    expect(verifyCheckMacValue(f.fields, CONFIG.hashKey, CONFIG.hashIV)).toBe(true);
  });
  it("ATM：繳費 3 天、PaymentInfoURL、沒有 OrderResultURL（綠界 ATM 不支援）", () => {
    const f = buildCheckoutForm({ ...BASE, method: "atm" });
    expect(f.fields).toMatchObject({
      ChoosePayment: "ATM", ExpireDate: "3",
      PaymentInfoURL: "https://kollink.vercel.app/api/payments/ecpay/payment-info",
    });
    expect(f.fields).not.toHaveProperty("OrderResultURL");
    expect(verifyCheckMacValue(f.fields, CONFIG.hashKey, CONFIG.hashIV)).toBe(true);
  });
  it("回呼網址彼此不同（綠界要求 ReturnURL ≠ OrderResultURL）", () => {
    const f = buildCheckoutForm({ ...BASE, method: "credit" });
    expect(f.fields.ReturnURL).not.toBe(f.fields.OrderResultURL);
  });
});
