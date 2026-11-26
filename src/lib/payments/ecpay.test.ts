import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { computeCheckMacValue, ecpayUrlEncode, verifyCheckMacValue } from "./ecpay";

// 綠界技術文件「檢查碼機制」中的官方範例（測試商店 3002607）
const DOC_KEY = "pwFHCqoQZGmho4w6";
const DOC_IV = "EkRm7iFT261dpevs";
const DOC_PARAMS = {
  ChoosePayment: "ALL",
  EncryptType: "1",
  ItemName: "Apple iphone 15",
  MerchantID: "3002607",
  MerchantTradeDate: "2023/03/12 15:30:23",
  MerchantTradeNo: "ecpay20230312153023",
  PaymentType: "aio",
  ReturnURL: "https://www.ecpay.com.tw/receive.php",
  TotalAmount: "30000",
  TradeDesc: "促銷方案",
};
const DOC_EXPECTED = "6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840";

describe("ecpayUrlEncode", () => {
  it("encodes spaces as +", () => {
    expect(ecpayUrlEncode("a b")).toBe("a+b");
  });
  it("leaves -_.!*() unencoded", () => {
    expect(ecpayUrlEncode("-_.!*()")).toBe("-_.!*()");
  });
  it("encodes ~ and ' like .NET", () => {
    expect(ecpayUrlEncode("~'")).toBe("%7e%27");
  });
  it("lowercases percent-encoding of multibyte characters", () => {
    expect(ecpayUrlEncode("促")).toBe("%e4%bf%83");
  });
});

describe("computeCheckMacValue", () => {
  it("matches the official ECPay documentation example", () => {
    expect(computeCheckMacValue(DOC_PARAMS, DOC_KEY, DOC_IV)).toBe(DOC_EXPECTED);
  });

  it("ignores an existing CheckMacValue parameter", () => {
    const withMac = { ...DOC_PARAMS, CheckMacValue: "WHATEVER" };
    expect(computeCheckMacValue(withMac, DOC_KEY, DOC_IV)).toBe(DOC_EXPECTED);
  });

  it("does not depend on parameter insertion order", () => {
    const reversed = Object.fromEntries(Object.entries(DOC_PARAMS).reverse());
    expect(computeCheckMacValue(reversed, DOC_KEY, DOC_IV)).toBe(DOC_EXPECTED);
  });
});

describe("computeCheckMacValue sorting", () => {
  it("sorts keys case-insensitively", () => {
    const raw = "HashKey=k&A=2&b=1&C=3&HashIV=i";
    const expected = createHash("sha256").update(ecpayUrlEncode(raw)).digest("hex").toUpperCase();
    expect(computeCheckMacValue({ b: "1", A: "2", C: "3" }, "k", "i")).toBe(expected);
  });
});

describe("verifyCheckMacValue", () => {
  const signed = { ...DOC_PARAMS, CheckMacValue: DOC_EXPECTED };

  it("accepts a correctly signed payload", () => {
    expect(verifyCheckMacValue(signed, DOC_KEY, DOC_IV)).toBe(true);
  });

  it("accepts a lowercase CheckMacValue", () => {
    expect(
      verifyCheckMacValue({ ...signed, CheckMacValue: DOC_EXPECTED.toLowerCase() }, DOC_KEY, DOC_IV),
    ).toBe(true);
  });

  it("rejects a tampered amount", () => {
    expect(verifyCheckMacValue({ ...signed, TotalAmount: "1" }, DOC_KEY, DOC_IV)).toBe(false);
  });

  it("rejects the wrong HashKey", () => {
    expect(verifyCheckMacValue(signed, "wrongkey", DOC_IV)).toBe(false);
  });

  it("rejects a missing CheckMacValue", () => {
    expect(verifyCheckMacValue(DOC_PARAMS, DOC_KEY, DOC_IV)).toBe(false);
  });

  it("rejects a CheckMacValue of the wrong length", () => {
    expect(verifyCheckMacValue({ ...signed, CheckMacValue: "ABC" }, DOC_KEY, DOC_IV)).toBe(false);
  });

  it("returns false instead of throwing on a lone surrogate", () => {
    expect(verifyCheckMacValue({ ...signed, ItemName: "a\ud800b" }, DOC_KEY, DOC_IV)).toBe(false);
  });

  it("rejects a non-ASCII CheckMacValue", () => {
    expect(verifyCheckMacValue({ ...signed, CheckMacValue: "ß".repeat(64) }, DOC_KEY, DOC_IV)).toBe(false);
  });

  it("round-trips a signature with ~, ', space and Chinese characters", () => {
    const params = { ...DOC_PARAMS, ItemName: "~it's 測試 商品" };
    const mac = computeCheckMacValue(params, DOC_KEY, DOC_IV);
    expect(verifyCheckMacValue({ ...params, CheckMacValue: mac }, DOC_KEY, DOC_IV)).toBe(true);
    expect(
      verifyCheckMacValue({ ...params, ItemName: "~it's 測試 商品x", CheckMacValue: mac }, DOC_KEY, DOC_IV),
    ).toBe(false);
  });
});
