import { describe, expect, it, vi } from "vitest";
import { computeCheckMacValue } from "./ecpay";
import { handleEcpayPaymentInfo, type EcpayPaymentInfoDeps } from "./ecpay-payment-info";

const KEY = "testHashKey12345";
const IV = "testHashIV123456";

function signed(overrides: Record<string, string> = {}): Record<string, string> {
  const params: Record<string, string> = {
    MerchantID: "3002607",
    MerchantTradeNo: "KL2611270123456789AB",
    RtnCode: "2",
    RtnMsg: "Get VirtualAccount Succeeded",
    TradeNo: "2611271200001234",
    TradeAmt: "4500",
    PaymentType: "ATM_TAISHIN",
    TradeDate: "2026/11/27 12:00:00",
    BankCode: "812",
    vAccount: "9103522850123456",
    ExpireDate: "2026/11/30",
    ...overrides,
  };
  return { ...params, CheckMacValue: computeCheckMacValue(params, KEY, IV) };
}

function makeDeps(overrides: Partial<EcpayPaymentInfoDeps> = {}): EcpayPaymentInfoDeps {
  return {
    hashKey: KEY,
    hashIV: IV,
    merchantId: "3002607",
    recordPaymentInfo: vi.fn().mockResolvedValue("recorded"),
    logError: vi.fn(),
    ...overrides,
  };
}

describe("handleEcpayPaymentInfo", () => {
  it("records the ATM account and replies 1|OK", async () => {
    const deps = makeDeps();
    expect(await handleEcpayPaymentInfo(signed(), deps)).toEqual({ status: 200, body: "1|OK" });
    expect(deps.recordPaymentInfo).toHaveBeenCalledWith(expect.objectContaining({
      merchantTradeNo: "KL2611270123456789AB",
      providerTradeNo: "2611271200001234",
      amountTwd: 4500,
      bankCode: "812",
      vAccount: "9103522850123456",
      expireDate: "2026-11-30",
    }));
  });

  it("accepts an ExpireDate with a time part", async () => {
    const deps = makeDeps();
    await handleEcpayPaymentInfo(signed({ ExpireDate: "2026/11/30 23:59:59" }), deps);
    expect(deps.recordPaymentInfo).toHaveBeenCalledWith(expect.objectContaining({ expireDate: "2026-11-30" }));
  });

  it("acknowledges a failed number request without recording", async () => {
    const deps = makeDeps();
    expect(await handleEcpayPaymentInfo(signed({ RtnCode: "10100058" }), deps)).toEqual({ status: 200, body: "1|OK" });
    expect(deps.recordPaymentInfo).not.toHaveBeenCalled();
    expect(deps.logError).toHaveBeenCalled();
  });

  it("rejects a bad signature", async () => {
    const deps = makeDeps();
    const res = await handleEcpayPaymentInfo({ ...signed(), vAccount: "9999999999" }, deps);
    expect(res).toEqual({ status: 400, body: "0|CheckMacValue Error" });
    expect(deps.recordPaymentInfo).not.toHaveBeenCalled();
  });

  it("rejects a MerchantID mismatch", async () => {
    const deps = makeDeps();
    expect((await handleEcpayPaymentInfo(signed({ MerchantID: "9999999" }), deps)).status).toBe(400);
    expect(deps.recordPaymentInfo).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([
    { BankCode: "81" }, { vAccount: "12ab" }, { ExpireDate: "2026-11-30" }, { ExpireDate: "2026/02/30" },
    { TradeAmt: "45.5" }, { TradeNo: " " },
  ])("rejects malformed fields %j", async (bad) => {
    const deps = makeDeps();
    expect(await handleEcpayPaymentInfo(signed(bad), deps)).toEqual({ status: 400, body: "0|Bad PaymentInfo" });
    expect(deps.recordPaymentInfo).not.toHaveBeenCalled();
  });

  it("replies 1|OK and logs an anomaly", async () => {
    const deps = makeDeps({ recordPaymentInfo: vi.fn().mockResolvedValue("anomaly") });
    expect(await handleEcpayPaymentInfo(signed(), deps)).toEqual({ status: 200, body: "1|OK" });
    expect(deps.logError).toHaveBeenCalledWith("ecpay payment-info: anomaly recorded", expect.anything());
  });

  it("returns 500 so ECPay retries when recording fails", async () => {
    const deps = makeDeps({ recordPaymentInfo: vi.fn().mockRejectedValue(new Error("boom")) });
    expect(await handleEcpayPaymentInfo(signed(), deps)).toEqual({ status: 500, body: "0|Error" });
  });
});
