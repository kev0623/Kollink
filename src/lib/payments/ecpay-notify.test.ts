import { describe, expect, it, vi } from "vitest";
import { computeCheckMacValue } from "./ecpay";
import { handleEcpayNotify, type EcpayNotifyDeps } from "./ecpay-notify";

const KEY = "testHashKey12345";
const IV = "testHashIV123456";

function signed(overrides: Record<string, string> = {}): Record<string, string> {
  const params: Record<string, string> = {
    MerchantID: "3002607",
    MerchantTradeNo: "PL0001",
    RtnCode: "1",
    RtnMsg: "Succeeded",
    TradeNo: "2311221234567890",
    TradeAmt: "4500",
    PaymentDate: "2026/11/22 10:00:00",
    PaymentType: "Credit_CreditCard",
    SimulatePaid: "0",
    ...overrides,
  };
  return { ...params, CheckMacValue: computeCheckMacValue(params, KEY, IV) };
}

function makeDeps(overrides: Partial<EcpayNotifyDeps> = {}): EcpayNotifyDeps {
  return {
    hashKey: KEY,
    hashIV: IV,
    merchantId: "3002607",
    recordPaymentSuccess: vi.fn().mockResolvedValue("paid"),
    logError: vi.fn(),
    ...overrides,
  };
}

describe("handleEcpayNotify", () => {
  it("records a successful payment and replies 1|OK", async () => {
    const deps = makeDeps();
    const params = signed();
    const res = await handleEcpayNotify(params, deps);

    expect(res).toEqual({ status: 200, body: "1|OK" });
    expect(deps.recordPaymentSuccess).toHaveBeenCalledWith({
      merchantTradeNo: "PL0001",
      amountTwd: 4500,
      providerTradeNo: "2311221234567890",
      raw: params,
    });
  });

  it("replies 1|OK for a duplicate notification", async () => {
    const deps = makeDeps({ recordPaymentSuccess: vi.fn().mockResolvedValue("already_paid") });
    expect(await handleEcpayNotify(signed(), deps)).toEqual({ status: 200, body: "1|OK" });
  });

  it("replies 1|OK but logs when the payment requires a refund", async () => {
    const deps = makeDeps({
      recordPaymentSuccess: vi.fn().mockResolvedValue("paid_refund_required"),
    });
    const res = await handleEcpayNotify(signed(), deps);

    expect(res).toEqual({ status: 200, body: "1|OK" });
    expect(deps.logError).toHaveBeenCalledWith("ecpay notify: payment requires refund", {
      merchantTradeNo: "PL0001",
    });
  });

  it("rejects a bad signature without touching the database", async () => {
    const deps = makeDeps();
    const tampered = { ...signed(), TradeAmt: "1" };
    const res = await handleEcpayNotify(tampered, deps);

    expect(res).toEqual({ status: 400, body: "0|CheckMacValue Error" });
    expect(deps.recordPaymentSuccess).not.toHaveBeenCalled();
    expect(deps.logError).toHaveBeenCalled();
  });

  it("acknowledges a failed payment without recording it", async () => {
    const deps = makeDeps();
    const res = await handleEcpayNotify(signed({ RtnCode: "10100058", RtnMsg: "Failed" }), deps);

    expect(res).toEqual({ status: 200, body: "1|OK" });
    expect(deps.recordPaymentSuccess).not.toHaveBeenCalled();
  });

  it.each(["45.5", "0", "-4500", "4500.0", "1e3", " 4500", ""])(
    "rejects malformed TradeAmt %j",
    async (tradeAmt) => {
      const deps = makeDeps();
      const res = await handleEcpayNotify(signed({ TradeAmt: tradeAmt }), deps);

      expect(res).toEqual({ status: 400, body: "0|Bad TradeAmt" });
      expect(deps.recordPaymentSuccess).not.toHaveBeenCalled();
    },
  );

  it("ignores a simulated payment without recording it", async () => {
    const deps = makeDeps();
    const res = await handleEcpayNotify(signed({ SimulatePaid: "1" }), deps);

    expect(res).toEqual({ status: 200, body: "1|OK" });
    expect(deps.recordPaymentSuccess).not.toHaveBeenCalled();
    expect(deps.logError).toHaveBeenCalledWith("ecpay notify: simulated payment ignored", {
      merchantTradeNo: "PL0001",
    });
  });

  it("rejects a MerchantID mismatch without recording", async () => {
    const deps = makeDeps();
    const res = await handleEcpayNotify(signed({ MerchantID: "9999999" }), deps);

    expect(res).toEqual({ status: 400, body: "0|MerchantID Error" });
    expect(deps.recordPaymentSuccess).not.toHaveBeenCalled();
    expect(deps.logError).toHaveBeenCalledWith("ecpay notify: merchant mismatch", {
      merchantTradeNo: "PL0001",
    });
  });

  it("truncates an overlong MerchantTradeNo in logs", async () => {
    const deps = makeDeps();
    await handleEcpayNotify({ MerchantTradeNo: "A".repeat(200), CheckMacValue: "x" }, deps);

    expect(deps.logError).toHaveBeenCalledWith("ecpay notify: bad CheckMacValue", {
      merchantTradeNo: "A".repeat(64),
    });
  });

  it("rejects a missing or empty TradeNo without recording", async () => {
    for (const tradeNo of ["", undefined]) {
      const deps = makeDeps();
      const params: Record<string, string> = {
        MerchantID: "3002607",
        MerchantTradeNo: "PL0001",
        RtnCode: "1",
        TradeAmt: "4500",
      };
      if (tradeNo !== undefined) params.TradeNo = tradeNo;
      const res = await handleEcpayNotify(
        { ...params, CheckMacValue: computeCheckMacValue(params, KEY, IV) },
        deps,
      );

      expect(res).toEqual({ status: 400, body: "0|Missing TradeNo" });
      expect(deps.recordPaymentSuccess).not.toHaveBeenCalled();
      expect(deps.logError).toHaveBeenCalled();
    }
  });

  it("returns 500 so ECPay retries when recording fails", async () => {
    const deps = makeDeps({
      recordPaymentSuccess: vi.fn().mockRejectedValue(new Error("22023: amount mismatch")),
    });
    const res = await handleEcpayNotify(signed(), deps);

    expect(res).toEqual({ status: 500, body: "0|Error" });
    expect(deps.logError).toHaveBeenCalledWith(
      "ecpay notify: record failed",
      expect.objectContaining({ merchantTradeNo: "PL0001" }),
    );
  });
});
